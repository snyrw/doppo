import modal


app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol-v2", create_if_missing=True, version=2)
hf_secret = modal.Secret.from_name("huggingface-secret")
# Shared bearer secret gating the web app — must define BACKEND_API_SECRET.
backend_auth_secret = modal.Secret.from_name("backend-auth-secret")

VOLUME_MOUNT = "/model-cache"
_HF_CACHE_ENV = {
    "HF_HOME": f"{VOLUME_MOUNT}/hf_home",
    "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home",
    # Reduces fragmentation-induced OOM on nearly-full GPUs.
    "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:True",
}

# TransformerBridge wraps native HuggingFace implementations, so one image covers all models.
tl_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.11.0",
        "transformer-lens==3.5.0",  # 3.5 bridges VLM text towers (Gemma3/4, LLaVA, Qwen3.5); 3.4 crashed on the Siglip vision path and hard-pinned torchvision (which exact-pinned torch down to 2.7.x)
        "transformers>=5.3.0",  # security floor: <5.3 has CVE-2026-4372 (config.json injection → RCE even with trust_remote_code=False); TL 3.5.0 already resolves >=5.4, this guards future TL pin changes
        "peft>=0.13",  # merge user-supplied LoRA/DoRA adapters onto a re-validated base at load time
        "einops==0.8.1",
        "fancy-einsum==0.0.3",
        "jaxtyping==0.3.2",
    )
    .env(_HF_CACHE_ENV)
)

web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]", "pydantic", "huggingface_hub>=0.27",
    "transformers>=5.4.0",  # tokenizer-only, no torch needed here; Gemma3 tokenizers need >=5.4
)

MAX_PROMPT_TOKENS = 48

# Shared modal.Dict where workers publish per-job stage heartbeats, keyed by
# FunctionCall ID. Written by _StageHeartbeat (inference.py), read by poll_job
# and the cancel endpoint (routes/jobs.py).
STAGE_DICT_NAME = "job-stage-heartbeat"

FEATURED_MODELS: dict[str, dict] = {
    # ── GPT-2 ────────────────────────────────────────────────────────────────
    "gpt2-small": {
        "display_name": "GPT-2 Small",
        "description": "OpenAI · 12 layers · 117M params",
        "model_id": "openai-community/gpt2",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-medium": {
        "display_name": "GPT-2 Medium",
        "description": "OpenAI · 24 layers · 345M params",
        "model_id": "openai-community/gpt2-medium",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-large": {
        "display_name": "GPT-2 Large",
        "description": "OpenAI · 36 layers · 762M params",
        "model_id": "openai-community/gpt2-large",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-xl": {
        "display_name": "GPT-2 XL",
        "description": "OpenAI · 48 layers · 1.5B params",
        "model_id": "openai-community/gpt2-xl",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    # ── Llama 3 ──────────────────────────────────────────────────────────────
    "meta-llama/Meta-Llama-3-8B": {
        "display_name": "Llama 3 (8B)",
        "description": "Meta · 32 layers · 8K ctx",
        "model_id": "meta-llama/Meta-Llama-3-8B",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "meta-llama/Llama-3.2-3B-Instruct": {
        "display_name": "Llama 3.2 Instruct (3B)",
        "description": "Meta · 28 layers · 128K ctx",
        "model_id": "meta-llama/Llama-3.2-3B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "meta-llama/Meta-Llama-3.1-8B-Instruct": {
        "display_name": "Llama 3.1 Instruct (8B)",
        "description": "Meta · 32 layers · 128K ctx",
        "model_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    # ── Qwen ─────────────────────────────────────────────────────────────────
    "Qwen/Qwen2.5-7B": {
        "display_name": "Qwen 2.5 (7B)",
        "description": "Alibaba · 28 layers · 128K ctx",
        "model_id": "Qwen/Qwen2.5-7B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen2.5-7B-Instruct": {
        "display_name": "Qwen 2.5 Instruct (7B)",
        "description": "Alibaba · 28 layers · 128K ctx",
        "model_id": "Qwen/Qwen2.5-7B-Instruct",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-0.6B": {
        "display_name": "Qwen3 (0.6B)",
        "description": "Alibaba · 28 layers · 32K ctx",
        "model_id": "Qwen/Qwen3-0.6B",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "Qwen/Qwen3-8B": {
        "display_name": "Qwen3 (8B)",
        "description": "Alibaba · 36 layers · 128K ctx",
        "model_id": "Qwen/Qwen3-8B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-14B": {
        "display_name": "Qwen3 (14B)",
        "description": "Alibaba · 40 layers · 128K ctx",
        "model_id": "Qwen/Qwen3-14B",
        "requires_hf_token": False,
        "gpu_tier": "tl_large",
    },
    # ── Gemma ────────────────────────────────────────────────────────────────
    "google/gemma-3-1b-it": {
        "display_name": "Gemma 3 (1B)",
        "description": "Google · 18 layers · 32K ctx",
        "model_id": "google/gemma-3-1b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-3-4b-it": {
        "display_name": "Gemma 3 (4B)",
        "description": "Google · 34 layers · 128K ctx",
        "model_id": "google/gemma-3-4b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-3-27b-it": {
        "display_name": "Gemma 3 (27B)",
        "description": "Google · 62 layers · 128K ctx",
        "model_id": "google/gemma-3-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_xlarge",
    },
    "google/gemma-2-2b-it": {
        "display_name": "Gemma 2 (2B)",
        "description": "Google · 26 layers · 8K ctx",
        "model_id": "google/gemma-2-2b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-2-9b-it": {
        "display_name": "Gemma 2 (9B)",
        "description": "Google · 42 layers · 8K ctx",
        "model_id": "google/gemma-2-9b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "google/gemma-2-27b-it": {
        "display_name": "Gemma 2 (27B)",
        "description": "Google · 46 layers · 8K ctx",
        "model_id": "google/gemma-2-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_xlarge",
    },
    # ── XL tier (H200) ───────────────────────────────────────────────────────
    "Qwen/Qwen3-30B": {
        "display_name": "Qwen3 (32B)",
        "description": "Alibaba · 64 layers · 128K ctx",
        "model_id": "Qwen/Qwen3-30B",
        "requires_hf_token": False,
        "gpu_tier": "tl_xlarge",
    },
    "meta-llama/Llama-3.3-70B-Instruct": {
        "display_name": "Llama 3.3 Instruct (70B)",
        "description": "Meta · 80 layers · 128K ctx",
        "model_id": "meta-llama/Llama-3.3-70B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_xxlarge",
    },
}

# ── Shared cls kwargs ─────────────────────────────────────────────────────────

_SHARED_CLS_KWARGS = dict(
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
)

# scaledown_window is tiered: expensive tiers cut off idle faster.
# timeout only bounds method execution (since modal 1.1.4 it excludes container
# startup); startup_timeout separately bounds boot — @modal.enter() download +
# load — which is otherwise unbounded billed GPU time if a boot hangs.
_TL_KWARGS = dict(
    image=tl_image,
    timeout=600,
    startup_timeout=600,   # < 4B params: download + load in well under 10 min
    scaledown_window=30,   # L4 / L40S — cheap enough to hold warm briefly
    **_SHARED_CLS_KWARGS,
)

# Large/XL models (10–70B) can take 10–20 min to download on first cold start.
_TL_LARGE_KWARGS = {**_TL_KWARGS, "timeout": 1200, "startup_timeout": 1800, "scaledown_window": 15}   # A100-80GB

# H200 is the priciest tier; cut idle time aggressively.
_TL_XLARGE_KWARGS = {**_TL_LARGE_KWARGS, "scaledown_window": 10}             # H200

# B200 is even pricier ($6.25/hr); minimize idle window to the floor.
_TL_XXLARGE_KWARGS = {**_TL_LARGE_KWARGS, "scaledown_window": 5}             # B200

