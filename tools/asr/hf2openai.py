# Convert a Hugging Face Whisper checkpoint (tarteel-ai/whisper-base-ar-quran)
# to the openai-whisper .pt layout that sherpa-onnx's export-onnx.py loads.
import json, re, sys, torch

src, cfg_path, out = sys.argv[1:4]
cfg = json.load(open(cfg_path))
sd = torch.load(src, map_location="cpu", weights_only=True)

def rename(k):
    k = re.sub(r"^model\.", "", k)
    k = k.replace("embed_positions.weight", "positional_embedding")
    k = k.replace("decoder.embed_tokens", "decoder.token_embedding")
    k = k.replace("encoder.layer_norm", "encoder.ln_post").replace("decoder.layer_norm", "decoder.ln")
    k = k.replace(".layers.", ".blocks.")
    k = k.replace("self_attn_layer_norm", "attn_ln").replace("encoder_attn_layer_norm", "cross_attn_ln")
    k = k.replace("final_layer_norm", "mlp_ln")
    k = k.replace("self_attn.", "attn.").replace("encoder_attn.", "cross_attn.")
    k = k.replace("q_proj", "query").replace("k_proj", "key").replace("v_proj", "value").replace("out_proj", "out")
    k = k.replace("fc1", "mlp.0").replace("fc2", "mlp.2")
    return k

new = {}
for k, v in sd.items():
    if k.startswith("proj_out"):  # tied to token embedding
        continue
    new[rename(k)] = v

dims = dict(
    n_mels=cfg["num_mel_bins"], n_vocab=cfg["vocab_size"],
    n_audio_ctx=cfg["max_source_positions"], n_audio_state=cfg["d_model"],
    n_audio_head=cfg["encoder_attention_heads"], n_audio_layer=cfg["encoder_layers"],
    n_text_ctx=cfg["max_target_positions"], n_text_state=cfg["d_model"],
    n_text_head=cfg["decoder_attention_heads"], n_text_layer=cfg["decoder_layers"],
)

# Sanity check against a real openai-whisper model of the same size.
import whisper
from whisper.model import ModelDimensions, Whisper
m = Whisper(ModelDimensions(**dims))
missing, unexpected = m.load_state_dict(new, strict=False)
print("missing:", missing)
print("unexpected:", unexpected)
assert not unexpected and all("alignment_heads" in x for x in missing), "key mapping incomplete"
torch.save({"dims": dims, "model_state_dict": new}, out)
print("saved", out)
