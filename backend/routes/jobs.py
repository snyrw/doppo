import modal
from fastapi import APIRouter

from ..schemas import (
    LensRequest, DlaRequest, AttributionRequest,
    ActivationPatchRequest, SteeringRequest, AttentionRequest,
)


def create_router(resolve_model, hf_token):
    router = APIRouter()

    @router.post("/api/job/spawn-lens")
    async def spawn_lens(request: LensRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_logit_lens_result.spawn.aio(
            request.prompt, request.top_k
        )
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-attn")
    async def spawn_attn(request: AttentionRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_attn_result.spawn.aio(request.prompt)
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-dla")
    async def spawn_dla(request: DlaRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_dla_result.spawn.aio(
            request.prompt, request.target_position,
            request.target_token, request.contrastive_token,
        )
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-attribution")
    async def spawn_attribution(request: AttributionRequest):
        cls, model_id = resolve_model(request.model_name, bump=True, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_attribution_result.spawn.aio(
            request.prompt, request.corrupted_prompt, request.target_position,
            request.target_token, request.contrastive_token, request.top_n,
        )
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-activation-patch")
    async def spawn_activation_patch(request: ActivationPatchRequest):
        cls, model_id = resolve_model(request.model_name, bump=True, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_activation_patch_result.spawn.aio(
            request.prompt, request.corrupted_prompt, request.target_position,
            request.target_token_idx, request.contrastive_token_idx,
            request.components, request.k,
        )
        return {"job_id": fc.object_id}

    @router.post("/api/job/spawn-steering")
    async def spawn_steering(request: SteeringRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)
        fc = await cls(model_id=model_id).run_steering_result.spawn.aio(
            request.clean_prompt, request.corrupted_prompt, request.target_position,
            [c.model_dump() for c in request.components], request.alpha,
            request.n_tokens, request.extra_pairs, request.temperature,
            request.repetition_penalty, request.generation_prompt,
            request.method,
        )
        return {"job_id": fc.object_id}

    @router.get("/api/job/{job_id}")
    async def poll_job(job_id: str):
        try:
            fc = modal.functions.FunctionCall.from_id(job_id)
            result = await fc.get.aio(timeout=0)
            return {"status": "done", "data": result}
        except TimeoutError:
            return {"status": "running"}
        except Exception as e:
            return {"status": "error", "error": str(e)}

    @router.delete("/api/job/{job_id}")
    async def cancel_job_endpoint(job_id: str):
        try:
            fc = modal.functions.FunctionCall.from_id(job_id)
            await fc.cancel.aio()
        except Exception:
            pass
        return {"cancelled": True}

    return router
