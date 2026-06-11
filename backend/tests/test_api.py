# backend/tests/test_api.py
import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.config import FEATURED_MODELS

# Every route is gated by the shared bearer secret (backend/auth.py); the
# dependency reads BACKEND_API_SECRET from the env on each request.
TEST_SECRET = "test-backend-secret"


@pytest.fixture(scope="module")
def client():
    os.environ["BACKEND_API_SECRET"] = TEST_SECRET
    c = TestClient(create_app())
    c.headers.update({"Authorization": f"Bearer {TEST_SECRET}"})
    return c


# ── auth gate ─────────────────────────────────────────────────────────────────

class TestAuthGate:
    def test_missing_header_returns_401(self, client):
        response = client.get("/api/models", headers={"Authorization": ""})
        assert response.status_code == 401

    def test_wrong_secret_returns_401(self, client):
        response = client.get("/api/models", headers={"Authorization": "Bearer wrong"})
        assert response.status_code == 401

    def test_unconfigured_backend_returns_503(self, client, monkeypatch):
        monkeypatch.delenv("BACKEND_API_SECRET", raising=False)
        response = client.get("/api/models")
        assert response.status_code == 503

    def test_docs_are_disabled(self, client):
        # Router-level auth doesn't gate FastAPI's auto docs, so they must be off.
        for path in ("/docs", "/redoc", "/openapi.json"):
            assert client.get(path).status_code == 404


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
        with patch("backend.routes.utils.validate_hf_repo") as mock:
            mock.return_value = {"valid": True, "gpu_tier": "tl_small", "reason": "ok"}
            response = client.post("/api/validate-model", json={"repo_id": "openai-community/gpt2"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["gpu_tier"] == "tl_small"

    def test_invalid_model_returns_400(self, client):
        with patch("backend.routes.utils.validate_hf_repo") as mock:
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
        with patch("backend.main._resolve_model", return_value=(mock_cls, "openai-community/gpt2")):
            response = client.post("/api/job/spawn-lens", json={
                "model_name": "gpt2-small",
                "prompt": "The cat sat",
                "top_k": 5,
            })
        assert response.status_code == 200
        assert response.json() == {"job_id": "abc-123"}

    def test_bad_model_returns_400(self, client):
        from fastapi import HTTPException
        with patch("backend.main._resolve_model", side_effect=HTTPException(status_code=400, detail="model not found")):
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


# ── /api/job/spawn-activation-patch ──────────────────────────────────────────

class TestSpawnActivationPatch:
    def _mock_cls(self, job_id="ap-job"):
        mock_fc = MagicMock()
        mock_fc.object_id = job_id
        mock_method = MagicMock()
        mock_method.spawn = MagicMock()
        mock_method.spawn.aio = AsyncMock(return_value=mock_fc)
        mock_instance = MagicMock()
        mock_instance.run_activation_patch_result = mock_method
        return MagicMock(return_value=mock_instance)

    def test_mlp_component_with_sentinel_head_is_accepted(self, client):
        # Attribution results encode MLP components as head=-1 and the frontend
        # forwards top_k_components verbatim — the schema must not reject them.
        with patch("backend.main._resolve_model", return_value=(self._mock_cls(), "openai-community/gpt2")):
            response = client.post("/api/job/spawn-activation-patch", json={
                "model_name": "gpt2-small",
                "prompt": "clean",
                "corrupted_prompt": "corrupted",
                "target_token_idx": 1,
                "components": [
                    {"layer": 9, "component_type": "attn_head", "head": 6},
                    {"layer": 8, "component_type": "mlp", "head": -1},
                ],
            })
        assert response.status_code == 200
        assert response.json() == {"job_id": "ap-job"}


# ── /api/job/spawn-steering ──────────────────────────────────────────────────

class TestSpawnSteering:
    def test_too_many_extra_pairs_returns_422(self, client):
        response = client.post("/api/job/spawn-steering", json={
            "model_name": "gpt2-small",
            "clean_prompt": "clean",
            "corrupted_prompt": "corrupted",
            "components": [{"layer": 5}],
            "extra_pairs": [{"clean": "a", "corrupted": "b"}] * 41,  # cap is 40
        })
        assert response.status_code == 422


# ── /api/job/{job_id} GET (poll) ──────────────────────────────────────────────

def _mock_from_id(mock_fc=None, side_effect=None):
    """Routes call `await FunctionCall.from_id.aio(job_id)` — mock the .aio attr."""
    m = MagicMock()
    m.aio = AsyncMock(return_value=mock_fc, side_effect=side_effect)
    return m


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

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.get("/api/job/fake-job-id")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "done"
        assert body["data"] == done_data

    def test_running_state(self, client):
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(side_effect=TimeoutError())

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.get("/api/job/fake-job-id")

        assert response.json() == {"status": "running"}

    def test_error_state(self, client):
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(side_effect=RuntimeError("inference failed"))

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.get("/api/job/fake-job-id")

        body = response.json()
        assert body["status"] == "error"
        # Raw exception text must NOT leak to the client — only a generic message.
        assert "inference failed" not in body["error"]
        assert body["error"] == "Internal error while polling job."


# ── /api/job/{job_id} DELETE (cancel) ────────────────────────────────────────

class TestCancelJob:
    def test_cancel_returns_true(self, client):
        mock_fc = MagicMock()
        mock_fc.cancel = MagicMock()
        mock_fc.cancel.aio = AsyncMock()

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True}

    def test_cancel_graceful_on_error(self, client):
        # Even if FunctionCall raises, endpoint should return cancelled: True
        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(side_effect=Exception("already gone"))):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True}
