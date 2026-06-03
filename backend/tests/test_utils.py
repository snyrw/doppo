# backend/tests/test_utils.py
import json
import pytest
from types import SimpleNamespace
from main import _detect_gpu_tier, _bump_tier, _resolve_pos, _sse_error


# ── _detect_gpu_tier ──────────────────────────────────────────────────────────

class TestDetectGpuTierByNumParameters:
    def test_small(self):
        assert _detect_gpu_tier({"num_parameters": 1e9}) == "tl_small"

    def test_small_boundary(self):
        # 4B exactly is NOT small (< 4B required)
        assert _detect_gpu_tier({"num_parameters": 3.9e9}) == "tl_small"
        assert _detect_gpu_tier({"num_parameters": 4e9}) == "tl_medium"

    def test_medium(self):
        assert _detect_gpu_tier({"num_parameters": 7e9}) == "tl_medium"

    def test_medium_boundary(self):
        assert _detect_gpu_tier({"num_parameters": 9.9e9}) == "tl_medium"
        assert _detect_gpu_tier({"num_parameters": 10e9}) == "tl_large"

    def test_large(self):
        assert _detect_gpu_tier({"num_parameters": 20e9}) == "tl_large"

    def test_large_boundary(self):
        assert _detect_gpu_tier({"num_parameters": 24.9e9}) == "tl_large"
        assert _detect_gpu_tier({"num_parameters": 25e9}) == "tl_xlarge"

    def test_xlarge(self):
        assert _detect_gpu_tier({"num_parameters": 50e9}) == "tl_xlarge"

    def test_xlarge_boundary(self):
        assert _detect_gpu_tier({"num_parameters": 69.9e9}) == "tl_xlarge"
        assert _detect_gpu_tier({"num_parameters": 70e9}) == "tl_xxlarge"

    def test_xxlarge(self):
        assert _detect_gpu_tier({"num_parameters": 85e9}) == "tl_xxlarge"

    def test_over_limit_returns_none(self):
        assert _detect_gpu_tier({"num_parameters": 100e9}) is None
        assert _detect_gpu_tier({"num_parameters": 200e9}) is None


class TestDetectGpuTierByProxy:
    # proxy = num_hidden_layers * hidden_size
    # < 90K → tl_small; < 165K → tl_medium; < 300K → tl_large
    # < 660K → tl_xlarge; < 900K → tl_xxlarge; >= 900K → None

    def test_small_proxy(self):
        # 12 * 768 = 9216 < 90K
        assert _detect_gpu_tier({"num_hidden_layers": 12, "hidden_size": 768}) == "tl_small"

    def test_medium_proxy(self):
        # 32 * 4096 = 131072, 90K < 131072 < 165K
        assert _detect_gpu_tier({"num_hidden_layers": 32, "hidden_size": 4096}) == "tl_medium"

    def test_large_proxy(self):
        # 40 * 5120 = 204800, 165K < 204800 < 300K
        assert _detect_gpu_tier({"num_hidden_layers": 40, "hidden_size": 5120}) == "tl_large"

    def test_xlarge_proxy(self):
        # 60 * 6144 = 368640, 300K < 368640 < 660K
        assert _detect_gpu_tier({"num_hidden_layers": 60, "hidden_size": 6144}) == "tl_xlarge"

    def test_xxlarge_proxy(self):
        # 84 * 8192 = 688128, 660K < 688128 < 900K
        assert _detect_gpu_tier({"num_hidden_layers": 84, "hidden_size": 8192}) == "tl_xxlarge"

    def test_over_limit_proxy_returns_none(self):
        # 96 * 12288 = 1179648 >= 900K
        assert _detect_gpu_tier({"num_hidden_layers": 96, "hidden_size": 12288}) is None

    def test_zero_proxy_falls_through_to_fallback(self):
        # layers or hidden = 0 → proxy = 0, treated as falsy, falls through to tl_large fallback
        assert _detect_gpu_tier({"num_hidden_layers": 0, "hidden_size": 4096}) == "tl_large"


class TestDetectGpuTierFallback:
    def test_empty_config(self):
        assert _detect_gpu_tier({}) == "tl_large"

    def test_unrelated_keys_only(self):
        assert _detect_gpu_tier({"model_type": "llama", "vocab_size": 32000}) == "tl_large"

    def test_num_parameters_takes_priority_over_proxy(self):
        # num_parameters present → use it, not the proxy
        config = {"num_parameters": 1e9, "num_hidden_layers": 80, "hidden_size": 8192}
        assert _detect_gpu_tier(config) == "tl_small"


# ── _bump_tier ────────────────────────────────────────────────────────────────

class TestBumpTier:
    def test_small_bumps_to_medium(self):
        assert _bump_tier("tl_small") == "tl_medium"

    def test_medium_bumps_to_large(self):
        assert _bump_tier("tl_medium") == "tl_large"

    def test_large_bumps_to_xlarge(self):
        assert _bump_tier("tl_large") == "tl_xlarge"

    def test_xlarge_bumps_to_xxlarge(self):
        assert _bump_tier("tl_xlarge") == "tl_xxlarge"

    def test_xxlarge_stays_at_ceiling(self):
        assert _bump_tier("tl_xxlarge") == "tl_xxlarge"


# ── _resolve_pos ──────────────────────────────────────────────────────────────

class TestResolvePos:
    def _tokens(self, length):
        return SimpleNamespace(shape=(1, length))

    def test_last_resolves_to_final_index(self):
        assert _resolve_pos(self._tokens(7), "last") == 6

    def test_integer_passes_through(self):
        assert _resolve_pos(self._tokens(10), 3) == 3

    def test_integer_string_converts(self):
        assert _resolve_pos(self._tokens(10), "3") == 3

    def test_last_with_single_token(self):
        assert _resolve_pos(self._tokens(1), "last") == 0


# ── _sse_error ────────────────────────────────────────────────────────────────

class TestSseError:
    def test_starts_with_data_prefix(self):
        output = _sse_error(ValueError("oops"))
        assert output.startswith("data: ")

    def test_payload_is_valid_json(self):
        output = _sse_error(ValueError("oops"))
        payload = json.loads(output[len("data: "):].strip())
        assert payload["stage"] == "error"
        assert payload["error"] == "oops"

    def test_special_chars_are_escaped(self):
        output = _sse_error(ValueError('quote: "hello"'))
        payload = json.loads(output[len("data: "):].strip())
        assert payload["error"] == 'quote: "hello"'

    def test_ends_with_double_newline(self):
        output = _sse_error(ValueError("x"))
        assert output.endswith("\n\n")
