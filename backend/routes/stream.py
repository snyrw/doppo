from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..schemas import (
    LensRequest, DlaRequest, AttributionRequest,
    ActivationPatchRequest, SteeringRequest, AttentionRequest,
)
from ..config import _sse_error


def create_router(resolve_model, hf_token):
    router = APIRouter()

    @router.post("/api/run-lens-stream")
    async def run_logit_lens_stream(request: LensRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_logit_lens.remote_gen.aio(
                    request.prompt, request.top_k
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @router.post("/api/run-dla-stream")
    async def run_dla_stream(request: DlaRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_dla.remote_gen.aio(
                    request.prompt, request.target_position,
                    request.target_token, request.contrastive_token,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @router.post("/api/run-attribution-stream")
    async def run_attribution_stream(request: AttributionRequest):
        cls, model_id = resolve_model(request.model_name, bump=True, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_attribution.remote_gen.aio(
                    request.prompt, request.corrupted_prompt, request.target_position,
                    request.target_token, request.contrastive_token, request.top_n,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @router.post("/api/run-activation-patch-stream")
    async def run_activation_patch_stream(request: ActivationPatchRequest):
        cls, model_id = resolve_model(request.model_name, bump=True, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_activation_patch.remote_gen.aio(
                    request.prompt, request.corrupted_prompt, request.target_position,
                    request.target_token_idx, request.contrastive_token_idx,
                    [c.model_dump() for c in request.components], request.k,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @router.post("/api/run-steering-stream")
    async def run_steering_stream(request: SteeringRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_steering.remote_gen.aio(
                    request.clean_prompt, request.corrupted_prompt, request.target_position,
                    [c.model_dump() for c in request.components], request.alpha,
                    request.n_tokens,
                    [p.model_dump() for p in request.extra_pairs] if request.extra_pairs else None,
                    request.temperature,
                    request.repetition_penalty, request.generation_prompt,
                    request.method,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @router.post("/api/run-attn-stream")
    async def run_attn_stream(request: AttentionRequest):
        cls, model_id = resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_attn.remote_gen.aio(
                    request.prompt,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return router
