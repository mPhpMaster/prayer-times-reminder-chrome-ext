# On-device recitation model (WhisperEngine)

The Android game uses [tarteel-ai/whisper-base-ar-quran](https://huggingface.co/tarteel-ai/whisper-base-ar-quran)
(Apache-2.0, Whisper base fine-tuned on Quran recitation) through
[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), plus Silero VAD. The
platform `SpeechRecognizer` is not used for this because many devices have no
Arabic in it (the Xiaomi test phone lists 30 on-device languages, none Arabic,
and no online languages).

Model files are **not committed**. Build them once:

1. Python venv with `torch`, `openai-whisper`, `onnx`, `onnxruntime`.
2. Download from the model repo: `config.json`, `pytorch_model.bin`.
3. Convert the Hugging Face checkpoint to the openai-whisper layout:
   `python hf2openai.py pytorch_model.bin config.json tarteel-base-ar-quran.pt`
4. Get sherpa-onnx `scripts/whisper/export-onnx.py` and add a model choice
   `tarteel-base-ar-quran` whose `load_model` returns
   `whisper.load_model("./tarteel-base-ar-quran.pt")`. With torch ≥ 2.9 also
   force the legacy exporter (`dynamo=False`), or install `onnxscript`.
5. `python export-onnx.py --model tarteel-base-ar-quran` →
   `*-encoder.int8.onnx` (≈29 MB), `*-decoder.int8.onnx` (≈131 MB), `*-tokens.txt`.
6. `silero_vad.onnx` from the sherpa-onnx `asr-models` release.

On the device the engine expects, in `Android/data/com.mphpmaster.prayer/files/asr/`:

```
whisper-encoder.int8.onnx  whisper-decoder.int8.onnx  whisper-tokens.txt  silero_vad.onnx
```

For the spike they are pushed with adb (`adb push <file> /sdcard/Android/data/com.mphpmaster.prayer/files/asr/<name>`);
a release should download them on first use instead of bundling them.

The Android library itself: `node tools/fetch-asr.mjs`.
