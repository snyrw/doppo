import os
import modal

app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

VOLUME_MOUNT = "/model-cache"
_HF_CACHE_ENV = {"HF_HOME": f"{VOLUME_MOUNT}/hf_home", "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home"}

# TransformerBridge wraps native HuggingFace implementations, so one image covers all models.
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


# gpu_tier drives which Modal class handles a model.
# tl_small  → L4         (<4B, GPT-2 family + sub-4B instruct models)
# tl_medium → A10G       (7–9B models)
# tl_large  → A100-80GB  (14–27B models)
FEATURED_MODELS: dict[str, dict] = {
    # ── GPT-2 ────────────────────────────────────────────────────────────────
    "gpt2-small": {
        "display_name": "GPT-2 Small",
        "description": "The classic 12-layer baseline. Fast cold starts, great for first experiments.",
        "model_id": "openai-community/gpt2",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-medium": {
        "display_name": "GPT-2 Medium",
        "description": "24 layers, 345M params. More depth than Small without much extra cost.",
        "model_id": "openai-community/gpt2-medium",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-large": {
        "display_name": "GPT-2 Large",
        "description": "36 layers, 762M params. Mid-range GPT-2 variant.",
        "model_id": "openai-community/gpt2-large",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "gpt2-xl": {
        "display_name": "GPT-2 XL",
        "description": "48 layers, 1.5B params. The largest GPT-2 variant.",
        "model_id": "openai-community/gpt2-xl",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    # ── Llama 3 ──────────────────────────────────────────────────────────────
    "meta-llama/Meta-Llama-3-8B": {
        "display_name": "Llama 3 (8B)",
        "description": "Meta's 8B base model. 32 layers, strong general-purpose representations.",
        "model_id": "meta-llama/Meta-Llama-3-8B",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "meta-llama/Llama-3.2-3B-Instruct": {
        "display_name": "Llama 3.2 Instruct (3B)",
        "description": "Compact 3B instruction-tuned model. Fits on L4, fast turnaround.",
        "model_id": "meta-llama/Llama-3.2-3B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "meta-llama/Meta-Llama-3.1-8B-Instruct": {
        "display_name": "Llama 3.1 Instruct (8B)",
        "description": "8B instruction-tuned variant with improved following behavior.",
        "model_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    # Llama 3.3 70B removed: TransformerBridge 3.0 does not yet support multi-GPU
    # (device_map="auto"). Re-add when TransformerLens ships multi-device support.
    # ── Qwen ─────────────────────────────────────────────────────────────────
    "Qwen/Qwen2.5-7B": {
        "display_name": "Qwen 2.5 (7B)",
        "description": "Alibaba's 7B base model with strong multilingual representations.",
        "model_id": "Qwen/Qwen2.5-7B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen2.5-7B-Instruct": {
        "display_name": "Qwen 2.5 Instruct (7B)",
        "description": "Instruction-tuned Qwen 2.5. Useful for comparing base vs. fine-tuned internals.",
        "model_id": "Qwen/Qwen2.5-7B-Instruct",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-0.6B": {
        "display_name": "Qwen3 (0.6B)",
        "description": "Smallest supported model. Near-instant results, ideal for quick iteration.",
        "model_id": "Qwen/Qwen3-0.6B",
        "requires_hf_token": False,
        "gpu_tier": "tl_small",
    },
    "Qwen/Qwen3-8B": {
        "display_name": "Qwen3 (8B)",
        "description": "Latest Qwen generation at 8B. Competitive with Llama 3 class models.",
        "model_id": "Qwen/Qwen3-8B",
        "requires_hf_token": False,
        "gpu_tier": "tl_medium",
    },
    "Qwen/Qwen3-14B": {
        "display_name": "Qwen3 (14B)",
        "description": "40 layers, 14B params. Largest Qwen3 on a single A100.",
        "model_id": "Qwen/Qwen3-14B",
        "requires_hf_token": False,
        "gpu_tier": "tl_large",
    },
    # ── Gemma ────────────────────────────────────────────────────────────────
    "google/gemma-3-1b-it": {
        "display_name": "Gemma 3 (1B)",
        "description": "Google's smallest Gemma 3. Fast and instruction-tuned.",
        "model_id": "google/gemma-3-1b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-3-4b-it": {
        "display_name": "Gemma 3 (4B)",
        "description": "4B instruction-tuned Gemma 3. Good balance of speed and capability.",
        "model_id": "google/gemma-3-4b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-3-27b-it": {
        "display_name": "Gemma 3 (27B)",
        "description": "Google's largest single-GPU model. 62 layers on an A100-80GB.",
        "model_id": "google/gemma-3-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_large",
    },
    "google/gemma-2-2b-it": {
        "display_name": "Gemma 2 (2B)",
        "description": "Compact 2B Gemma 2. Quick results with decent layer depth.",
        "model_id": "google/gemma-2-2b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_small",
    },
    "google/gemma-2-9b-it": {
        "display_name": "Gemma 2 (9B)",
        "description": "9B Gemma 2 with 42 layers. Strong representations for interpretability.",
        "model_id": "google/gemma-2-9b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_medium",
    },
    "google/gemma-2-27b-it": {
        "display_name": "Gemma 2 (27B)",
        "description": "46 layers, 27B params. Largest Gemma 2 on a single GPU.",
        "model_id": "google/gemma-2-27b-it",
        "requires_hf_token": True,
        "gpu_tier": "tl_large",
    },
}

web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]", "pydantic", "huggingface_hub>=0.27"
)

def _detect_gpu_tier(config: dict) -> str:
    """
    Estimate GPU tier from a model's config.json.
    Falls back to tl_large when the model is too large for a cheaper tier or size is unknown.
    Returns None if the model exceeds the single-GPU limit (~30B).
    """
    num_params = config.get("num_parameters")
    if isinstance(num_params, (int, float)):
        if num_params < 4e9:
            return "tl_small"
        if num_params < 12e9:
            return "tl_medium"
        if num_params < 30e9:
            return "tl_large"
        return None  # exceeds single-GPU limit

    # Proxy: num_hidden_layers × hidden_size scales predictably with model size.
    layers = config.get("num_hidden_layers", 0)
    hidden = config.get("hidden_size", 0)
    proxy = layers * hidden
    if proxy and proxy < 100_000:
        return "tl_small"
    if proxy and proxy < 200_000:
        return "tl_medium"
    if proxy and proxy < 400_000:
        return "tl_large"
    if proxy:
        return None  # likely 70B+

    return "tl_large"  # unknown shape — conservative fallback


def validate_hf_repo(repo_id: str, hf_token: str | None) -> dict:
    """
    Safety-check a user-supplied HuggingFace repo before loading it on GPU.

    Returns a dict with keys: valid (bool), gpu_tier (str|None), reason (str).
    All network I/O is lightweight (file listing + small JSON downloads) — no weights fetched.
    """
    import json
    from huggingface_hub import list_repo_files, hf_hub_download
    from huggingface_hub.utils import RepositoryNotFoundError, EntryNotFoundError

    def _invalid(reason: str) -> dict:
        return {"valid": False, "gpu_tier": None, "reason": reason}

    try:
        files = set(list_repo_files(repo_id, token=hf_token))
    except RepositoryNotFoundError:
        return _invalid(f"Repository '{repo_id}' not found or is private (check your HF token).")
    except Exception as e:
        return _invalid(f"Could not list repo files: {e}")

    if "adapter_config.json" in files:
        return _invalid(
            "LoRA/PEFT adapters are not supported — upload the merged full-weight model instead."
        )

    has_pickle = any(f.endswith(".bin") or f.endswith(".pt") for f in files)
    if has_pickle:
        return _invalid("Repository contains pickle (.bin/.pt) files, which are unsafe to load.")

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    if not has_safetensors:
        return _invalid("No safetensors weights found. Only the safetensors format is supported.")

    gpu_tier = "tl_large"  # conservative default if config.json is absent
    if "config.json" in files:
        try:
            config_path = hf_hub_download(repo_id, "config.json", token=hf_token)
            with open(config_path) as f:
                config = json.load(f)
            if config.get("trust_remote_code"):
                return _invalid("Model config sets trust_remote_code=True, which is not allowed.")
            if "auto_map" in config:
                return _invalid("Model config contains auto_map with custom code classes, which is not allowed.")
            detected = _detect_gpu_tier(config)
            if detected is None:
                return _invalid(
                    "Model appears to exceed ~30B parameters. Multi-GPU is not yet supported — "
                    "choose a smaller model."
                )
            gpu_tier = detected
        except EntryNotFoundError:
            pass
        except Exception as e:
            return _invalid(f"Could not read config.json: {e}")

    return {"valid": True, "gpu_tier": gpu_tier, "reason": "OK"}


# ── Shared cls kwargs ─────────────────────────────────────────────────────────

_SHARED_CLS_KWARGS = dict(
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
    enable_memory_snapshot=True,
)

# All classes use a single GPU, so GPU snapshots are safe across the board.
_TL_KWARGS = dict(image=tl_image, experimental_options={"enable_gpu_snapshot": True}, **_SHARED_CLS_KWARGS)


# ── Shared inference helper ───────────────────────────────────────────────────

def _gather_next_token_probs(probs, next_tokens):
    """probs: [n_layers, seq, vocab], next_tokens: [seq-1] → [n_layers, seq-1]"""
    import torch
    return torch.gather(
        probs, dim=-1,
        index=next_tokens.view(1, -1, 1).expand(probs.shape[0], -1, 1),
    ).squeeze(-1)


# ── TransformerBridge inference ───────────────────────────────────────────────

class _TLBase:
    model_id: str  # declared on each concrete subclass via modal.parameter()

    @modal.enter(snap=True)
    def load_model(self):
        import torch
        from transformer_lens.model_bridge import TransformerBridge

        torch.set_grad_enabled(False)

        self.model = TransformerBridge.boot_transformers(
            self.model_id,
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
    def run_dla(self, prompt: str, target_position: int | str = "last", target_token: str | None = None):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        tokens = self.model.to_tokens(prompt)
        pos = int(tokens.shape[-1]) - 1 if target_position == "last" else int(target_position)

        yield json.dumps({"stage": "forward_pass"})
        _, cache = self.model.run_with_cache(tokens)

        yield json.dumps({"stage": "computing"})

        n_layers = self.model.cfg.n_layers
        n_heads = self.model.cfg.n_heads

        # Resolve target token: argmax of final logits or user-specified string.
        # TL3: use full string hook names; to_single_token() is gone — tokenize directly.
        if target_token is None:
            final_resid = cache[f"blocks.{n_layers - 1}.hook_resid_post"]  # [batch, seq, d_model]
            final_logits = self.model.unembed(self.model.ln_final(final_resid))
            target_idx = int(final_logits[0, pos].argmax())
        else:
            ids = self.model.to_tokens(target_token, prepend_bos=False)
            target_idx = int(ids[0, 0])
        resolved_token = self.model.tokenizer.decode([target_idx])

        # Logit direction: W_U column for the target token → [d_model]
        logit_dir = self.model.W_U[:, target_idx].float()

        # Head-level DLA: [n_layers][n_heads]
        # TL3 exposes hook_z (pre-W_O, shape [batch, seq, n_heads, d_head]) but not
        # hook_result (post-W_O per head). Compute head results manually: z @ W_O.
        W_O = self.model.W_O  # [n_layers, n_heads, d_head, d_model]
        head_dla = []
        for layer in range(n_layers):
            z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()  # [n_heads, d_head]
            head_results = torch.einsum("hd,hdm->hm", z, W_O[layer].float())  # [n_heads, d_model]
            head_dla.append((head_results @ logit_dir).cpu().tolist())

        # Layer-level DLA: attn_out + mlp_out per layer
        layer_dla = []
        for layer in range(n_layers):
            attn_out = cache[f"blocks.{layer}.hook_attn_out"][0, pos].float()  # [d_model]
            mlp_out = cache[f"blocks.{layer}.hook_mlp_out"][0, pos].float()    # [d_model]
            layer_dla.append(float((attn_out + mlp_out) @ logit_dir))

        y_labels = [f"L{i}" for i in range(n_layers)]
        x_labels = [f"H{i}" for i in range(n_heads)]

        yield json.dumps({
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "target_position": pos,
                "y_labels": y_labels,
                "x_labels": x_labels,
                "layer_dla": layer_dla,
                "head_dla": head_dla,
            },
        })

    @modal.method()
    def run_logit_lens(self, prompt: str, top_k: int = 5):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        tokens = self.model.to_tokens(prompt)

        yield json.dumps({"stage": "forward_pass"})
        _, cache = self.model.run_with_cache(tokens)

        yield json.dumps({"stage": "computing"})
        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = self.model.ln_final(resid_at_layers)
        layer_logits = self.model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        pred_probs = layer_probs[:, :-1, :]
        next_tokens = tokens[0, 1:]
        gathered_probs = _gather_next_token_probs(pred_probs, next_tokens)
        token_strings = self.model.to_str_tokens(tokens)[1:]

        topk_vals, topk_ids = torch.topk(pred_probs, k=top_k, dim=-1)
        n_layers, n_pos, k = topk_ids.shape
        flat_ids = topk_ids.reshape(-1).cpu().tolist()
        flat_strs = [self.model.tokenizer.decode([int(tid)]) for tid in flat_ids]
        topk_token_strings = [
            [[flat_strs[li * n_pos * k + p * k + j] for j in range(k)] for p in range(n_pos)]
            for li in range(n_layers)
        ]

        yield json.dumps({
            "stage": "done",
            "data": {
                "x_labels": token_strings,
                "y_labels": labels,
                "heatmap_data": gathered_probs.float().cpu().tolist(),
                "topk_tokens": topk_token_strings,
                "topk_probs": topk_vals.float().cpu().tolist(),
            },
        })


@app.cls(gpu="L4", **_TL_KWARGS)
class TransformerLensSmall(_TLBase):
    model_id: str = modal.parameter()


@app.cls(gpu="A10G", **_TL_KWARGS)
class TransformerLensMedium(_TLBase):
    model_id: str = modal.parameter()


@app.cls(gpu="A100-80GB", **_TL_KWARGS)
class TransformerLensLarge(_TLBase):
    model_id: str = modal.parameter()


# ── Routing table ─────────────────────────────────────────────────────────────

_TIER_TO_CLS = {
    "tl_small": TransformerLensSmall,
    "tl_medium": TransformerLensMedium,
    "tl_large": TransformerLensLarge,
}


@app.function(image=web_image, secrets=[hf_secret])
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

    class DlaRequest(BaseModel):
        prompt: str
        model_name: str
        target_position: int | str = "last"
        target_token: str | None = None

    class ValidateModelRequest(BaseModel):
        repo_id: str

    hf_token = os.environ.get("HF_TOKEN")

    @web_app.get("/api/models")
    def list_models():
        return [
            {
                "id": key,
                "display_name": entry["display_name"],
                "description": entry["description"],
                "requires_hf_token": entry["requires_hf_token"],
                "gpu_tier": entry["gpu_tier"],
            }
            for key, entry in FEATURED_MODELS.items()
        ]

    @web_app.post("/api/validate-model")
    def validate_model(request: ValidateModelRequest):
        result = validate_hf_repo(request.repo_id, hf_token=hf_token)
        if not result["valid"]:
            raise HTTPException(status_code=400, detail=result["reason"])
        return result

    @web_app.post("/api/run-lens-stream")
    async def run_logit_lens_stream(request: LogitLensRequest):
        from fastapi.responses import StreamingResponse

        entry = FEATURED_MODELS.get(request.model_name)
        if entry is None:
            validation = validate_hf_repo(request.model_name, hf_token=hf_token)
            if not validation["valid"]:
                raise HTTPException(status_code=400, detail=validation["reason"])
            cls = _TIER_TO_CLS[validation["gpu_tier"]]
            model_id = request.model_name
        else:
            cls = _TIER_TO_CLS[entry["gpu_tier"]]
            model_id = entry["model_id"]

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_logit_lens.remote_gen.aio(
                    request.prompt, request.top_k
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                safe = str(e).replace("\\", "\\\\").replace('"', '\\"')
                yield f'data: {{"stage":"error","error":"{safe}"}}\n\n'

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-dla-stream")
    async def run_dla_stream(request: DlaRequest):
        from fastapi.responses import StreamingResponse

        entry = FEATURED_MODELS.get(request.model_name)
        if entry is None:
            validation = validate_hf_repo(request.model_name, hf_token=hf_token)
            if not validation["valid"]:
                raise HTTPException(status_code=400, detail=validation["reason"])
            cls = _TIER_TO_CLS[validation["gpu_tier"]]
            model_id = request.model_name
        else:
            cls = _TIER_TO_CLS[entry["gpu_tier"]]
            model_id = entry["model_id"]

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_dla.remote_gen.aio(
                    request.prompt, request.target_position, request.target_token
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                safe = str(e).replace("\\", "\\\\").replace('"', '\\"')
                yield f'data: {{"stage":"error","error":"{safe}"}}\n\n'

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return web_app
