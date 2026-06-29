# backend/tests/test_validation.py
from backend.validation import _detect_gpu_tier


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