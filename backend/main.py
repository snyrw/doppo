import os
import modal

app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

VOLUME_MOUNT = "/model-cache"

# Change these hardcoded requirements
tl_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch==2.6.0",
        "transformer-lens>=3.0",
        "einops==0.8.1",
        "fancy-einsum==0.0.3",
        "jaxtyping==0.3.2",
    )
    .env({
        "HF_HOME": f"{VOLUME_MOUNT}/hf_home",
        "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home",
    })
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
    .env({
        "HF_HOME": f"{VOLUME_MOUNT}/hf_home",
        "TRANSFORMERS_CACHE": f"{VOLUME_MOUNT}/hf_home",
    })
)


MODEL_REGISTRY: dict[str, dict] = {
    # ── GPT-2 ────────────────────────────────────────────────────────────────
    "gpt2-small": {
        "display_name": "GPT-2 Small",
        "tl_id": "gpt2-small",
        "hf_id": "openai-community/gpt2",
        "requires_hf_token": False,
        "path": "tl",
    },
    "gpt2-medium": {
        "display_name": "GPT-2 Medium",
        "tl_id": "gpt2-medium",
        "hf_id": "openai-community/gpt2-medium",
        "requires_hf_token": False,
        "path": "tl",
    },
    "gpt2-large": {
        "display_name": "GPT-2 Large",
        "tl_id": "gpt2-large",
        "hf_id": "openai-community/gpt2-large",
        "requires_hf_token": False,
        "path": "tl",
    },
    "gpt2-xl": {
        "display_name": "GPT-2 XL",
        "tl_id": "gpt2-xl",
        "hf_id": "openai-community/gpt2-xl",
        "requires_hf_token": False,
        "path": "tl",
    },
    # ── Llama 3 ──────────────────────────────────────────────────────────────
    "meta-llama/Meta-Llama-3-8B": {
        "display_name": "Llama 3 (8B)",
        "tl_id": "meta-llama/Meta-Llama-3-8B",
        "hf_id": "meta-llama/Meta-Llama-3-8B",
        "requires_hf_token": True,
        "path": "tl",
    },
    "meta-llama/Llama-3.2-3B-Instruct": {
        "display_name": "Llama 3.2 Instruct (3B)",
        "tl_id": "meta-llama/Llama-3.2-3B-Instruct",
        "hf_id": "meta-llama/Llama-3.2-3B-Instruct",
        "requires_hf_token": True,
        "path": "tl",
    },
    "meta-llama/Meta-Llama-3.1-8B-Instruct": {
        "display_name": "Llama 3.1 Instruct (8B)",
        "tl_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "hf_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "requires_hf_token": True,
        "path": "tl",
    },
    "meta-llama/Llama-3.3-70B-Instruct": {
        "display_name": "Llama 3.3 Instruct (70B)",
        "tl_id": "meta-llama/Llama-3.3-70B-Instruct",
        "hf_id": "meta-llama/Llama-3.3-70B-Instruct",
        "requires_hf_token": True,
        "path": "hf",  # ~140 GB bfloat16; needs multi-GPU via device_map="auto"
    },
    # ── Qwen ─────────────────────────────────────────────────────────────────
    "Qwen/Qwen2.5-7B": {
        "display_name": "Qwen 2.5 (7B)",
        "tl_id": "Qwen/Qwen2.5-7B",
        "hf_id": "Qwen/Qwen2.5-7B",
        "requires_hf_token": False,
        "path": "tl",
    },
    "Qwen/Qwen2.5-7B-Instruct": {
        "display_name": "Qwen 2.5 Instruct (7B)",
        "tl_id": "Qwen/Qwen2.5-7B-Instruct",
        "hf_id": "Qwen/Qwen2.5-7B-Instruct",
        "requires_hf_token": False,
        "path": "tl",
    },
    "Qwen/Qwen3-0.6B": {
        "display_name": "Qwen3 (0.6B)",
        "tl_id": "Qwen/Qwen3-0.6B",
        "hf_id": "Qwen/Qwen3-0.6B",
        "requires_hf_token": False,
        "path": "tl",
    },
    "Qwen/Qwen3-8B": {
        "display_name": "Qwen3 (8B)",
        "tl_id": "Qwen/Qwen3-8B",
        "hf_id": "Qwen/Qwen3-8B",
        "requires_hf_token": False,
        "path": "tl",
    },
    "Qwen/Qwen3-14B": {
        "display_name": "Qwen3 (14B)",
        "tl_id": "Qwen/Qwen3-14B",
        "hf_id": "Qwen/Qwen3-14B",
        "requires_hf_token": False,
        "path": "hf",  # ~28 GB bfloat16; exceeds single A10G
    },
    # ── Gemma ────────────────────────────────────────────────────────────────
    "google/gemma-3-1b-it": {
        "display_name": "Gemma 3 (1B)",
        "tl_id": "google/gemma-3-1b-it",
        "hf_id": "google/gemma-3-1b-it",
        "requires_hf_token": True,
        "path": "tl",
    },
    "google/gemma-3-4b-it": {
        "display_name": "Gemma 3 (4B)",
        "tl_id": "google/gemma-3-4b-it",
        "hf_id": "google/gemma-3-4b-it",
        "requires_hf_token": True,
        "path": "hf",  # TL support not confirmed for this size variant
    },
    "google/gemma-3-27b-it": {
        "display_name": "Gemma 3 (27B)",
        "tl_id": "google/gemma-3-27b-it",
        "hf_id": "google/gemma-3-27b-it",
        "requires_hf_token": True,
        "path": "hf",  # ~54 GB bfloat16; needs multi-GPU via device_map="auto"
    },
    "google/gemma-2-2b-it": {
        "display_name": "Gemma 2 (2B)",
        "tl_id": "google/gemma-2-2b-it",
        "hf_id": "google/gemma-2-2b-it",
        "requires_hf_token": True,
        "path": "tl",
    },
    "google/gemma-2-9b-it": {
        "display_name": "Gemma 2 (9B)",
        "tl_id": "google/gemma-2-9b-it",
        "hf_id": "google/gemma-2-9b-it",
        "requires_hf_token": True,
        "path": "tl",
    },
    "google/gemma-2-27b-it": {
        "display_name": "Gemma 2 (27B)",
        "tl_id": "google/gemma-2-27b-it",
        "hf_id": "google/gemma-2-27b-it",
        "requires_hf_token": True,
        "path": "hf",  # ~54 GB bfloat16; needs multi-GPU via device_map="auto"
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

    try:
        files = set(list_repo_files(repo_id, token=hf_token))
    except RepositoryNotFoundError:
        return {"valid": False, "is_peft": False, "base_model": None,
                "reason": f"Repository '{repo_id}' not found or is private (check your HF token)."}
    except Exception as e:
        return {"valid": False, "is_peft": False, "base_model": None,
                "reason": f"Could not list repo files: {e}"}

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    has_pickle = any(f.endswith(".bin") or f.endswith(".pt") for f in files)
    is_peft = "adapter_config.json" in files

    # PEFT-only repos have no full model weights — that's fine.
    if not is_peft and not has_safetensors:
        return {"valid": False, "is_peft": False, "base_model": None,
                "reason": "No safetensors weights found. Only the safetensors format is supported."}

    if has_pickle:
        return {"valid": False, "is_peft": False, "base_model": None,
                "reason": "Repository contains pickle (.bin/.pt) files, which are unsafe to load."}

    # Inspect config.json for custom-code indicators.
    if "config.json" in files:
        try:
            config_path = hf_hub_download(repo_id, "config.json", token=hf_token)
            with open(config_path) as f:
                config = json.load(f)
            if config.get("trust_remote_code"):
                return {"valid": False, "is_peft": False, "base_model": None,
                        "reason": "Model config sets trust_remote_code=True, which is not allowed."}
            if "auto_map" in config:
                return {"valid": False, "is_peft": False, "base_model": None,
                        "reason": "Model config contains auto_map with custom code classes, which is not allowed."}
        except EntryNotFoundError:
            pass
        except Exception as e:
            return {"valid": False, "is_peft": False, "base_model": None,
                    "reason": f"Could not read config.json: {e}"}

    base_model = None
    if is_peft:
        try:
            adapter_path = hf_hub_download(repo_id, "adapter_config.json", token=hf_token)
            with open(adapter_path) as f:
                adapter_config = json.load(f)
        except Exception as e:
            return {"valid": False, "is_peft": True, "base_model": None,
                    "reason": f"Could not read adapter_config.json: {e}"}

        base_model = adapter_config.get("base_model_name_or_path", "")
        if base_model not in _KNOWN_BASE_HF_IDS:
            return {"valid": False, "is_peft": True, "base_model": base_model,
                    "reason": (
                        f"Adapter base model '{base_model}' is not a supported base model. "
                        f"Supported bases: {sorted(_KNOWN_BASE_HF_IDS)}"
                    )}

    return {"valid": True, "is_peft": is_peft, "base_model": base_model, "reason": "OK"}


@app.cls(
    image=tl_image,
    gpu="A10G",
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True}
)
class TransformerLensInference:
    model_id: str = modal.parameter()

    @modal.enter()
    def load_model(self):
        import torch
        from transformer_lens import HookedTransformer

        torch.set_grad_enabled(False)
        
        # This might need changes depending on the model loaded
        self.model = HookedTransformer.from_pretrained_no_processing(
            self.model_id,
            center_unembed=False,
            center_writing_weights=True,
            fold_ln=True,
            refactor_factored_attn_matrices=False,
            dtype=torch.bfloat16,
        )
        self.model.eval()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        import torch

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
        layer_probs_for_next = layer_probs[:, :-1, :]
        n_layers, seq_len_minus_1, _ = layer_probs_for_next.shape
        gathered_probs = torch.gather(
            layer_probs_for_next,
            dim=-1,
            index=next_tokens.view(1, seq_len_minus_1, 1).expand(n_layers, -1, 1),
        ).squeeze(-1)

        token_strings = self.model.to_str_tokens(tokens)[1:]

        return {
            "x_labels": token_strings,
            "y_labels": labels,
            "heatmap_data": gathered_probs.float().cpu().tolist(),
        }


@app.cls(
    image=hf_image,
    gpu="H100",
    secrets=[hf_secret],
    volumes={VOLUME_MOUNT: model_volume},
    timeout=600,
    scaledown_window=60,
)
class HFInference:
    model_id: str = modal.parameter()

    @modal.enter()
    def load_model(self):
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        torch.set_grad_enabled(False)
        hf_token = os.environ.get("HF_TOKEN")

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_id, token=hf_token, trust_remote_code=False
        )
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_id,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            token=hf_token,
            use_safetensors=True,
            trust_remote_code=False,
        )
        self.model.eval()

    @modal.method()
    def run_logit_lens(self, prompt: str) -> dict:
        import torch

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.model.device)
        input_ids = inputs["input_ids"]

        with torch.no_grad():
            outputs = self.model(**inputs, output_hidden_states=True)

        # hidden_states: tuple of (n_layers+1) tensors [batch, seq, d_model]
        # index 0 = token embedding; indices 1..n = post-block residual streams
        hidden_states = outputs.hidden_states
        stacked = torch.stack(hidden_states, dim=0)[:, 0, :, :]  # [n_layers+1, seq, d_model]

        final_ln = self._get_final_ln()
        normed = final_ln(stacked)
        logits = self.model.lm_head(normed)
        probs = logits.softmax(dim=-1)

        next_tokens = input_ids[0, 1:]
        probs_for_next = probs[:, :-1, :]
        n_states, seq_m1, _ = probs_for_next.shape
        gathered = torch.gather(
            probs_for_next,
            dim=-1,
            index=next_tokens.view(1, seq_m1, 1).expand(n_states, -1, 1),
        ).squeeze(-1)

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
        decoder = getattr(getattr(self.model, "model", None), "decoder", None)
        if decoder is not None:
            ln = getattr(decoder, "final_layer_norm", None)
            if ln is not None:
                return ln
        raise RuntimeError(
            f"Cannot locate final LayerNorm for {self.model_id}. "
            "Add a case to _get_final_ln()."
        )


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
        if entry is None:
            validation = validate_hf_repo(request.model_name, hf_token=hf_token)
            if not validation["valid"]:
                raise HTTPException(status_code=400, detail=validation["reason"])
            try:
                result = await HFInference(
                    model_id=request.model_name
                ).run_logit_lens.remote.aio(request.prompt)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
            return result

        try:
            if entry["path"] == "tl":
                result = await TransformerLensInference(
                    model_id=entry["tl_id"]
                ).run_logit_lens.remote.aio(request.prompt)
            else:
                result = await HFInference(
                    model_id=entry["hf_id"]
                ).run_logit_lens.remote.aio(request.prompt)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return result

    return web_app
