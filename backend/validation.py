def _detect_gpu_tier(config: dict) -> str:
    """
    Estimate GPU tier from a model's config.json.
    Falls back to tl_large when the model is too large for a cheaper tier or size is unknown.
    Returns None if the model exceeds the single-GPU limit (~100B on B200).

    Tiers:
      tl_small   → L4         (< 4B)
      tl_medium  → L40S       (4–10B; 48 GB gives backward-pass headroom for attribution)
      tl_large   → A100-80GB  (10–25B; A100-80GB fits ~25B comfortably in bfloat16)
      tl_xlarge  → H200       (25–69B; H200 141 GB fits up to ~65B comfortably)
      tl_xxlarge → B200       (70B–100B; B200 192 GB gives ~52 GB headroom for 70B + TL cache)
    """
    # Multimodal configs (Gemma3ForConditionalGeneration, LLaVA, Qwen-VL) nest the
    # language-model dims under text_config; read those so VLM text towers size correctly.
    source = config.get("text_config") if isinstance(config.get("text_config"), dict) else config
    num_params = source.get("num_parameters")
    if isinstance(num_params, (int, float)):
        if num_params < 4e9:
            return "tl_small"
        if num_params < 10e9:
            return "tl_medium"
        if num_params < 25e9:
            return "tl_large"
        if num_params < 70e9:
            return "tl_xlarge"
        if num_params < 100e9:
            return "tl_xxlarge"
        return None  # exceeds single-GPU limit (~100B on B200)

    # Proxy: num_hidden_layers × hidden_size scales predictably with model size.
    # Thresholds calibrated against known models: GPT-2 XL=76K, Llama3-8B=131K,
    # Qwen3-14B=205K, Gemma3-27B=333K, Llama3.3-70B=655K.
    layers = source.get("num_hidden_layers", 0)
    hidden = source.get("hidden_size", 0)
    proxy = layers * hidden
    if proxy and proxy < 90_000:
        return "tl_small"
    if proxy and proxy < 165_000:
        return "tl_medium"
    if proxy and proxy < 300_000:
        return "tl_large"
    if proxy and proxy < 660_000:
        return "tl_xlarge"
    if proxy and proxy < 900_000:
        return "tl_xxlarge"
    if proxy:
        return None  # likely 100B+

    return "tl_large"  # unknown shape — conservative fallback


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
    """Return a rejection reason if this is a VLM TransformerLens cannot bridge, else None."""
    is_vlm = "vision_config" in config or "text_config" in config
    if not is_vlm:
        return None
    archs = config.get("architectures") or []
    if any(a in _BRIDGEABLE_VLM_ARCHS for a in archs):
        return None
    return (
        "This is a vision-language model TransformerLens can't yet bridge. "
        "Try the text-only variant (e.g. google/gemma-3-1b-it)."
    )


_ALLOWED_PEFT_TYPES = {"LORA"}  # DoRA rides on LORA via use_dora=True


def _adapter_decision(repo_id: str, files, adapter_config: dict, base_validator) -> dict:
    """Pure decision logic for a LoRA/PEFT adapter repo (no I/O — testable in isolation).

    Guardrails: safetensors-only adapter weights, no auto_mapping (custom class import),
    LoRA/DoRA peft_type only, and the resolved base must pass the SAME validation gate.
    `base_validator(base_id) -> validation dict` is injected so the recursive base check
    (the load-bearing security control) is exercised without network access in tests.
    """
    def _invalid(reason: str) -> dict:
        return {"valid": False, "gpu_tier": None, "reason": reason}

    if "adapter_model.safetensors" not in files:
        return _invalid(
            "Adapter weights must be safetensors. Re-upload the adapter as adapter_model.safetensors."
        )
    if "auto_mapping" in adapter_config:
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
        "adapter": {"base_id": base_id, "adapter_id": repo_id},
    }


def _validate_adapter(repo_id: str, files: set, hf_token: str | None) -> dict:
    """Download + parse adapter_config.json, then defer to the pure _adapter_decision.
    The base is re-validated by recursing into validate_hf_repo with the same token."""
    import json
    from huggingface_hub import hf_hub_download

    try:
        ac_path = hf_hub_download(repo_id, "adapter_config.json", token=hf_token)
        with open(ac_path) as f:
            adapter_config = json.load(f)
    except Exception as e:
        return {"valid": False, "gpu_tier": None, "reason": f"Could not read adapter_config.json: {e}"}

    return _adapter_decision(
        repo_id, files, adapter_config,
        lambda base_id: validate_hf_repo(base_id, hf_token),
    )


def validate_hf_repo(repo_id: str, hf_token: str | None) -> dict:
    """
    Safety-check a user-supplied HuggingFace repo before loading it on GPU.

    Returns a dict with keys: valid (bool), gpu_tier (str|None), reason (str).
    All network I/O is lightweight (file listing + small JSON downloads) — no weights fetched.
    """
    import json
    from huggingface_hub import list_repo_files, hf_hub_download
    from huggingface_hub.utils import RepositoryNotFoundError, EntryNotFoundError

    def _invalid(reason: str) -> dict:
        return {"valid": False, "gpu_tier": None, "reason": reason}

    try:
        files = set(list_repo_files(repo_id, token=hf_token))
    except RepositoryNotFoundError:
        return _invalid(f"Repository '{repo_id}' not found or is private (check your HF token).")
    except Exception as e:
        return _invalid(f"Could not list repo files: {e}")

    if "adapter_config.json" in files:
        return _validate_adapter(repo_id, files, hf_token)

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    has_pickle_only = not has_safetensors and any(
        f.endswith(".bin") or f.endswith(".pt") for f in files
    )
    if has_pickle_only:
        return _invalid(
            "Repository contains only pickle (.bin/.pt) weights, which are unsafe to load. "
            "Re-upload in safetensors format."
        )
    if not has_safetensors:
        return _invalid("No safetensors weights found. Only the safetensors format is supported.")

    gpu_tier = "tl_large"  # conservative default if config.json is absent
    if "config.json" in files:
        try:
            config_path = hf_hub_download(repo_id, "config.json", token=hf_token)
            with open(config_path) as f:
                config = json.load(f)
            if config.get("trust_remote_code"):
                return _invalid("Model config sets trust_remote_code=True, which is not allowed.")
            if "auto_map" in config:
                # auto_map is safe when values are bare class names resolved from transformers.
                # A dotted path that doesn't start with "transformers." signals a custom module
                # (e.g. "modeling_foo.FooModel") that could execute arbitrary code at import time.
                custom_module = [
                    v for v in config["auto_map"].values()
                    if isinstance(v, str) and "." in v and not v.startswith("transformers.")
                ]
                if custom_module:
                    return _invalid(
                        "Model config uses auto_map with custom module paths, which is not allowed."
                    )
            vlm_reason = _vlm_rejection(config)
            if vlm_reason:
                return _invalid(vlm_reason)
            detected = _detect_gpu_tier(config)
            if detected is None:
                return _invalid(
                    "Model appears to exceed ~100B parameters. Single-GPU limit is ~100B on B200 — "
                    "choose a smaller model."
                )
            gpu_tier = detected
        except EntryNotFoundError:
            pass
        except Exception as e:
            return _invalid(f"Could not read config.json: {e}")

    if "tokenizer_config.json" in files:
        try:
            tc_path = hf_hub_download(repo_id, "tokenizer_config.json", token=hf_token)
            with open(tc_path) as f:
                tc = json.load(f)
            if "auto_map" in tc:
                custom_module = [
                    v for v in tc["auto_map"].values()
                    if isinstance(v, str) and "." in v and not v.startswith("transformers.")
                ]
                if custom_module:
                    return _invalid(
                        "Tokenizer config uses auto_map with custom module paths, which is not allowed."
                    )
        except EntryNotFoundError:
            pass
        except Exception as e:
            return _invalid(f"Could not read tokenizer_config.json: {e}")

    return {"valid": True, "gpu_tier": gpu_tier, "reason": "OK"}
