package com.mphpmaster.prayer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineStream;
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig;
import com.k2fsa.sherpa.onnx.SileroVadModelConfig;
import com.k2fsa.sherpa.onnx.SpeechSegment;
import com.k2fsa.sherpa.onnx.Vad;
import com.k2fsa.sherpa.onnx.VadModelConfig;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * WhisperEngine — fully on-device Arabic recitation recognizer: the mic feeds
 * Silero VAD, and every speech segment (one utterance, typically one dhikr
 * repetition) is transcribed by a Quran-fine-tuned Whisper model
 * (tarteel-ai/whisper-base-ar-quran, exported to sherpa-onnx int8).
 *
 * Used because the platform SpeechRecognizer has no Arabic on many devices.
 * Nothing leaves the device and no audio is kept after decoding.
 *
 * Whisper is not streaming: text arrives per segment, ~1-2 s after the
 * speaker pauses. Short pauses between repetitions also stop Whisper from
 * collapsing "X X X" into a single "X".
 *
 * Model files live in getExternalFilesDir(null)/asr/ (see MODEL_FILES); the
 * spike pushes them over adb, a release will download them on first use.
 */
public class WhisperEngine {

    public interface Listener {
        void onReady();                    // models loaded and mic open — start speaking
        void onSpeech(boolean speaking);   // VAD state, for a "hearing you" indicator
        void onText(String text);          // one decoded segment
        void onBusy(int pendingSegments);  // segments waiting for / in decoding
        void onError(String message);
    }

    static final String[] MODEL_FILES = {
        "whisper-encoder.int8.onnx", "whisper-decoder.int8.onnx", "whisper-tokens.txt", "silero_vad.onnx",
    };
    private static final String TAG = "WhisperEngine";
    private static final int SAMPLE_RATE = 16000;
    private static final int VAD_WINDOW = 512; // silero v4/v5 window at 16 kHz

    private final Context ctx;
    private final ExecutorService decoder = Executors.newSingleThreadExecutor();
    private OfflineRecognizer recognizer;
    private Vad vad;
    private volatile boolean running = false;
    private final java.util.concurrent.atomic.AtomicInteger pending = new java.util.concurrent.atomic.AtomicInteger();
    private Thread recordThread;

    public WhisperEngine(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    static File modelDir(Context ctx) {
        return new File(ctx.getExternalFilesDir(null), "asr");
    }

    static boolean modelsPresent(Context ctx) {
        File dir = modelDir(ctx);
        for (String f : MODEL_FILES) if (!new File(dir, f).isFile()) return false;
        return true;
    }

    /** Loads the models (several seconds on first use). Call off the main thread. */
    private synchronized void ensureLoaded() {
        if (recognizer != null) return;
        String dir = modelDir(ctx).getAbsolutePath() + "/";

        OfflineWhisperModelConfig whisper = new OfflineWhisperModelConfig();
        whisper.setEncoder(dir + "whisper-encoder.int8.onnx");
        whisper.setDecoder(dir + "whisper-decoder.int8.onnx");
        whisper.setLanguage("ar");
        whisper.setTask("transcribe");
        // Zero-padding appended before decoding. sherpa-onnx suggests ~300 frames
        // (3 s) for multilingual models; 1000 made every decode ~2x slower.
        whisper.setTailPaddings(300);

        OfflineModelConfig model = new OfflineModelConfig();
        model.setWhisper(whisper);
        model.setTokens(dir + "whisper-tokens.txt");
        model.setModelType("whisper");
        model.setNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors() - 1)));

        OfflineRecognizerConfig config = new OfflineRecognizerConfig();
        config.setModelConfig(model);
        config.setDecodingMethod("greedy_search");
        // null AssetManager = load from absolute file paths
        recognizer = new OfflineRecognizer(null, config);

        SileroVadModelConfig silero = new SileroVadModelConfig();
        silero.setModel(dir + "silero_vad.onnx");
        silero.setThreshold(0.5f);
        // A breath between repetitions ends a segment; shorter gaps inside a
        // phrase must not, or Whisper gets sub-second fragments and drops words.
        silero.setMinSilenceDuration(0.6f);
        silero.setMinSpeechDuration(0.25f);
        silero.setMaxSpeechDuration(20f);    // Whisper's window is 30 s
        silero.setWindowSize(VAD_WINDOW);

        VadModelConfig vadConfig = new VadModelConfig();
        vadConfig.setSileroVadModelConfig(silero);
        vadConfig.setSampleRate(SAMPLE_RATE);
        vadConfig.setNumThreads(1);
        vad = new Vad(null, vadConfig);
    }

    @SuppressLint("MissingPermission") // RECORD_AUDIO is checked by SpeechPlugin before start()
    public void start(Listener listener) {
        if (running) return;
        running = true;
        recordThread = new Thread(() -> {
            AudioRecord rec = null;
            try {
                long tLoad = System.nanoTime();
                ensureLoaded();
                Log.i(TAG, "models ready in " + (System.nanoTime() - tLoad) / 1_000_000 + "ms, threads="
                    + recognizer.getConfig().getModelConfig().getNumThreads());
                vad.reset();
                int minBuf = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
                rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(minBuf, VAD_WINDOW * 2 * 4));
                if (rec.getState() != AudioRecord.STATE_INITIALIZED) {
                    listener.onError("mic-unavailable");
                    return;
                }
                rec.startRecording();
                listener.onReady();
                short[] pcm = new short[VAD_WINDOW];
                float[] samples = new float[VAD_WINDOW];
                boolean speaking = false;
                while (running) {
                    int n = rec.read(pcm, 0, VAD_WINDOW);
                    if (n <= 0) continue;
                    for (int i = 0; i < n; i++) samples[i] = pcm[i] / 32768f;
                    vad.acceptWaveform(n == VAD_WINDOW ? samples : java.util.Arrays.copyOf(samples, n));
                    boolean now = vad.isSpeechDetected();
                    if (now != speaking) {
                        speaking = now;
                        listener.onSpeech(now);
                    }
                    drain(listener);
                }
                vad.flush(); // the last utterance, cut by stop()
                drain(listener);
                if (speaking) listener.onSpeech(false);
            } catch (Throwable t) {
                listener.onError(String.valueOf(t));
            } finally {
                if (rec != null) {
                    try { rec.stop(); } catch (Exception ignored) {}
                    rec.release();
                }
                running = false;
            }
        }, "whisper-mic");
        recordThread.start();
    }

    private void drain(Listener listener) {
        while (!vad.empty()) {
            SpeechSegment seg = vad.front();
            vad.pop();
            float[] audio = seg.getSamples();
            int queued = pending.incrementAndGet();
            listener.onBusy(queued);
            decoder.execute(() -> {
                OfflineStream stream = recognizer.createStream();
                long t0 = System.nanoTime();
                try {
                    stream.acceptWaveform(audio, SAMPLE_RATE);
                    recognizer.decode(stream);
                    String text = recognizer.getResult(stream).getText().trim();
                    long ms = (System.nanoTime() - t0) / 1_000_000;
                    // Spike diagnostics (adb logcat -s WhisperEngine): audio length vs decode time.
                    Log.i(TAG, String.format(java.util.Locale.ROOT, "segment %.2fs decoded in %dms: %s",
                        audio.length / (float) SAMPLE_RATE, ms, text));
                    if (!text.isEmpty()) listener.onText(text);
                } catch (Throwable t) {
                    listener.onError(String.valueOf(t));
                } finally {
                    stream.release();
                    listener.onBusy(pending.decrementAndGet());
                }
            });
        }
    }

    /** Stops the mic; segments already captured still decode and are delivered
     *  before onDrained runs (so the caller can safely drop its listeners). */
    public void stop(Runnable onDrained) {
        running = false;
        Thread t = recordThread;
        new Thread(() -> {
            if (t != null) {
                try { t.join(3000); } catch (InterruptedException ignored) {}
            }
            decoder.execute(onDrained);
        }, "whisper-stop").start();
    }

    public boolean isRunning() {
        return running;
    }
}
