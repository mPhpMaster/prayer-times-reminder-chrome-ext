package com.mphpmaster.prayer;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Speech — continuous speech recognition for the voice-verified dhikr tasks,
 * called from the web layer via Capacitor.Plugins.Speech (see
 * targets/mobile/web/adapter.js, Platform.speech).
 *
 * The platform SpeechRecognizer stops after each utterance / silence, so in
 * continuous mode it is restarted on every result and on the benign
 * "no match" / "speech timeout" errors until stop() is called. Matching the
 * transcript against the task text is done in JS (core/logic/recitation-match.js);
 * this plugin only streams text.
 *
 * Events:
 *   partial  { text }            live hypothesis for the current utterance
 *   final    { text }            finished utterance (the JS side appends it)
 *   state    { listening }       mic open / closed
 *   error    { code, message }   fatal error; recognition has stopped
 *
 * No audio is recorded or stored by the app. When the on-device Arabic model
 * is missing, the system recognizer may process audio on Google's servers.
 */
@CapacitorPlugin(
    name = "Speech",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class SpeechPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private boolean continuous = false;
    private String lang = "ar-SA";
    private boolean preferOffline = true;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        boolean onDevice = false;
        if (Build.VERSION.SDK_INT >= 31) {
            onDevice = SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext());
        }
        ret.put("onDevice", onDevice);
        ret.put("permission", getPermissionState("microphone") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        lang = call.getString("lang", "ar-SA");
        preferOffline = call.getBoolean("preferOffline", true);
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermissionCallback");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void micPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            begin(call);
        } else {
            call.reject("microphone-denied");
        }
    }

    private void begin(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("recognizer-unavailable");
            return;
        }
        continuous = true;
        main.post(() -> {
            destroyRecognizer();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(listener);
            listen();
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        continuous = false;
        main.post(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    private void listen() {
        if (recognizer == null) return;
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline);
        // Hints only — many recognizers ignore them, hence the restart loop.
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500);
        try {
            recognizer.startListening(i);
        } catch (Exception e) {
            fail(-1, String.valueOf(e));
        }
    }

    private void restartSoon() {
        // A short gap: restarting inside the callback is rejected as "busy" on some devices.
        main.postDelayed(() -> { if (continuous) listen(); }, 150);
    }

    private void fail(int code, String message) {
        continuous = false;
        JSObject e = new JSObject();
        e.put("code", code);
        e.put("message", message);
        notifyListeners("error", e);
        emitState(false);
    }

    private void emitState(boolean listening) {
        JSObject s = new JSObject();
        s.put("listening", listening);
        notifyListeners("state", s);
    }

    private static String firstResult(Bundle b) {
        if (b == null) return "";
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return (r == null || r.isEmpty()) ? "" : r.get(0);
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override public void onReadyForSpeech(Bundle params) { emitState(true); }
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle partial) {
            String text = firstResult(partial);
            if (text.isEmpty()) return;
            JSObject o = new JSObject();
            o.put("text", text);
            notifyListeners("partial", o);
        }

        @Override
        public void onResults(Bundle results) {
            String text = firstResult(results);
            if (!text.isEmpty()) {
                JSObject o = new JSObject();
                o.put("text", text);
                notifyListeners("final", o);
            }
            if (continuous) restartSoon();
            else emitState(false);
        }

        @Override
        public void onError(int error) {
            boolean benign = error == SpeechRecognizer.ERROR_NO_MATCH
                || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY;
            if (continuous && benign) {
                restartSoon();
                return;
            }
            if (!continuous) {
                emitState(false);
                return;
            }
            fail(error, errorName(error));
        }
    };

    private static String errorName(int code) {
        switch (code) {
            case SpeechRecognizer.ERROR_AUDIO: return "audio";
            case SpeechRecognizer.ERROR_CLIENT: return "client";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "permission";
            case SpeechRecognizer.ERROR_NETWORK: return "network";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network-timeout";
            case SpeechRecognizer.ERROR_SERVER: return "server";
            case 12: return "language-not-supported"; // ERROR_LANGUAGE_NOT_SUPPORTED (API 31)
            case 13: return "language-unavailable";   // ERROR_LANGUAGE_UNAVAILABLE (API 31)
            default: return "error-" + code;
        }
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try { recognizer.destroy(); } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    @Override
    protected void handleOnPause() {
        // Never keep the mic open behind the user's back.
        continuous = false;
        main.post(this::destroyRecognizer);
        emitState(false);
    }

    @Override
    protected void handleOnDestroy() {
        continuous = false;
        main.post(this::destroyRecognizer);
    }
}
