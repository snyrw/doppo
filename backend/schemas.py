from typing import Annotated, Literal

from pydantic import BaseModel, Field

# Coarse upper bound on any user-supplied prompt string, measured in CHARACTERS.
# This sits well above the char-length of a valid 48-token prompt and exists to
# reject abusive megabyte payloads at the schema layer before tokenization runs.
# The worker enforces the semantic limit of MAX_PROMPT_TOKENS = 48 tokens on the
# prompts it tokenizes (clean/corrupted/generation); steering extra_pairs rely on
# this char cap plus MAX_EXTRA_PAIRS below.
MAX_PROMPT_CHARS = 2000

# Steering pair cap is 100 total (seed + 99 extras) on every tier — see
# TIER_PAIR_CAPS in frontend/app/lib/tiers.ts. ~100 pairs is where DIM vectors
# stabilize (cos-sim > 0.9 between resamples); extraction passes are cheap
# relative to the generation loop. Bounds GPU work per steering request.
MAX_EXTRA_PAIRS = 99

PromptStr = Annotated[str, Field(max_length=MAX_PROMPT_CHARS)]
ModelNameStr = Annotated[str, Field(max_length=200)]


def dump_list(items: list[BaseModel] | None) -> list[dict] | None:
    """Serialize a list of Pydantic models for a Modal worker call (None-safe)."""
    return None if items is None else [i.model_dump() for i in items]


class LensRequest(BaseModel):
    prompt: PromptStr
    model_name: ModelNameStr
    top_k: int = Field(default=5, ge=1, le=100)


class DlaRequest(BaseModel):
    prompt: PromptStr
    model_name: ModelNameStr
    target_position: int | str = "last"
    target_token: str | None = None
    contrastive_token: str | None = None


class AttributionRequest(BaseModel):
    prompt: PromptStr            # clean prompt
    corrupted_prompt: PromptStr
    model_name: ModelNameStr
    target_position: int | str = "last"
    target_token: str | None = None
    contrastive_token: str | None = None
    top_n: int = Field(default=30, ge=1, le=200)


class ActivationComponent(BaseModel):
    layer: int = Field(..., ge=0)
    component_type: Literal["attn_head", "mlp"]
    # Attribution results use head = -1 as the sentinel for MLP (layer-level)
    # components, and the frontend forwards top_k_components verbatim — so -1
    # must validate here. The worker treats any non-attn_head comp as MLP.
    head: int | None = Field(default=None, ge=-1)
    # Carried through from the attribution result so the worker can echo it back
    # in the activation-patch response (ActivationCard colors cells by it). Must
    # be declared here or model_dump() drops it before the Modal call.
    attribution_score: float | None = None


class ActivationPatchRequest(BaseModel):
    prompt: PromptStr            # clean prompt
    corrupted_prompt: PromptStr
    model_name: ModelNameStr
    target_position: int | str = "last"
    target_token_idx: int = Field(..., ge=0)
    contrastive_token_idx: int | None = Field(default=None, ge=0)
    components: list[ActivationComponent]
    k: int = Field(default=10, ge=1, le=100)


class SteeringComponentRequest(BaseModel):
    # Residual-stream (resid_pre) layer the DIM vector is read from and injected
    # at. Old clients may still send head/injection_type; they are ignored.
    layer: int = Field(..., ge=0)


class SteeringPair(BaseModel):
    clean: PromptStr
    corrupted: PromptStr


class SteeringRequest(BaseModel):
    model_name: ModelNameStr
    clean_prompt: PromptStr
    corrupted_prompt: PromptStr
    generation_prompt: PromptStr | None = None  # separate probe prompt; falls back to clean_prompt
    target_position: int | str = "last"
    components: list[SteeringComponentRequest]
    alpha: float = Field(default=1.0, ge=-100.0, le=100.0)
    n_tokens: int = Field(default=50, ge=1, le=500)
    extra_pairs: list[SteeringPair] | None = Field(default=None, max_length=MAX_EXTRA_PAIRS)  # averaged into the DIM vector with the seed pair
    temperature: float = Field(default=1.0, ge=0.0, le=5.0)
    repetition_penalty: float = Field(default=1.3, ge=0.5, le=5.0)


class AttentionRequest(BaseModel):
    prompt: PromptStr
    model_name: ModelNameStr


class ValidateModelRequest(BaseModel):
    repo_id: ModelNameStr


class TokenizeRequest(BaseModel):
    model_name: ModelNameStr
    text: PromptStr
