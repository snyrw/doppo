import os
import modal

from .config import (
    app, FEATURED_MODELS, web_image, hf_secret, backend_auth_secret,
    _TL_KWARGS, _TL_LARGE_KWARGS, _TL_XLARGE_KWARGS, _TL_XXLARGE_KWARGS,
)
from .inference import _TLBase
from .validation import validate_hf_repo


# ── GPU-tier Modal classes ─────────────────────────────────────────────────────

# scaledown_window_s must match each tier's scaledown_window in config.py —
# it is billed idle time, attributed to the first call on each container.

@app.cls(gpu="L4", **_TL_KWARGS)
class TransformerLensSmall(_TLBase):
    model_id: str = modal.parameter()
    scaledown_window_s = _TL_KWARGS["scaledown_window"]


@app.cls(gpu="L40S", **_TL_KWARGS)
class TransformerLensMedium(_TLBase):
    model_id: str = modal.parameter()
    scaledown_window_s = _TL_KWARGS["scaledown_window"]


@app.cls(gpu="A100-80GB", **_TL_LARGE_KWARGS)
class TransformerLensLarge(_TLBase):
    model_id: str = modal.parameter()
    scaledown_window_s = _TL_LARGE_KWARGS["scaledown_window"]


@app.cls(gpu="H200", **_TL_XLARGE_KWARGS)
class TransformerLensXLarge(_TLBase):
    model_id: str = modal.parameter()
    scaledown_window_s = _TL_XLARGE_KWARGS["scaledown_window"]


@app.cls(gpu="B200", **_TL_XXLARGE_KWARGS)
class TransformerLensXXLarge(_TLBase):
    model_id: str = modal.parameter()
    scaledown_window_s = _TL_XXLARGE_KWARGS["scaledown_window"]


# ── Routing table ──────────────────────────────────────────────────────────────

_TIER_TO_CLS = {
    "tl_small":   TransformerLensSmall,
    "tl_medium":  TransformerLensMedium,
    "tl_large":   TransformerLensLarge,
    "tl_xlarge":  TransformerLensXLarge,
    "tl_xxlarge": TransformerLensXXLarge,
}

_TIER_ORDER = ["tl_small", "tl_medium", "tl_large", "tl_xlarge", "tl_xxlarge"]


def _bump_tier(tier: str) -> str:
    """Return the next GPU tier up for memory-intensive ops (attribution, activation patch).

    Backward passes retain intermediate activations for all layers, requiring
    significantly more headroom than a forward-only run. One tier up is enough:
      tl_small   (L4, 24 GB)    → tl_medium  (L40S, 48 GB)
      tl_medium  (L40S, 48 GB)  → tl_large   (A100-80GB, 80 GB)
      tl_large   (A100-80GB)    → tl_xlarge  (H200, 141 GB)
      tl_xlarge  (H200)         → tl_xxlarge (B200, 192 GB)
      tl_xxlarge (B200)         → tl_xxlarge (ceiling, no tier above)
    """
    idx = _TIER_ORDER.index(tier)
    return _TIER_ORDER[min(idx + 1, len(_TIER_ORDER) - 1)]


def _resolve_model(model_name: str, bump: bool = False, hf_token: str | None = None):
    """Resolve a model name to a (ModalClass, hf_model_id) pair.

    Looks up FEATURED_MODELS first; falls back to validate_hf_repo for arbitrary HF IDs.
    Raises HTTPException(400) if the model is invalid.
    """
    from fastapi import HTTPException
    entry = FEATURED_MODELS.get(model_name)
    if entry is None:
        validation = validate_hf_repo(model_name, hf_token=hf_token)
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=validation["reason"])
        tier = validation["gpu_tier"]
        resolved_id = model_name
    else:
        tier = entry["gpu_tier"]
        resolved_id = entry["model_id"]
    if bump:
        tier = _bump_tier(tier)
    return _TIER_TO_CLS[tier], resolved_id


# ── FastAPI app ────────────────────────────────────────────────────────────────

def create_app():
    from fastapi import Depends, FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from .auth import require_secret
    from .routes.stream import create_router as stream_routes
    from .routes.jobs import create_router as job_routes
    from .routes.utils import create_router as util_routes

    hf_token = os.environ.get("HF_TOKEN")

    # Late-binding wrapper: looks up _resolve_model from this module's globals at
    # call time rather than capturing the function directly. This lets test patches
    # to backend.main._resolve_model take effect even on an already-created router.
    def _resolver(*a, **kw):
        return _resolve_model(*a, **kw)

    # Disable auto-generated docs: router-level dependencies don't gate /docs,
    # /redoc, or /openapi.json, which would otherwise expose the full API schema
    # to anyone with the public Modal URL.
    web_app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "https://doppo.tools"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Gate every route behind the shared bearer secret — only the Next.js proxy
    # (which authenticates the user and bills credits) may call the backend.
    guard = [Depends(require_secret)]
    web_app.include_router(util_routes(hf_token), dependencies=guard)
    web_app.include_router(stream_routes(_resolver, hf_token), dependencies=guard)
    web_app.include_router(job_routes(_resolver, hf_token), dependencies=guard)
    return web_app


@app.function(image=web_image, secrets=[hf_secret, backend_auth_secret])
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    return create_app()
