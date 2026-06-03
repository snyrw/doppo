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
