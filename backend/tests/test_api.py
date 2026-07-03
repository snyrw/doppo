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
            mock.return_value = {"valid": True, "gpu_tier": "tl_small", "reason": "ok", "revision": "abc123"}
            response = client.post("/api/validate-model", json={"repo_id": "openai-community/gpt2"})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["gpu_tier"] == "tl_small"
        assert data["revision"] == "abc123"

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
        with patch("backend.main._resolve_model", return_value=(mock_cls, "openai-community/gpt2", "main", "", "main")), \
             patch("backend.routes.jobs._write_boot_pointer", new=AsyncMock()) as ptr:
            response = client.post("/api/job/spawn-lens", json={
                "model_name": "gpt2-small",
                "prompt": "The cat sat",
                "top_k": 5,
            })
        assert response.status_code == 200
        assert response.json() == {"job_id": "abc-123"}
        ptr.assert_awaited_once_with("abc-123", "openai-community/gpt2", "main")

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
        with patch("backend.main._resolve_model", return_value=(self._mock_cls(), "openai-community/gpt2", "main", "", "main")):
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

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)), \
             patch("backend.routes.jobs._read_stage", AsyncMock(return_value=None)):
            response = client.get("/api/job/fake-job-id")

        assert response.json() == {"status": "running"}

    def test_running_state_includes_heartbeat_stage(self, client):
        import time

        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(side_effect=TimeoutError())
        beat = {"stage": "forward_pass", "ts": time.time() - 3, "started_ts": time.time() - 30}

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)), \
             patch("backend.routes.jobs._read_stage", AsyncMock(return_value=beat)):
            response = client.get("/api/job/fake-job-id")

        body = response.json()
        assert body["status"] == "running"
        assert body["stage"] == "forward_pass"
        assert 2.5 <= body["stage_age_s"] <= 10

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

    def test_oom_error_maps_to_canned_message(self, client):
        # Torch OOM can't deserialize in the web image, so it's matched on the
        # message string — the relayed text is canned, not the raw exception.
        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(
            side_effect=Exception("CUDA out of memory. Tried to allocate 20.00 GiB")
        )

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.get("/api/job/fake-job-id")

        body = response.json()
        assert body["status"] == "error"
        assert "ran out of memory" in body["error"]
        assert "20.00 GiB" not in body["error"]

    def test_user_facing_error_message_relayed(self, client):
        from backend.errors import UserFacingError

        mock_fc = MagicMock()
        mock_fc.get = MagicMock()
        mock_fc.get.aio = AsyncMock(
            side_effect=UserFacingError("Prompt too long: 99 tokens (max 48). Shorten your prompt.")
        )

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)):
            response = client.get("/api/job/fake-job-id")

        body = response.json()
        assert body["status"] == "error"
        assert body["error"] == "Prompt too long: 99 tokens (max 48). Shorten your prompt."


# ── /api/job/{job_id} DELETE (cancel) ────────────────────────────────────────

class TestCancelJob:
    def test_cancel_returns_true(self, client):
        mock_fc = MagicMock()
        mock_fc.cancel = MagicMock()
        mock_fc.cancel.aio = AsyncMock()

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)), \
             patch("backend.routes.jobs._read_stage", AsyncMock(return_value=None)):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        # exec_started_ts None: no heartbeat, so the job never began executing —
        # the web layer bills nothing for it.
        assert response.json() == {"cancelled": True, "exec_started_ts": None}
        # Must kill the container, not just mark the input terminated — a sync
        # method mid-execution keeps burning GPU otherwise.
        mock_fc.cancel.aio.assert_awaited_once_with(terminate_containers=True)

    def test_cancel_returns_exec_start_from_heartbeat(self, client):
        mock_fc = MagicMock()
        mock_fc.cancel = MagicMock()
        mock_fc.cancel.aio = AsyncMock()
        beat = {"stage": "computing", "ts": 1000.5, "started_ts": 990.0}

        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(mock_fc)), \
             patch("backend.routes.jobs._read_stage", AsyncMock(return_value=beat)):
            response = client.delete("/api/job/fake-job-id")

        body = response.json()
        assert body["cancelled"] is True
        assert body["exec_started_ts"] == 990.0

    def test_cancel_graceful_on_error(self, client):
        # Even if FunctionCall raises, endpoint should return cancelled: True
        with patch("modal.functions.FunctionCall.from_id", _mock_from_id(side_effect=Exception("already gone"))), \
             patch("backend.routes.jobs._read_stage", AsyncMock(return_value=None)):
            response = client.delete("/api/job/fake-job-id")

        assert response.status_code == 200
        assert response.json() == {"cancelled": True, "exec_started_ts": None}


# ── /api/job/{id} poll: boot-stage relay ─────────────────────────────────────

def _timeout_fc():
    """A FunctionCall whose result isn't ready yet."""
    fc = MagicMock()
    fc.get = MagicMock()
    fc.get.aio = AsyncMock(side_effect=TimeoutError())
    return fc


def _patch_poll(entries):
    """Patch FunctionCall.from_id → pending call, and _read_stage → dict lookup."""
    from_id = MagicMock()
    from_id.aio = AsyncMock(return_value=_timeout_fc())
    read_stage = AsyncMock(side_effect=lambda key: entries.get(key))
    return (
        patch("backend.routes.jobs.modal.functions.FunctionCall.from_id", from_id),
        patch("backend.routes.jobs._read_stage", read_stage),
    )


class TestPollJobStages:
    def test_worker_stage_wins(self, client):
        import time
        entries = {"job-1": {"stage": "forward_pass", "ts": time.time(), "started_ts": time.time()}}
        p1, p2 = _patch_poll(entries)
        with p1, p2:
            r = client.get("/api/job/job-1")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "running"
        assert body["stage"] == "forward_pass"

    def test_pointer_with_fresh_boot_entry_relays_progress(self, client):
        import time
        entries = {
            "job-1": {"boot_key": "boot:openai-community/gpt2:abc", "ts": time.time()},
            "boot:openai-community/gpt2:abc": {
                "stage": "downloading_weights",
                "ts": time.time(),
                "progress": {"done_bytes": 1000, "total_bytes": 5000},
            },
        }
        p1, p2 = _patch_poll(entries)
        with p1, p2:
            body = client.get("/api/job/job-1").json()
        assert body["stage"] == "downloading_weights"
        assert body["progress"] == {"done_bytes": 1000, "total_bytes": 5000}

    def test_pointer_with_stale_boot_entry_is_queued(self, client):
        import time
        entries = {
            "job-1": {"boot_key": "boot:m:r", "ts": time.time()},
            "boot:m:r": {"stage": "loading_model", "ts": time.time() - 120,
                         "progress": {"done_bytes": 1, "total_bytes": 2}},
        }
        p1, p2 = _patch_poll(entries)
        with p1, p2:
            body = client.get("/api/job/job-1").json()
        assert body["stage"] == "queued"
        assert body.get("progress") is None

    def test_pointer_with_no_boot_entry_is_queued(self, client):
        import time
        entries = {"job-1": {"boot_key": "boot:m:r", "ts": time.time()}}
        p1, p2 = _patch_poll(entries)
        with p1, p2:
            body = client.get("/api/job/job-1").json()
        assert body["stage"] == "queued"

    def test_no_entry_at_all_is_bare_running(self, client):
        p1, p2 = _patch_poll({})
        with p1, p2:
            body = client.get("/api/job/job-1").json()
        assert body == {"status": "running"}
