# backend/tests/test_integration.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.config import app
from backend.main import TransformerLensSmall


@app.local_entrypoint()
def test_gpu_smoke():
    """
    Smoke test: run logit lens on GPT-2 Small and assert response shape.
    Model: openai-community/gpt2 — smallest featured model, no HF token, L4 GPU.
    Cost: ~$0.01-0.02. Runtime: ~30s after container warm.
    """
    print("Running GPU smoke test: GPT-2 Small logit lens...")

    wrapped = TransformerLensSmall(model_id="openai-community/gpt2").run_logit_lens_result.remote(
        "The Eiffel Tower is in", 5
    )

    assert isinstance(wrapped, dict), f"Expected dict, got {type(wrapped)}: {wrapped}"
    assert set(wrapped.keys()) == {"data", "duration_ms", "cpu_core_s", "mem_gib_s"}, \
        f"Unexpected result envelope keys: {list(wrapped.keys())}"
    assert wrapped["duration_ms"] > 0, "duration_ms should be positive"
    assert wrapped["cpu_core_s"] > 0 and wrapped["mem_gib_s"] > 0, \
        "resource usage should be positive"
    result = wrapped["data"]
    assert "heatmap_data" in result, f"Missing heatmap_data. Keys: {list(result.keys())}"
    assert isinstance(result["heatmap_data"], list) and len(result["heatmap_data"]) > 0, \
        "heatmap_data should be a non-empty list"
    assert isinstance(result["heatmap_data"][0], list), \
        "heatmap_data should be 2D (list of lists)"
    assert "x_labels" in result and len(result["x_labels"]) > 0, \
        "x_labels should be non-empty"
    assert "y_labels" in result and len(result["y_labels"]) > 0, \
        "y_labels should be non-empty"
    assert "topk_tokens" in result, "Missing topk_tokens"

    print(f"✓ GPU smoke test passed")
    print(f"  Layers: {len(result['y_labels'])}, Tokens: {len(result['x_labels'])}")
    print(f"  Top prediction at final position: {result['topk_tokens'][-1][0]}")


@app.local_entrypoint()
def test_adapter_smoke(adapter_id: str):
    """
    Smoke test for the LoRA merge path: validate an adapter repo, then run logit
    lens on the merged model. Run after any change to the adapter branch of
    load_model — TL's hf_model= path skips device/dtype handling entirely, so
    breakage there only shows up on a real GPU, never in unit tests.

    Usage: modal run -m backend.tests.test_integration::test_adapter_smoke --adapter-id <repo>
    """
    from backend.main import _TIER_TO_CLS
    from backend.validation import validate_hf_repo

    print(f"Running adapter smoke test: {adapter_id}...")
    v = validate_hf_repo(adapter_id, hf_token=os.environ.get("HF_TOKEN"))
    assert v["valid"], f"Validation failed: {v['reason']}"
    adapter = v.get("adapter")
    assert adapter, f"'{adapter_id}' validated but did not resolve as an adapter repo"

    cls = _TIER_TO_CLS[v["gpu_tier"]]
    wrapped = cls(
        model_id=adapter_id, revision=v["revision"],
        base_id=adapter["base_id"], base_revision=adapter["base_revision"],
    ).run_logit_lens_result.remote("The Eiffel Tower is in", 5)

    result = wrapped["data"]
    assert result.get("heatmap_data"), f"Empty heatmap_data. Keys: {list(result.keys())}"

    print(f"✓ Adapter smoke test passed")
    print(f"  Base: {adapter['base_id']} · tier: {v['gpu_tier']}")
    print(f"  Top prediction at final position: {result['topk_tokens'][-1][0]}")
