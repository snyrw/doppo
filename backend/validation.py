# Tier boundaries by exact parameter count (bfloat16 weights ≈ 2 bytes/param):
#   tl_small   → L4         (< 4B; 24 GB)
#   tl_medium  → L40S       (< 10B; 48 GB gives backward-pass headroom for attribution)
#   tl_large   → A100-80GB  (< 25B; fits ~25B comfortably in bfloat16)
#   tl_xlarge  → H200       (< 70B; 141 GB fits up to ~65B comfortably)
#   tl_xxlarge → B200       (≤ 100B; 192 GB gives ~52 GB headroom for 70B + TL cache)
_TIER_BY_MAX_PARAMS = [
    (4e9, "tl_small"),
    (10e9, "tl_medium"),
    (25e9, "tl_large"),
    (70e9, "tl_xlarge"),
    (100e9, "tl_xxlarge"),
]


def _detect_gpu_tier(param_count: int | None) -> str | None:
    """
    Map an exact parameter count (from the Hub's safetensors metadata — no weight
    download) to a GPU tier. Returns None when the model exceeds the ~100B
    single-GPU limit, and the conservative tl_large when the count is unknown.

    Counting real params (not a layers×hidden proxy) is what makes MoE models
    size correctly: Mixtral-8x7B has the layer/hidden shape of a 7B but 46.7B
    params. For VLMs the count includes the vision tower — also correct, since
    boot_transformers loads the full checkpoint.
    """
    if not param_count:
        return "tl_large"  # Hub metadata missing — conservative fallback
    for max_params, tier in _TIER_BY_MAX_PARAMS:
        if param_count <= max_params:
            return tier
    return None  # >100B — over the single-GPU limit


# Compatibility gate, not a security control: which multimodal architectures
# TransformerLens 3.5 can bridge (text tower only). Anything else fails at GPU
# load time anyway; rejecting here just fails fast with a usable message.
_BRIDGEABLE_VLM_ARCHS = {
    "Gemma3ForConditionalGeneration",
    "Gemma3nForConditionalGeneration",
    "Gemma4ForConditionalGeneration",
    "Gemma4UnifiedForConditionalGeneration",
    "LlavaForConditionalGeneration",
    "LlavaNextForConditionalGeneration",
    "LlavaOnevisionForConditionalGeneration",
    "Qwen3_5ForConditionalGeneration",
}


def _vlm_rejection(config: dict) -> str | None:
    """Return a rejection reason if this is a VLM TransformerLens cannot bridge, else None.

    Signal is `vision_config` presence only. A nested `text_config` alone does NOT
    imply a vision tower — pure-text composite configs ship one too, and treating
    it as a VLM marker false-rejected them.
    """
    if "vision_config" not in config:
        return None
    archs = config.get("architectures") or []
    if any(a in _BRIDGEABLE_VLM_ARCHS for a in archs):
        return None
    return (
        "This is a vision-language model TransformerLens can't yet bridge. "
        "Try the text-only variant (e.g. google/gemma-3-1b-it)."
    )


def _custom_code_rejection(model_type: str | None) -> str | None:
    """Reject models whose architecture only exists as repo-hosted custom code.

    The load path always passes trust_remote_code=False, so these fail at GPU
    load time regardless — this check just moves the failure to validation with
    a clear message. Mechanism mirrors AutoConfig exactly: a model_type absent
    from transformers' registry can only load via remote code. Fails open if
    the registry can't be imported (UX gate, not a security control).
    """
    if not model_type:
        return None
    try:
        from transformers.models.auto.configuration_auto import CONFIG_MAPPING
    except ImportError:
        return None
    if model_type in CONFIG_MAPPING:
        return None
    return (
        f"Architecture '{model_type}' is not supported by the transformers library — "
        "it requires the repo's custom code (trust_remote_code), which is not allowed."
    )


_ALLOWED_PEFT_TYPES = {"LORA"}  # DoRA rides on LORA via use_dora=True


def _adapter_decision(
    repo_id: str, files, adapter_config: dict, revision: str, base_validator
) -> dict:
    """Pure decision logic for a LoRA/PEFT adapter repo (no I/O — testable in isolation).

    Guardrails: safetensors-only adapter weights, no auto_mapping (custom class import),
    LoRA/DoRA peft_type only, and the resolved base must pass the SAME validation gate.
    `base_validator(base_id) -> validation dict` is injected so the recursive base check
    (the load-bearing security control) is exercised without network access in tests.
    `revision` is the adapter repo's own resolved commit sha; the base's sha comes from
    the base's own validation result — both get pinned all the way to the load path.
    """
    def _invalid(reason: str) -> dict:
        return {"valid": False, "gpu_tier": None, "reason": reason}

    if "adapter_model.safetensors" not in files:
        return _invalid(
            "Adapter weights must be safetensors. Re-upload the adapter as adapter_model.safetensors."
        )
    # Recent PEFT serializes its full config dataclass, so `"auto_mapping": null` is
    # present in virtually every saved adapter — only a *populated* mapping signals a
    # custom class import (and even then only AutoPeftModel would honor it; our load
    # path merges manually). Reject on truthy value, never on key presence.
    if adapter_config.get("auto_mapping"):
        return _invalid("Adapter config uses auto_mapping (custom class import), which is not allowed.")
    if (adapter_config.get("peft_type") or "").upper() not in _ALLOWED_PEFT_TYPES:
        return _invalid(
            f"Unsupported adapter type '{adapter_config.get('peft_type')}'. "
            "Only LoRA/DoRA adapters are supported."
        )
    base_id = adapter_config.get("base_model_name_or_path")
    if not base_id or not isinstance(base_id, str):
        return _invalid("Adapter config has no base_model_name_or_path — cannot resolve the base model.")

    # Re-validate the resolved base through the SAME gate (load-bearing security control).
    base = base_validator(base_id)
    if not base.get("valid"):
        return _invalid(f"Adapter's base model '{base_id}' failed validation: {base.get('reason')}")

    return {
        "valid": True,
        "gpu_tier": base["gpu_tier"],
        "reason": "OK",
        "revision": revision,
        "adapter": {"base_id": base_id, "adapter_id": repo_id, "base_revision": base["revision"]},
    }


def _validate_adapter(repo_id: str, files: set, hf_token: str | None, revision: str) -> dict:
    """Download + parse adapter_config.json, then defer to the pure _adapter_decision.
    The base is re-validated by recursing into validate_hf_repo with the same token."""
    import json
    from huggingface_hub import hf_hub_download

    try:
        ac_path = hf_hub_download(repo_id, "adapter_config.json", revision=revision, token=hf_token)
        with open(ac_path) as f:
            adapter_config = json.load(f)
    except Exception as e:
        return {"valid": False, "gpu_tier": None, "reason": f"Could not read adapter_config.json: {e}"}

    return _adapter_decision(
        repo_id, files, adapter_config, revision,
        lambda base_id: validate_hf_repo(base_id, hf_token),
    )


def validate_hf_repo(repo_id: str, hf_token: str | None) -> dict:
    """
    Safety-check a user-supplied HuggingFace repo before loading it on GPU.

    Returns a dict with keys: valid (bool), gpu_tier (str|None), reason (str), and on
    success, revision (str) — the resolved commit sha, pinned all the way to the Modal
    worker so what gets loaded is exactly what was validated (no TOCTOU window).
    All network I/O is lightweight (one model_info call, plus a config.json download
    only for the VLM check) — no weights fetched.
    """
    import json
    from huggingface_hub import HfApi, hf_hub_download
    from huggingface_hub.utils import (
        EntryNotFoundError,
        GatedRepoError,
        RepositoryNotFoundError,
    )

    def _invalid(reason: str) -> dict:
        return {"valid": False, "gpu_tier": None, "reason": reason}

    try:
        info = HfApi().model_info(repo_id, token=hf_token)
    except GatedRepoError:  # subclass of RepositoryNotFoundError — must be caught first
        return _invalid(
            f"Repository '{repo_id}' is gated. Accept its license on huggingface.co, "
            "or the model's owner has not granted this service access."
        )
    except RepositoryNotFoundError:
        return _invalid(f"Repository '{repo_id}' not found or is private.")
    except Exception as e:
        return _invalid(f"Could not look up repository: {e}")

    files = {s.rfilename for s in info.siblings}
    revision = info.sha

    if "adapter_config.json" in files:
        return _validate_adapter(repo_id, files, hf_token, revision)

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    if not has_safetensors:
        if any(f.endswith(".bin") or f.endswith(".pt") for f in files):
            return _invalid(
                "Repository contains only pickle (.bin/.pt) weights, which are unsafe to load. "
                "Re-upload in safetensors format."
            )
        return _invalid("No safetensors weights found. Only the safetensors format is supported.")

    hub_config = info.config or {}
    custom_code_reason = _custom_code_rejection(hub_config.get("model_type"))
    if custom_code_reason:
        return _invalid(custom_code_reason)

    # Exact param count from the Hub's safetensors metadata — same model_info
    # response, no extra network round trip.
    st = getattr(info, "safetensors", None)
    gpu_tier = _detect_gpu_tier(st.total if st else None)
    if gpu_tier is None:
        return _invalid(
            "Model appears to exceed ~100B parameters. Single-GPU limit is ~100B on B200 — "
            "choose a smaller model."
        )

    # vision_config isn't in the model_info summary — the VLM check needs the real config.json.
    if "config.json" in files:
        try:
            config_path = hf_hub_download(repo_id, "config.json", revision=revision, token=hf_token)
            with open(config_path) as f:
                config = json.load(f)
            vlm_reason = _vlm_rejection(config)
            if vlm_reason:
                return _invalid(vlm_reason)
        except EntryNotFoundError:
            pass
        except GatedRepoError:
            # Gated repos expose metadata publicly but 401/403 on file downloads,
            # so the gate can first surface here rather than at model_info.
            return _invalid(
                f"Repository '{repo_id}' is gated. Accept its license on huggingface.co, "
                "or the model's owner has not granted this service access."
            )
        except Exception as e:
            return _invalid(f"Could not read config.json: {e}")

    return {"valid": True, "gpu_tier": gpu_tier, "reason": "OK", "revision": revision}
