import os
import runpod
from model_cache import get_or_load_model
from inference import TLInference

INFERENCE_ENDPOINTS = {
    "run_logit_lens": TLInference.run_logit_lens,
    "run_dla": TLInference.run_dla,
    "run_attribution": TLInference.run_attribution,
    "run_activation_patch": TLInference.run_activation_patch,
    "run_steering": TLInference.run_steering,
    "run_attn": TLInference.run_attn,
}

def _handle_tokenize(inp: dict): 
    from transformers import AutoTokenizer
    model_id = inp.get("model_id", "")
    text = inp.get("text", "")
    hf_token = os.environ.get("HF_TOKEN")
    tokenizer = AutoTokenizer.from_pretrained(model_id, token=hf_token)
    ids = tokenizer.encode(text, add_special_tokens=True)
    special_ids = set(getattr(tokenizer, "all_special_ids", []))
    tokens = []
    for i in ids:
        tok_text = tokenizer.decode([i], skip_special_tokens=False)
        if not tok_text and i in special_ids:
            toks = tokenizer.convert_ids_to_tokens([i])
            tok_text = toks[0] if toks else f"[{i}]"
        tokens.append({"text": tok_text, "special": i in special_ids})
    yield {"stage": "done", "data": {"tokens": tokens}}


def handler(job):
    inp = job["input"]
    endpoint = inp.get("endpoint")
    model_id = inp.get("model_id")

    if not model_id:
        yield {"stage": "error", "error": "model_id is required"}
        return

    if endpoint == "tokenize":
        try:
            yield from _handle_tokenize(inp)
        except Exception as e:
            yield {"stage": "error", "error": f"Tokenize error: {e}"}
        return

    if endpoint not in INFERENCE_ENDPOINTS:
        yield {"stage": "error", "error": f"Unknown endpoint: {endpoint!r}"}
        return

    yield {"stage": "Loading model weights…"}
    try:
        model = get_or_load_model(model_id)
    except Exception as e:
        yield {"stage": "error", "error": f"Model load failed: {e}"}
        return

    yield {"stage": "Running inference…"}
    try:
        yield from INFERENCE_ENDPOINTS[endpoint](model, inp)
    except Exception as e:
        yield {"stage": "error", "error": f"Inference error: {e}"}


runpod.serverless.start({"handler": handler, "return_aggregate_stream": True})
