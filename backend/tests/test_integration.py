# backend/tests/test_integration.py
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app, TransformerLensSmall


@app.local_entrypoint()
def test_gpu_smoke():
    """
    Smoke test: run logit lens on GPT-2 Small and assert response shape.
    Model: openai-community/gpt2 — smallest featured model, no HF token, L4 GPU.
    Cost: ~$0.01-0.02. Runtime: ~30s after container warm.
    """
    print("Running GPU smoke test: GPT-2 Small logit lens...")

    result = TransformerLensSmall(model_id="openai-community/gpt2").run_logit_lens_result.remote(
        "The Eiffel Tower is in", 5
    )

    assert isinstance(result, dict), f"Expected dict, got {type(result)}: {result}"
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
