# backend/tests/test_validation.py
from backend.validation import _detect_gpu_tier, _vlm_rejection


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