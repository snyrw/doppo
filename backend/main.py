import os
import modal

app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

VOLUME_MOUNT = "/model-cache"
_HF_CACHE_ENV = {"HF_HOME": f"{VOLUME_MOUNT}/hf_home", "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home"}

tl_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.6.0",
        "transformer-lens>=3.0",
        "einops==0.8.1",
        "fancy-einsum==0.0.3",
        "jaxtyping==0.3.2",
    )
    .env(_HF_CACHE_ENV)
)

hf_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.6.0",
        "transformers>=4.57",
        "accelerate==1.10.1",
        "safetensors==0.5.3",
        "peft>=0.18.0",
    )
    .env(_HF_CACHE_ENV)
)


# gpu_tier drives which Modal class handles a model and which model ID to pass it.
# tl_small  → L4         (<3B, GPT-2 family + sub-3B instruct models)
# tl_medium → A10G       (7–9B TransformerLens-supported models)
# hf_small  → A10G       (<8B models that need the raw HF path)
# hf_large  → A100-80GB  (14–27B models)
# hf_huge   → H100:2     (70B+, device_map="auto" across 2 GPUs)
MODEL_REGISTRY: dict[str, dict] = {
    # ── GPT-2 ────────────────────────────────────────────────────────────────
    "gpt2-small": {
        "display_name": "GPT-2 Small",
        "tl_id": "gpt2-small",
        "hf_id": "openai-community/gpt2",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-medium": {
        "display_name": "GPT-2 Medium",
        "tl_id": "gpt2-medium",
        "hf_id": "openai-community/gpt2-medium",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-large": {
        "display_name": "GPT-2 Large",
        "tl_id": "gpt2-large",
        "hf_id": "openai-community/gpt2-large",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-xl": {
        "display_name": "GPT-2 XL",
        "tl_id": "gpt2-xl",
        "hf_id": "openai-community/gpt2-xl",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    # ── Llama 3 ──────────────────────────────────────────────────────────────
    "meta-llama/Meta-Llama-3-8B": {
        "display_name": "Llama 3 (8B)",
        "tl_id": "meta-llama/Meta-Llama-3-8B",
        "hf_id": "meta-llama/Meta-Llama-3-8B",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "meta-llama/Llama-3.2-3B-Instruct": {
        "display_name": "Llama 3.2 Instruct (3B)",
        "tl_id": "meta-llama/Llama-3.2-3B-Instruct",
        "hf_id": "meta-llama/Llama-3.2-3B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "meta-llama/Meta-Llama-3.1-8B-Instruct": {
        "display_name": "Llama 3.1 Instruct (8B)",
        "tl_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "hf_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "meta-llama/Llama-3.3-70B-Instruct": {
        "display_name": "Llama 3.3 Instruct (70B)",
        "tl_id": "meta-llama/Llama-3.3-70B-Instruct",
        "hf_id": "meta-llama/Llama-3.3-70B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "hf_huge",
    },
    # ── Qwen ─────────────────────────────────────────────────────────────────
    "Qwen/Qwen2.5-7B": {
        "display_name": "Qwen 2.5 (7B)",
        "tl_id": "Qwen/Qwen2.5-7B",
        "hf_id": "Qwen/Qwen2.5-7B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen2.5-7B-Instruct": {
        "display_name": "Qwen 2.5 Instruct (7B)",
        "tl_id": "Qwen/Qwen2.5-7B-Instruct",
        "hf_id": "Qwen/Qwen2.5-7B-Instruct",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-0.6B": {
        "display_name": "Qwen3 (0.6B)",
        "tl_id": "Qwen/Qwen3-0.6B",
        "hf_id": "Qwen/Qwen3-0.6B",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "Qwen/Qwen3-8B": {
        "display_name": "Qwen3 (8B)",
        "tl_id": "Qwen/Qwen3-8B",
        "hf_id": "Qwen/Qwen3-8B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-14B": {
        "display_name": "Qwen3 (14B)",
        "tl_id": "Qwen/Qwen3-14B",
        "hf_id": "Qwen/Qwen3-14B",
        "requires_hf_token": False,
        "gpu_tier": "hf_large",
    },
    # ── Gemma ────────────────────────────────────────────────────────────────
    "google/gemma-3-1b-it": {
        "display_name": "Gemma 3 (1B)",
        "tl_id": "google/gemma-3-1b-it",
        "hf_id": "google/gemma-3-1b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-3-4b-it": {
        "display_name": "Gemma 3 (4B)",
        "tl_id": "google/gemma-3-4b-it",
        "hf_id": "google/gemma-3-4b-it",
        "requires_hf_token": True,
        "gpu_tier": "hf_small",
    },
    "google/gemma-3-27b-it": {
        "display_name": "Gemma 3 (27B)",
        "tl_id": "google/gemma-3-27b-it",
        "hf_id": "google/gemma-3-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "hf_large",
    },
    "google/gemma-2-2b-it": {
        "display_name": "Gemma 2 (2B)",
        "tl_id": "google/gemma-2-2b-it",
        "hf_id": "google/gemma-2-2b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-2-9b-it": {
        "display_name": "Gemma 2 (9B)",
        "tl_id": "google/gemma-2-9b-it",
        "hf_id": "google/gemma-2-9b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "google/gemma-2-27b-it": {
        "display_name": "Gemma 2 (27B)",
        "tl_id": "google/gemma-2-27b-it",
        "hf_id": "google/gemma-2-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "hf_large",
    },
}

web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]", "pydantic", "huggingface_hub>=0.27"
)

# Set of hf_id values that are trusted base models for PEFT adapter validation.
_KNOWN_BASE_HF_IDS: set[str] = {entry["hf_id"] for entry in MODEL_REGISTRY.values()}


def validate_hf_repo(repo_id: str, hf_token: str | None) -> dict:
    """
    Safety-check a user-supplied HuggingFace repo before loading it on GPU.

    Returns a dict with keys: valid (bool), is_peft (bool), base_model (str|None), reason (str).
    All network I/O is lightweight (file listing + small JSON downloads) — no weights fetched.
    """
    import json
    from huggingface_hub import list_repo_files, hf_hub_download
    from huggingface_hub.utils import RepositoryNotFoundError, EntryNotFoundError

    def _invalid(reason: str, is_peft: bool = False, base_model: str | None = None) -> dict:
        return {"valid": False, "is_peft": is_peft, "base_model": base_model, "reason": reason}

    try:
        files = set(list_repo_files(repo_id, token=hf_token))
    except RepositoryNotFoundError:
        return _invalid(f"Repository '{repo_id}' not found or is private (check your HF token).")
    except Exception as e:
        return _invalid(f"Could not list repo files: {e}")

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    has_pickle = any(f.endswith(".bin") or f.endswith(".pt") for f in files)
    is_peft = "adapter_config.json" in files

    if has_pickle:
        return _invalid("Repository contains pickle (.bin/.pt) files, which are unsafe to load.")

    # PEFT-only repos have no full model weights — that's fine.
    if not is_peft and not has_safetensors:
        return _invalid("No safetensors weights found. Only the safetensors format is supported.")

    if "config.json" in files:
        try:
            config_path = hf_hub_download(repo_id, "config.json", token=hf_token)
            with open(config_path) as f:
                config = json.load(f)
            if config.get("trust_remote_code"):
                return _invalid("Model config sets trust_remote_code=True, which is not allowed.")
            if "auto_map" in config:
                return _invalid("Model config contains auto_map with custom code classes, which is not allowed.")
        except EntryNotFoundError:
            pass
        except Exception as e:
            return _invalid(f"Could not read config.json: {e}")

    base_model = None
    if is_peft:
        try:
            adapter_path = hf_hub_download(repo_id, "adapter_config.json", token=hf_token)
            with open(adapter_path) as f:
                adapter_config = json.load(f)
        except Exception as e:
            return _invalid(f"Could not read adapter_config.json: {e}", is_peft=True)

        base_model = adapter_config.get("base_model_name_or_path", "")
        if base_model not in _KNOWN_BASE_HF_IDS:
            return _invalid(
                f"Adapter base model '{base_model}' is not a supported base model. "
                f"Supported bases: {sorted(_KNOWN_BASE_HF_IDS)}",
                is_peft=True,
                base_model=base_model,
            )

    return {"valid": True, "is_peft": is_peft, "base_model": base_model, "reason": "OK"}


# ── Shared cls kwargs ─────────────────────────────────────────────────────────

_SHARED_CLS_KWARGS = dict(
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
    enable_memory_snapshot=True,
)

_TL_KWARGS = dict(image=tl_image, experimental_options={"enable_gpu_snapshot": True}, **_SHARED_CLS_KWARGS)

# HF classes use only the CPU memory snapshot. GPU snapshots are incompatible
# with device_map="auto" multi-GPU layouts used by the large/huge tiers.
_HF_KWARGS = dict(image=hf_image, **_SHARED_CLS_KWARGS)


# ── Shared inference helper ───────────────────────────────────────────────────

def _gather_next_token_probs(probs, next_tokens):
    """probs: [n_layers, seq, vocab], next_tokens: [seq-1] → [n_layers, seq-1]"""
    import torch
    return torch.gather(
        probs, dim=-1,
        index=next_tokens.view(1, -1, 1).expand(probs.shape[0], -1, 1),
    ).squeeze(-1)


# ── TransformerLens inference ─────────────────────────────────────────────────

class _TLBase:
    model_id: str = modal.parameter()

    @modal.enter(snap=True)
    def load_model(self):
        import torch
        from transformer_lens import HookedTransformer

        torch.set_grad_enabled(False)

        self.model = HookedTransformer.from_pretrained_no_processing(
            self.model_id,
            center_unembed=False,
            center_writing_weights=True,
            fold_ln=True,
            refactor_factored_attn_matrices=False,
            dtype=torch.bfloat16,
        )
        self.model.eval()

        # Warm-up passes trigger CUDA kernel compilation so it's captured in the
        # GPU snapshot rather than paid as latency on the first real request.
        dummy = self.model.to_tokens("the quick brown fox")
        for _ in range(3):
            self.model(dummy)
        torch.cuda.empty_cache()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        tokens = self.model.to_tokens(prompt)
        _, cache = self.model.run_with_cache(tokens)

        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = self.model.ln_final(resid_at_layers)
        layer_logits = self.model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        next_tokens = tokens[0, 1:]
        gathered_probs = _gather_next_token_probs(layer_probs[:, :-1, :], next_tokens)

        token_strings = self.model.to_str_tokens(tokens)[1:]

        return {
            "x_labels": token_strings,
            "y_labels": labels,
            "heatmap_data": gathered_probs.float().cpu().tolist(),
        }


@app.cls(gpu="L4", **_TL_KWARGS)
class TransformerLensSmall(_TLBase):
    pass


@app.cls(gpu="A10G", **_TL_KWARGS)
class TransformerLensMedium(_TLBase):
    pass


# ── HuggingFace inference ─────────────────────────────────────────────────────

class _HFBase:
    model_id: str = modal.parameter()

    @modal.enter(snap=True)
    def load_tokenizer(self):
        # Tokenizer loading is CPU-only and safe to capture in the memory snapshot.
        from transformers import AutoTokenizer
        hf_token = os.environ.get("HF_TOKEN")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_id, token=hf_token, trust_remote_code=False
        )

    @modal.enter(snap=False)
    def load_model(self):
        # Model loading runs after snapshot restore so GPU VRAM state is never
        # snapshotted — avoids multi-GPU incompatibility and keeps snapshot files small.
        import torch
        from transformers import AutoModelForCausalLM

        torch.set_grad_enabled(False)
        hf_token = os.environ.get("HF_TOKEN")

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_id,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            token=hf_token,
            use_safetensors=True,
            trust_remote_code=False,
        )
        self.model.eval()
        self._final_ln = self._get_final_ln()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        import torch

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        input_ids = inputs["input_ids"]

        outputs = self.model(**inputs, output_hidden_states=True)

        # hidden_states: tuple of (n_layers+1) tensors [batch, seq, d_model]
        # index 0 = token embedding; indices 1..n = post-block residual streams
        hidden_states = outputs.hidden_states
        stacked = torch.stack([h[0] for h in hidden_states])  # [n_layers+1, seq, d_model]

        normed = self._final_ln(stacked)
        logits = self.model.lm_head(normed)
        probs = logits.softmax(dim=-1)

        next_tokens = input_ids[0, 1:]
        gathered = _gather_next_token_probs(probs[:, :-1, :], next_tokens)

        n_real_layers = len(hidden_states) - 1
        labels = ["embedding"] + [f"blocks.{i}.hook_resid_post" for i in range(n_real_layers)]

        token_strings = self.tokenizer.convert_ids_to_tokens(input_ids[0, 1:].tolist())
        token_strings = [t.replace("Ġ", " ").replace("Ċ", "\n") for t in token_strings]

        return {
            "x_labels": token_strings,
            "y_labels": labels,
            "heatmap_data": gathered.float().cpu().tolist(),
        }
    
    def _get_final_ln(self):
        # Standard for Llama, Qwen2, Mistral, Gemma: model.model.norm
        inner = getattr(self.model, "model", None)
        if inner is not None:
            norm = getattr(inner, "norm", None)
            if norm is not None:
                return norm
        # GPT-NeoX style
        gpt_neox = getattr(self.model, "gpt_neox", None)
        if gpt_neox is not None:
            return gpt_neox.final_layer_norm
        # OPT style
        decoder = getattr(inner, "decoder", None)
        if decoder is not None:
            ln = getattr(decoder, "final_layer_norm", None)
            if ln is not None:
                return ln
        raise RuntimeError(
            f"Cannot locate final LayerNorm for {self.model_id}. "
            "Add a case to _get_final_ln()."
        )


@app.cls(gpu="A10G", **_HF_KWARGS)
class HFSmall(_HFBase):
    pass


@app.cls(gpu="A100-80GB", **_HF_KWARGS)
class HFLarge(_HFBase):
    pass


# Llama 70B is ~140 GB bfloat16 and requires 2× H100 (160 GB total VRAM).
@app.cls(gpu="H100:2", **_HF_KWARGS)
class HFHuge(_HFBase):
    pass


# ── Routing table ─────────────────────────────────────────────────────────────

_TIER_TO_CLS = {
    "tl_small": TransformerLensSmall,
    "tl_medium": TransformerLensMedium,
    "hf_small": HFSmall,
    "hf_large": HFLarge,
    "hf_huge": HFHuge,
}


@app.function(image=web_image)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    web_app = FastAPI()
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class LogitLensRequest(BaseModel):
        prompt: str
        model_name: str
        top_k: int = 5

    class ValidateModelRequest(BaseModel):
        repo_id: str

    hf_token = os.environ.get("HF_TOKEN")

    @web_app.get("/api/models")
    def list_models():
        return [
            {
                "id": key,
                "display_name": entry["display_name"],
                "requires_hf_token": entry["requires_hf_token"],
            }
            for key, entry in MODEL_REGISTRY.items()
        ]

    @web_app.post("/api/validate-model")
    def validate_model(request: ValidateModelRequest):
        result = validate_hf_repo(request.repo_id, hf_token=hf_token)
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["reason"])
        return result

    @web_app.post("/api/run-lens")
    async def run_logit_lens(request: LogitLensRequest):
        entry = MODEL_REGISTRY.get(request.model_name)

        # Custom (user-supplied) repo — not in the registry.
        # Default to HFLarge (A100-80GB) since the model size is unknown.
        if entry is None:
            validation = validate_hf_repo(request.model_name, hf_token=hf_token)
            if not validation["valid"]:
                raise HTTPException(status_code=400, detail=validation["reason"])
            cls, model_id = HFLarge, request.model_name
        else:
            tier = entry["gpu_tier"]
            cls = _TIER_TO_CLS[tier]
            model_id = entry["tl_id"] if tier.startswith("tl_") else entry["hf_id"]

        try:
            result = await cls(model_id=model_id).run_logit_lens.remote.aio(request.prompt)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return result

    return web_app
