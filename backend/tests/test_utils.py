# backend/tests/test_utils.py
import pytest
from types import SimpleNamespace
from backend.validation import _detect_gpu_tier
from backend.main import _bump_tier
from backend.inference import _resolve_pos


# ── _detect_gpu_tier ──────────────────────────────────────────────────────────

class TestDetectGpuTierByParamCount:
    # Exact param count from Hub safetensors metadata:
    # ≤ 4B → tl_small; ≤ 10B → tl_medium; ≤ 25B → tl_large
    # ≤ 70B → tl_xlarge; ≤ 100B → tl_xxlarge; > 100B → None

    def test_small(self):
        assert _detect_gpu_tier(137_022_720) == "tl_small"  # GPT-2

    def test_medium(self):
        assert _detect_gpu_tier(8_030_261_248) == "tl_medium"  # Llama-3.1-8B

    def test_large(self):
        assert _detect_gpu_tier(14_800_000_000) == "tl_large"  # Qwen3-14B

    def test_xlarge(self):
        assert _detect_gpu_tier(46_702_792_704) == "tl_xlarge"  # Mixtral-8x7B

    def test_moe_sized_by_total_params(self):
        # Regression: Mixtral-8x7B has the layers×hidden shape of a 7B model —
        # the old proxy put it on tl_medium (48 GB) where 46.7B params OOM.
        assert _detect_gpu_tier(46_702_792_704) != "tl_medium"

    def test_xxlarge(self):
        assert _detect_gpu_tier(70_553_706_496) == "tl_xxlarge"  # Llama-3.3-70B

    def test_over_limit_returns_none(self):
        assert _detect_gpu_tier(140_000_000_000) is None


class TestDetectGpuTierFallback:
    def test_none_param_count(self):
        assert _detect_gpu_tier(None) == "tl_large"

    def test_zero_param_count(self):
        assert _detect_gpu_tier(0) == "tl_large"


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
