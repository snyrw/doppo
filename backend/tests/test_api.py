# backend/tests/test_api.py
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import create_app, FEATURED_MODELS


@pytest.fixture(scope="module")
def client():
    return TestClient(create_app())


# ── /api/models ───────────────────────────────────────────────────────────────

class TestListModels:
    def test_returns_list(self, client):
        response = client.get("/api/models")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == len(FEATURED_MODELS)

    def test_each_entry_has_required_fields(self, client):
        response = client.get("/api/models")
        for entry in response.json():
            assert "id" in entry
            assert "display_name" in entry
            assert "description" in entry
            assert "requires_hf_token" in entry
            assert "gpu_tier" in entry

    def test_gpu_tier_values_are_valid(self, client):
        valid_tiers = {"tl_small", "tl_medium", "tl_large", "tl_xlarge", "tl_xxlarge"}
        response = client.get("/api/models")
        for entry in response.json():
            assert entry["gpu_tier"] in valid_tiers


# ── /api/validate-model ───────────────────────────────────────────────────────

class TestValidateModel:
    def test_valid_model_returns_200(self, client):
        with patch("main.validate_hf_repo") as mock:
            mock.return_value = {"valid": True, "gpu_tier": "tl_small", "reason": "ok"}
            response = client.post("/api/validate-model", json={"repo_id": "openai-community/gpt2"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["gpu_tier"] == "tl_small"

    def test_invalid_model_returns_400(self, client):
        with patch("main.validate_hf_repo") as mock:
            mock.return_value = {"valid": False, "gpu_tier": None, "reason": "not found"}
            response = client.post("/api/validate-model", json={"repo_id": "nonexistent/model"})
        assert response.status_code == 400
        assert "not found" in response.json()["detail"]

    def test_missing_repo_id_returns_422(self, client):
        response = client.post("/api/validate-model", json={})
        assert response.status_code == 422


# ── /api/tokenize — validation only (no transformers import) ─────────────────

class TestTokenize:
    def test_missing_fields_returns_422(self, client):
        response = client.post("/api/tokenize", json={})
        assert response.status_code == 422

    def test_missing_text_returns_422(self, client):
        response = client.post("/api/tokenize", json={"model_name": "gpt2-small"})
        assert response.status_code == 422

    def test_missing_model_name_returns_422(self, client):
        response = client.post("/api/tokenize", json={"text": "hello"})
        assert response.status_code == 422


# ── /api/job/spawn-lens ───────────────────────────────────────────────────────

from unittest.mock import AsyncMock, MagicMock


class TestSpawnLens:
    def _mock_resolve(self, job_id="fake-job-id"):
        mock_fc = MagicMock()
        mock_fc.object_id = job_id

        mock_method = MagicMock()
        mock_method.spawn = MagicMock()
        mock_method.spawn.aio = AsyncMock(return_value=mock_fc)

        mock_instance = MagicMock()
        mock_instance.run_logit_lens_result = mock_method

        mock_cls = MagicMock(return_value=mock_instance)
        return mock_cls

    def test_valid_request_returns_job_id(self, client):
        mock_cls = self._mock_resolve("abc-123")
        with patch("main._resolve_model", return_value=(mock_cls, "openai-community/gpt2")):
            response = client.post("/api/job/spawn-lens", json={
                "model_name": "gpt2-small",
                "prompt": "The cat sat",
                "top_k": 5,
            })
        assert response.status_code == 200
        assert response.json() == {"job_id": "abc-123"}

    def test_bad_model_returns_400(self, client):
        from fastapi import HTTPException
        with patch("main._resolve_model", side_effect=HTTPException(status_code=400, detail="model not found")):
            response = client.post("/api/job/spawn-lens", json={
                "model_name": "bad/model",
                "prompt": "hello",
                "top_k": 5,
            })
        assert response.status_code == 400
        assert "model not found" in response.json()["detail"]

    def test_missing_prompt_returns_422(self, client):
        response = client.post("/api/job/spawn-lens", json={"model_name": "gpt2-small"})
        assert response.status_code == 422

    def test_top_k_out_of_range_returns_422(self, client):
        response = client.post("/api/job/spawn-lens", json={
            "model_name": "gpt2-small",
            "prompt": "hello",
            "top_k": 0,  # ge=1 enforced
        })
        assert response.status_code == 422


# ── /api/job/{job_id} GET (poll) ──────────────────────────────────────────────

class TestPollJob:
    def test_done_state(self, client):
        done_data = {
            "heatmap_data": [[0.5]],
            "x_labels": ["tok1"],
            "y_labels": ["L0"],
            "topk_tokens": [["yes"]],
            "topk_probs": [[0.9]],
            "kl_data": [],
            "rank_data": [],
            "entropy_data": [],
        }
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(return_value=done_data)

        with patch("modal.functions.FunctionCall.from_id", return_value=mock_fc):
            response = client.get("/api/job/fake-job-id")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "done"
        assert body["data"] == done_data

    def test_running_state(self, client):
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(side_effect=TimeoutError())

        with patch("modal.functions.FunctionCall.from_id", return_value=mock_fc):
            response = client.get("/api/job/fake-job-id")

        assert response.json() == {"status": "running"}

    def test_error_state(self, client):
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(side_effect=RuntimeError("inference failed"))

        with patch("modal.functions.FunctionCall.from_id", return_value=mock_fc):
            response = client.get("/api/job/fake-job-id")

        body = response.json()
        assert body["status"] == "error"
        assert "inference failed" in body["error"]


# ── /api/job/{job_id} DELETE (cancel) ────────────────────────────────────────

class TestCancelJob:
    def test_cancel_returns_true(self, client):
        mock_fc = MagicMock()
        mock_fc.cancel = MagicMock()
        mock_fc.cancel.aio = AsyncMock()

        with patch("modal.functions.FunctionCall.from_id", return_value=mock_fc):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True}

    def test_cancel_graceful_on_error(self, client):
        # Even if FunctionCall raises, endpoint should return cancelled: True
        with patch("modal.functions.FunctionCall.from_id", side_effect=Exception("already gone")):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True}
