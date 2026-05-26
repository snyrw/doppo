import torch

_cache: dict[str, object] = {}


def _warmup(model) -> None:
    dummy = model.to_tokens("the quick brown fox")
    for _ in range(3):
        model(dummy)
    torch.cuda.empty_cache()


def get_or_load_model(model_id: str) -> object:
    """Return a cached TransformerBridge instance, loading on first call.

    HF_TOKEN is read from the environment — set it in RunPod endpoint settings
    for gated models (Llama, Gemma). HuggingFace libraries pick it up automatically.
    """
    if model_id not in _cache:
        from transformer_lens.model_bridge import TransformerBridge
        _cache[model_id] = TransformerBridge.boot_transformers(
            model_id,
            dtype=torch.bfloat16,
        )
        _cache[model_id].eval()
        _warmup(_cache[model_id])
    return _cache[model_id]
