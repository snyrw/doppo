from pydantic import BaseModel, Field

# Coarse upper bound on any user-supplied prompt string, measured in CHARACTERS.
# The worker enforces the real semantic limit of MAX_PROMPT_TOKENS = 48 tokens;
# since one token can be many characters, this sits well above the char-length of
# a valid 48-token prompt and only exists to reject abusive megabyte payloads at
# the schema layer before tokenization runs.
MAX_PROMPT_CHARS = 2000


class LensRequest(BaseModel):
    prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    model_name: str = Field(..., max_length=200)
    top_k: int = Field(default=5, ge=1, le=100)


class DlaRequest(BaseModel):
    prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    model_name: str = Field(..., max_length=200)
    target_position: int | str = "last"
    target_token: str | None = None
    contrastive_token: str | None = None


class AttributionRequest(BaseModel):
    prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)            # clean prompt
    corrupted_prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    model_name: str = Field(..., max_length=200)
    target_position: int | str = "last"
    target_token: str | None = None
    contrastive_token: str | None = None
    top_n: int = Field(default=30, ge=1, le=200)


class ActivationPatchRequest(BaseModel):
    prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)            # clean prompt
    corrupted_prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    model_name: str = Field(..., max_length=200)
    target_position: int | str = "last"
    target_token_idx: int = Field(..., ge=0)
    contrastive_token_idx: int | None = Field(default=None, ge=0)
    components: list[dict]
    k: int = Field(default=10, ge=1, le=100)


class SteeringComponentRequest(BaseModel):
    layer: int
    head: int | None = None
    injection_type: str = "residual"  # "attn_head" | "mlp" | "residual"


class SteeringRequest(BaseModel):
    model_name: str = Field(..., max_length=200)
    clean_prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    corrupted_prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    generation_prompt: str | None = Field(default=None, max_length=MAX_PROMPT_CHARS)  # separate probe prompt; falls back to clean_prompt
    target_position: int | str = "last"
    components: list[SteeringComponentRequest]
    alpha: float = Field(default=1.0, ge=-100.0, le=100.0)
    n_tokens: int = Field(default=50, ge=1, le=500)
    extra_pairs: list[dict] | None = None  # [{clean, corrupted}] for CAA-mode averaging
    temperature: float = Field(default=1.0, ge=0.0, le=5.0)
    repetition_penalty: float = Field(default=1.3, ge=0.5, le=5.0)
    method: str = "caa"  # "caa" (hook_out, anchored injection) | "actadd" (hook_in, all-position injection)


class AttentionRequest(BaseModel):
    prompt: str = Field(..., max_length=MAX_PROMPT_CHARS)
    model_name: str = Field(..., max_length=200)


class ValidateModelRequest(BaseModel):
    repo_id: str = Field(..., max_length=200)


class TokenizeRequest(BaseModel):
    model_name: str = Field(..., max_length=200)
    text: str = Field(..., max_length=MAX_PROMPT_CHARS)
