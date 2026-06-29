# backend/tests/test_validation.py
from backend.validation import _adapter_decision, _detect_gpu_tier, _vlm_rejection


def test_flat_text_config_unchanged():
    # Gemma-3-1B-shaped flat config
    assert _detect_gpu_tier({"num_hidden_layers": 26, "hidden_size": 1152}) == "tl_small"


def test_nested_text_config_is_read():
    # Gemma-3-27B multimodal: LM dims nested under text_config (62 * 5376 = 333_312,
    # which lands in the proxy band [300k, 660k) -> tl_xlarge, matching its ~27B param count).
    cfg = {
        "architectures": ["Gemma3ForConditionalGeneration"],
        "vision_config": {"hidden_size": 1152, "num_hidden_layers": 27},
        "text_config": {"num_hidden_layers": 62, "hidden_size": 5376},
    }
    assert _detect_gpu_tier(cfg) == "tl_xlarge"


def test_nested_num_parameters_preferred():
    cfg = {"text_config": {"num_parameters": 4_300_000_000}}
    assert _detect_gpu_tier(cfg) == "tl_medium"


BRIDGEABLE = {"architectures": ["Gemma3ForConditionalGeneration"],
              "text_config": {}, "vision_config": {}}
UNBRIDGEABLE = {"architectures": ["Qwen2_5_VLForConditionalGeneration"],
                "text_config": {}, "vision_config": {}}
TEXT_ONLY = {"architectures": ["Gemma3ForCausalLM"], "num_hidden_layers": 26, "hidden_size": 1152}


def test_bridgeable_vlm_accepted():
    assert _vlm_rejection(BRIDGEABLE) is None


def test_unbridgeable_vlm_rejected():
    reason = _vlm_rejection(UNBRIDGEABLE)
    assert reason is not None and "text-only" in reason


def test_text_only_not_treated_as_vlm():
    assert _vlm_rejection(TEXT_ONLY) is None


# ── LoRA/PEFT adapter validation (_adapter_decision is the pure decision core;
#    base_validator is injected so no network/HF calls are needed) ──────────────

def _ok_base(_base_id):
    return {"valid": True, "gpu_tier": "tl_medium", "reason": "OK"}


def _bad_base(_base_id):
    return {"valid": False, "gpu_tier": None, "reason": "only pickle weights"}


def test_adapter_safetensors_base_valid():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base"}
    res = _adapter_decision("user/lora", files, ac, _ok_base)
    assert res["valid"] is True
    assert res["gpu_tier"] == "tl_medium"  # inherits the base's tier
    assert res["adapter"] == {"base_id": "meta/base", "adapter_id": "user/lora"}


def test_adapter_dora_accepted():
    # DoRA rides on a LORA config via use_dora=True — must be accepted.
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "use_dora": True, "base_model_name_or_path": "meta/base"}
    assert _adapter_decision("user/dora", files, ac, _ok_base)["valid"] is True


def test_adapter_bin_only_rejected():
    files = {"adapter_config.json", "adapter_model.bin"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base"}
    res = _adapter_decision("user/lora", files, ac, _ok_base)
    assert res["valid"] is False
    assert "safetensors" in res["reason"]


def test_adapter_auto_mapping_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "meta/base",
          "auto_mapping": {"base_model_class": "x.Y"}}
    res = _adapter_decision("user/lora", files, ac, _ok_base)
    assert res["valid"] is False
    assert "auto_mapping" in res["reason"]


def test_adapter_bad_peft_type_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "PREFIX_TUNING", "base_model_name_or_path": "meta/base"}
    assert _adapter_decision("user/lora", files, ac, _ok_base)["valid"] is False


def test_adapter_missing_base_rejected():
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA"}
    res = _adapter_decision("user/lora", files, ac, _ok_base)
    assert res["valid"] is False
    assert "base_model_name_or_path" in res["reason"]


def test_adapter_unsafe_base_rejected():
    # base fails the recursive gate -> adapter rejected, surfacing the base reason.
    files = {"adapter_config.json", "adapter_model.safetensors"}
    ac = {"peft_type": "LORA", "base_model_name_or_path": "evil/base"}
    res = _adapter_decision("user/lora", files, ac, _bad_base)
    assert res["valid"] is False
    assert "evil/base" in res["reason"]