import importlib
import sys
from unittest.mock import MagicMock, patch

def _fresh_cache_module():
    """Import model_cache with a clean _cache dict each time."""
    if "model_cache" in sys.modules:
        del sys.modules["model_cache"]
    sys.path.insert(0, "backend/worker")

    # Mock transformer_lens.model_bridge module since TL 2.18.0 doesn't have it
    if "transformer_lens" not in sys.modules:
        sys.modules["transformer_lens"] = MagicMock()
        sys.modules["transformer_lens.model_bridge"] = MagicMock()

    return importlib.import_module("model_cache")

def test_cache_miss_calls_boot_transformers():
    mc = _fresh_cache_module()
    fake_model = MagicMock()
    with patch("transformer_lens.model_bridge.TransformerBridge.boot_transformers", return_value=fake_model) as mock_boot, \
         patch("torch.bfloat16", MagicMock()), \
         patch("torch.cuda.empty_cache"):
        result = mc.get_or_load_model("openai-community/gpt2")
    mock_boot.assert_called_once()
    assert result is fake_model

def test_cache_hit_skips_boot_transformers():
    mc = _fresh_cache_module()
    fake_model = MagicMock()
    mc._cache["openai-community/gpt2"] = fake_model
    with patch("transformer_lens.model_bridge.TransformerBridge.boot_transformers") as mock_boot:
        result = mc.get_or_load_model("openai-community/gpt2")
    mock_boot.assert_not_called()
    assert result is fake_model
