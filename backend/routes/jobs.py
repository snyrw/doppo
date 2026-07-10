import asyncio
import logging
import time

import modal
import modal.exception
from fastapi import APIRouter

from ..config import STAGE_DICT_NAME
from ..errors import UserFacingError
from ..schemas import (
    LensRequest, DlaRequest, AttributionRequest,
    ActivationPatchRequest, SteeringRequest, AttentionRequest,
    dump_list,
)

_MAX_ERROR_CHARS = 300

# Lazy handle to the stage-heartbeat Dict written by _StageHeartbeat
# (inference.py). from_name is lazy — no network until first use.
_stage_dict = None


async def _read_stage(job_id: str) -> dict | None:
    """Fetch the worker's heartbeat entry for a running job, or None. Best-effort
    with a short timeout — a slow Dict must not slow every poll."""
    global _stage_dict
    try:
        if _stage_dict is None:
            _stage_dict = modal.Dict.from_name(STAGE_DICT_NAME, create_if_missing=True)
        info = await asyncio.wait_for(_stage_dict.get.aio(job_id), timeout=2.0)
    except Exception:
        return None
    return info if isinstance(info, dict) else None


# A boot entry older than this belongs to a crashed or finished container.
_BOOT_STALE_S = 45


async def _write_boot_pointer(job_id: str, model_id: str, revision: str) -> None:
    """Best-effort spawn-time pointer: lets poll_job follow a queued job to its
    model's boot heartbeat before the worker's own heartbeat exists. The worker
    later overwrites this entry (same key) with real stages."""
    global _stage_dict
    try:
        if _stage_dict is None:
            _stage_dict = modal.Dict.from_name(STAGE_DICT_NAME, create_if_missing=True)
        await asyncio.wait_for(
            _stage_dict.put.aio(
                job_id, {"boot_key": f"boot:{model_id}:{revision}", "ts": time.time()}
            ),
            timeout=2.0,
        )
    except Exception:
        pass


def _user_error_message(e: Exception) -> str | None:
    """Map a failed FunctionCall's exception to a message safe to show the user,
    or None for anything unrecognized (caller falls back to a generic message).

    Modal re-raises the worker's original exception type when it can, so
    UserFacingError (validation, load failure) comes through intact with its
    user-written message. Torch exceptions can't deserialize in the web image
    (no torch installed), so OOM is matched on the message string instead of
    the type — but the relayed text is canned, never the raw exception."""
    msg = str(e)
    low = msg.lower()
    if "out of memory" in low or "outofmemory" in low:
        return (
            "The GPU ran out of memory running this job — the model doesn't fit "
            "its assigned tier. Try a smaller model or a shorter prompt."
        )
    if isinstance(e, modal.exception.FunctionTimeoutError):
        return "The job exceeded the GPU time limit and was stopped."
    if isinstance(e, modal.exception.InputCancellation):
        return "The job was cancelled."
    if isinstance(e, UserFacingError) and msg:
        return msg[:_MAX_ERROR_CHARS]
    return None


def create_router(resolve_model, hf_token):
    router = APIRouter()

    @router.post("/api/job/spawn-lens")
    async def spawn_lens(request: LensRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=False, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_logit_lens_result.spawn.aio(request.prompt, request.top_k)
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-attn")
    async def spawn_attn(request: AttentionRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=False, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_attn_result.spawn.aio(request.prompt)
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-dla")
    async def spawn_dla(request: DlaRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=False, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_dla_result.spawn.aio(
            request.prompt, request.target_position,
            request.target_token, request.contrastive_token,
        )
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-attribution")
    async def spawn_attribution(request: AttributionRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=True, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_attribution_result.spawn.aio(
            request.prompt, request.corrupted_prompt, request.target_position,
            request.target_token, request.contrastive_token, request.top_n,
        )
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-activation-patch")
    async def spawn_activation_patch(request: ActivationPatchRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=True, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_activation_patch_result.spawn.aio(
            request.prompt, request.corrupted_prompt, request.target_position,
            request.target_token_idx, request.contrastive_token_idx,
            dump_list(request.components), request.k,
        )
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-steering")
    async def spawn_steering(request: SteeringRequest):
        cls, model_id, revision, base_id, base_revision = resolve_model(
            request.model_name, bump=False, hf_token=hf_token
        )
        fc = await cls(
            model_id=model_id, revision=revision, base_id=base_id, base_revision=base_revision
        ).run_steering_result.spawn.aio(
            request.clean_prompt, request.corrupted_prompt, request.target_position,
            dump_list(request.components), request.alpha,
            request.n_tokens, dump_list(request.extra_pairs), request.temperature,
            request.repetition_penalty, request.generation_prompt,
        )
        await _write_boot_pointer(fc.object_id, model_id, revision)
        return {"job_id": fc.object_id}

    @router.get("/api/job/{job_id}")
    async def poll_job(job_id: str):
        try:
            fc = await modal.functions.FunctionCall.from_id.aio(job_id)
            result = await fc.get.aio(timeout=0)
            # New result wrappers return {"data", "duration_ms", "cpu_core_s",
            # "mem_gib_s"}; jobs spawned before that deploy return the bare
            # data dict.
            if isinstance(result, dict) and set(result.keys()) == {"data", "duration_ms", "cpu_core_s", "mem_gib_s"}:
                return {"status": "done", **result}
            return {"status": "done", "data": result}
        except TimeoutError:
            info = await _read_stage(job_id)
            now = time.time()
            if info is None:
                # Pre-pointer job, or the spawn-time Dict write failed.
                return {"status": "running"}
            if info.get("stage"):
                return {
                    "status": "running",
                    "stage": info.get("stage"),
                    "stage_age_s": round(now - float(info.get("ts", now)), 1),
                }
            boot_key = info.get("boot_key")
            if boot_key:
                boot = await _read_stage(boot_key)
                if (
                    boot is not None
                    and boot.get("stage")
                    and now - float(boot.get("ts", 0)) <= _BOOT_STALE_S
                ):
                    return {
                        "status": "running",
                        "stage": boot["stage"],
                        "stage_age_s": round(now - float(boot["ts"]), 1),
                        "progress": boot.get("progress"),
                    }
                # No container is loading this model yet (or its boot entry
                # went stale): truthfully queued.
                return {"status": "running", "stage": "queued", "stage_age_s": None}
            return {"status": "running"}
        except Exception as e:
            logging.exception("poll_job failed for job_id=%s", job_id)
            return {
                "status": "error",
                "error": _user_error_message(e) or "Internal error while polling job.",
            }

    @router.delete("/api/job/{job_id}")
    async def cancel_job_endpoint(job_id: str):
        # Grab the heartbeat before killing the job: started_ts tells the web
        # layer when execution actually began, so cancelled jobs are billed for
        # GPU time used — not for queue time waiting on a container. The kill
        # is SIGKILL-abrupt, so the worker's own clear() never runs; pop here.
        exec_started_ts: float | None = None
        info = await _read_stage(job_id)
        if info is not None:
            ts = info.get("started_ts")
            exec_started_ts = float(ts) if isinstance(ts, (int, float)) else None
            try:
                await _stage_dict.pop.aio(job_id)
            except Exception:
                pass
        try:
            fc = await modal.functions.FunctionCall.from_id.aio(job_id)
            # Default cancel interrupts running code by raising InputCancellation
            # in the task, but that's best-effort — code blocked in native/CUDA
            # kernels can miss it and keep burning GPU until the Modal timeout.
            # terminate_containers=True kills the container outright: a guaranteed
            # stop, at the cost of a cold boot for the tier's next job.
            await fc.cancel.aio(terminate_containers=True)
        except Exception:
            pass
        return {"cancelled": True, "exec_started_ts": exec_started_ts}

    return router
