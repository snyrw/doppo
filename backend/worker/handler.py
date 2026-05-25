# backend/worker/handler.py
import runpod
from model_cache import get_or_load_model
from inference import TLInference

ENDPOINT_DISPATCH = {
    "run_logit_lens":       TLInference.run_logit_lens,
    "run_dla":              TLInference.run_dla,
    "run_attribution":      TLInference.run_attribution,
    "run_activation_patch": TLInference.run_activation_patch,
    "run_steering":         TLInference.run_steering,
    "run_attn":             TLInference.run_attn,
}


def handler(job):
    inp = job["input"]
    endpoint = inp.get("endpoint")
    model_id = inp.get("model_id")

    if endpoint not in ENDPOINT_DISPATCH:
        yield {"stage": "error", "error": f"Unknown endpoint: {endpoint!r}"}
        return

    if not model_id:
        yield {"stage": "error", "error": "model_id is required"}
        return

    yield {"stage": "Loading model weights…"}
    try:
        model = get_or_load_model(model_id)
    except Exception as e:
        yield {"stage": "error", "error": f"Model load failed: {e}"}
        return

    yield {"stage": "Running inference…"}
    try:
        yield from ENDPOINT_DISPATCH[endpoint](model, inp)
    except Exception as e:
        yield {"stage": "error", "error": f"Inference error: {e}"}


runpod.serverless.start({"handler": handler, "return_aggregate_stream": True})
