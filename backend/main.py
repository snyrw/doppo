import json
import os
import modal


def _sse_error(e: Exception) -> str:
    """Format an SSE error event with properly escaped JSON."""
    return f"data: {json.dumps({'stage': 'error', 'error': str(e)})}\n\n"

app = modal.App("logitlensviz")

model_volume = modal.Volume.from_name("model-weights-vol-v2", create_if_missing=True, version=2)
hf_secret = modal.Secret.from_name("huggingface-secret")

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
        "torch==2.6.0",
        "transformer-lens>=3.0",
        "einops==0.8.1",
        "fancy-einsum==0.0.3",
        "jaxtyping==0.3.2",
    )
    .env(_HF_CACHE_ENV)
)


# gpu_tier drives which Modal class handles a model.
# tl_small  → L4         (< 4B, GPT-2 family + sub-4B instruct models)
# tl_medium → L40S       (4–10B models; 48 GB gives ample headroom for attribution backward passes)
# tl_large  → A100-80GB  (10–25B models; A100 fits ~25B comfortably in bfloat16)
# tl_xlarge → H200       (25–70B models; H200 141 GB fits 70B in bfloat16)
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
    # Llama 3.3 70B removed: TransformerBridge 3.0 does not yet support multi-GPU
    # (device_map="auto"). Re-add when TransformerLens ships multi-device support.
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
        "gpu_tier": "tl_xlarge",
    },
}

web_image = modal.Image.debian_slim(python_version="3.12").pip_install(
    "fastapi[standard]", "pydantic", "huggingface_hub>=0.27",
    "transformers>=4.40",  # tokenizer-only, no torch needed here
)

def _detect_gpu_tier(config: dict) -> str:
    """
    Estimate GPU tier from a model's config.json.
    Falls back to tl_large when the model is too large for a cheaper tier or size is unknown.
    Returns None if the model exceeds the single-GPU limit (~70B on H200).

    Tiers:
      tl_small  → L4         (< 4B)
      tl_medium → L40S       (4–10B; 48 GB gives backward-pass headroom for attribution)
      tl_large  → A100-80GB  (10–25B; A100-80GB fits ~25B comfortably in bfloat16)
      tl_xlarge → H200       (25–70B; H200 141 GB fits 70B in bfloat16)
    """
    num_params = config.get("num_parameters")
    if isinstance(num_params, (int, float)):
        if num_params < 4e9:
            return "tl_small"
        if num_params < 10e9:
            return "tl_medium"
        if num_params < 25e9:
            return "tl_large"
        if num_params < 70e9:
            return "tl_xlarge"
        return None  # exceeds single-GPU limit (~70B)

    # Proxy: num_hidden_layers × hidden_size scales predictably with model size.
    # Thresholds calibrated against known models: GPT-2 XL=76K, Llama3-8B=131K,
    # Qwen3-14B=205K, Gemma3-27B=333K, Llama3.3-70B=655K.
    layers = config.get("num_hidden_layers", 0)
    hidden = config.get("hidden_size", 0)
    proxy = layers * hidden
    if proxy and proxy < 90_000:
        return "tl_small"
    if proxy and proxy < 165_000:
        return "tl_medium"
    if proxy and proxy < 300_000:
        return "tl_large"
    if proxy and proxy < 700_000:
        return "tl_xlarge"
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

    has_safetensors = any(
        f.endswith(".safetensors") or f.endswith(".safetensors.index.json")
        for f in files
    )
    has_pickle_only = not has_safetensors and any(
        f.endswith(".bin") or f.endswith(".pt") for f in files
    )
    if has_pickle_only:
        return _invalid(
            "Repository contains only pickle (.bin/.pt) weights, which are unsafe to load. "
            "Re-upload in safetensors format."
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
                # auto_map is safe when values are bare class names resolved from transformers.
                # A dotted path that doesn't start with "transformers." signals a custom module
                # (e.g. "modeling_foo.FooModel") that could execute arbitrary code at import time.
                custom_module = [
                    v for v in config["auto_map"].values()
                    if isinstance(v, str) and "." in v and not v.startswith("transformers.")
                ]
                if custom_module:
                    return _invalid(
                        "Model config uses auto_map with custom module paths, which is not allowed."
                    )
            detected = _detect_gpu_tier(config)
            if detected is None:
                return _invalid(
                    "Model appears to exceed ~70B parameters. Single-GPU limit is 70B on H200 — "
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
    enable_memory_snapshot=True,
)

# All classes use a single GPU, so GPU snapshots are safe across the board.
# scaledown_window is tiered: idle billing on H200 ($4.54/hr) is 6× more
# expensive than on L4 ($0.80/hr), so expensive tiers cut off idle faster.
_TL_KWARGS = dict(
    image=tl_image,
    experimental_options={"enable_gpu_snapshot": True},
    timeout=600,
    scaledown_window=30,   # L4 / L40S — cheap enough to hold warm briefly
    **_SHARED_CLS_KWARGS,
)

# Large/XL models (10–70B) can take 10–20 min to download on first cold start.
_TL_LARGE_KWARGS = {**_TL_KWARGS, "timeout": 1200, "scaledown_window": 15}   # A100-80GB

# H200 is the priciest tier; cut idle time aggressively.
_TL_XLARGE_KWARGS = {**_TL_LARGE_KWARGS, "scaledown_window": 10}             # H200


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
    def run_dla(self, prompt: str, target_position: int | str = "last", target_token: str | None = None, contrastive_token: str | None = None):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        tokens = self.model.to_tokens(prompt)
        pos = _resolve_pos(tokens, target_position)

        yield json.dumps({"stage": "forward_pass"})
        _, cache = self.model.run_with_cache(tokens)

        yield json.dumps({"stage": "computing"})

        n_layers = self.model.cfg.n_layers
        n_heads = self.model.cfg.n_heads

        # Resolve target token.
        if target_token is None:
            final_resid = cache[f"blocks.{n_layers - 1}.hook_resid_post"]
            final_logits = self.model.unembed(self.model.ln_final(final_resid))
            target_idx = int(final_logits[0, pos].argmax())
        else:
            ids = self.model.to_tokens(target_token, prepend_bos=False)
            target_idx = int(ids[0, 0])
        resolved_token = self.model.tokenizer.decode([target_idx])

        # Resolve contrastive token.
        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = self.model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = self.model.tokenizer.decode([contrastive_idx])

        # Logit direction: W_U[:,target] or W_U[:,target] - W_U[:,contrastive].
        if contrastive_idx is not None:
            logit_dir = (self.model.W_U[:, target_idx] - self.model.W_U[:, contrastive_idx]).float()
        else:
            logit_dir = self.model.W_U[:, target_idx].float()

        # Embedding contribution: residual stream before block 0 = token embed + pos embed
        # (for RoPE models the positional information lives in attention, not the residual stream,
        # so hook_in at block 0 is simply W_E[token] — still the correct starting point).
        embed_dla = float(cache["blocks.0.hook_in"][0, pos].float() @ logit_dir)

        # Head-level DLA: [n_layers][n_heads]
        W_O = self.model.W_O  # [n_layers, n_heads, d_head, d_model]
        head_dla = []
        for layer in range(n_layers):
            z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()  # [n_heads, d_head]
            head_results = torch.einsum("hd,hdm->hm", z, W_O[layer].float())  # [n_heads, d_model]
            head_dla.append((head_results @ logit_dir).cpu().tolist())

        # Layer-level DLA: attn and MLP reported separately and as combined sum.
        layer_dla = []
        layer_attn_dla = []
        layer_mlp_dla = []
        for layer in range(n_layers):
            attn_out = cache[f"blocks.{layer}.hook_attn_out"][0, pos].float()
            mlp_out = cache[f"blocks.{layer}.hook_mlp_out"][0, pos].float()
            attn_val = float(attn_out @ logit_dir)
            mlp_val = float(mlp_out @ logit_dir)
            layer_attn_dla.append(attn_val)
            layer_mlp_dla.append(mlp_val)
            layer_dla.append(attn_val + mlp_val)

        y_labels = [f"L{i}" for i in range(n_layers)]
        x_labels = [f"H{i}" for i in range(n_heads)]

        yield json.dumps({
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "contrastive_token": resolved_contrastive,
                "target_position": pos,
                "y_labels": y_labels,
                "x_labels": x_labels,
                "embed_dla": embed_dla,
                "layer_dla": layer_dla,
                "layer_attn_dla": layer_attn_dla,
                "layer_mlp_dla": layer_mlp_dla,
                "head_dla": head_dla,
            },
        })

    @modal.method()
    def run_attribution(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
        top_n: int = 30,
    ):
        import json
        import torch

        yield json.dumps({"stage": "tokenizing"})
        clean_tokens = self.model.to_tokens(clean_prompt)
        corrupted_tokens = self.model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)

        n_layers = self.model.cfg.n_layers
        n_heads = self.model.cfg.n_heads

        # Resolve target/contrastive tokens via a plain forward pass (no cache overhead).
        yield json.dumps({"stage": "clean_forward_pass"})
        with torch.no_grad():
            if target_token is None:
                clean_logits = self.model(clean_tokens)
                target_idx = int(clean_logits[0, pos].argmax())
                del clean_logits
            else:
                ids = self.model.to_tokens(target_token, prepend_bos=False)
                target_idx = int(ids[0, 0])
        resolved_token = self.model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = self.model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = self.model.tokenizer.decode([contrastive_idx])

        # Clean cache — only the three activation types needed for diffs.
        # Filtered to avoid storing all TL3 intermediates for a 27-70B model.
        needed_hooks: set[str] = {
            f"blocks.{L}.{suffix}"
            for L in range(n_layers)
            for suffix in ("attn.hook_z", "hook_attn_out", "hook_mlp_out")
        }
        with torch.no_grad():
            _, clean_cache = self.model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in needed_hooks,
            )

        # Extract only the [pos] slice for each activation and move to CPU immediately.
        # This frees the GPU tensors before the expensive backward pass.
        clean_z_cpu    = [clean_cache[f"blocks.{L}.attn.hook_z"][0, pos].float().cpu()    for L in range(n_layers)]
        clean_attn_cpu = [clean_cache[f"blocks.{L}.hook_attn_out"][0, pos].float().cpu()  for L in range(n_layers)]
        clean_mlp_cpu  = [clean_cache[f"blocks.{L}.hook_mlp_out"][0, pos].float().cpu()   for L in range(n_layers)]
        del clean_cache
        torch.cuda.empty_cache()

        # Corrupted forward pass with gradients — first-order Taylor attribution.
        # torch.enable_grad() overrides the global set_grad_enabled(False) from load_model.
        yield json.dumps({"stage": "corrupted_forward_backward"})

        corrupted_z: dict[int, torch.Tensor] = {}
        corrupted_attn_out: dict[int, torch.Tensor] = {}
        corrupted_mlp_out: dict[int, torch.Tensor] = {}

        def make_save_hook(d: dict, key: int):
            def _fn(value, hook):
                d[key] = value
                value.retain_grad()
                return value
            return _fn

        fwd_hooks = []
        for L in range(n_layers):
            fwd_hooks.append((f"blocks.{L}.attn.hook_z",   make_save_hook(corrupted_z, L)))
            fwd_hooks.append((f"blocks.{L}.hook_attn_out", make_save_hook(corrupted_attn_out, L)))
            fwd_hooks.append((f"blocks.{L}.hook_mlp_out",  make_save_hook(corrupted_mlp_out, L)))

        with torch.enable_grad():
            logits_corrupted = self.model.run_with_hooks(corrupted_tokens, fwd_hooks=fwd_hooks)
            if contrastive_idx is not None:
                metric = logits_corrupted[0, pos, target_idx] - logits_corrupted[0, pos, contrastive_idx]
            else:
                metric = logits_corrupted[0, pos, target_idx]
            metric.backward()

        # Move gradients and corrupted activations to CPU before the computation loop,
        # then free all GPU tensors. Attribution math on CPU is negligible time.
        grad_z_cpu    = {}
        grad_attn_cpu = {}
        grad_mlp_cpu  = {}
        corrupted_z_cpu    = {}
        corrupted_attn_cpu = {}
        corrupted_mlp_cpu  = {}

        for L in range(n_layers):
            if corrupted_z[L].grad is None:
                raise RuntimeError(
                    f"hook_z gradient is None at layer {L}. "
                    "The TL3 bridge may be detaching activations — cannot compute attribution."
                )
            if corrupted_attn_out[L].grad is None or corrupted_mlp_out[L].grad is None:
                raise RuntimeError(
                    f"hook_attn_out or hook_mlp_out gradient is None at layer {L}."
                )
            grad_z_cpu[L]    = corrupted_z[L].grad[0, pos].float().cpu()
            grad_attn_cpu[L] = corrupted_attn_out[L].grad[0, pos].float().cpu()
            grad_mlp_cpu[L]  = corrupted_mlp_out[L].grad[0, pos].float().cpu()
            corrupted_z_cpu[L]    = corrupted_z[L][0, pos].float().cpu()
            corrupted_attn_cpu[L] = corrupted_attn_out[L][0, pos].float().cpu()
            corrupted_mlp_cpu[L]  = corrupted_mlp_out[L][0, pos].float().cpu()

        del logits_corrupted, metric, corrupted_z, corrupted_attn_out, corrupted_mlp_out
        torch.cuda.empty_cache()

        yield json.dumps({"stage": "computing_attribution"})

        all_components: list[dict] = []
        head_attribution: list[list[float]] = []

        for L in range(n_layers):
            row: list[float] = []
            for H in range(n_heads):
                z_diff = clean_z_cpu[L][H] - corrupted_z_cpu[L][H]
                attr = float((z_diff * grad_z_cpu[L][H]).sum())
                row.append(attr)
                all_components.append({
                    "layer": L,
                    "head": H,
                    "component_type": "attn_head",
                    "attribution_score": attr,
                })
            head_attribution.append(row)

        layer_attribution: list[float] = []
        for L in range(n_layers):
            attn_diff = clean_attn_cpu[L] - corrupted_attn_cpu[L]
            mlp_diff  = clean_mlp_cpu[L]  - corrupted_mlp_cpu[L]
            layer_attribution.append(float(
                (attn_diff * grad_attn_cpu[L]).sum() + (mlp_diff * grad_mlp_cpu[L]).sum()
            ))
            all_components.append({
                "layer": L,
                "head": -1,
                "component_type": "mlp",
                "attribution_score": float((mlp_diff * grad_mlp_cpu[L]).sum()),
            })

        all_components.sort(key=lambda c: abs(c["attribution_score"]), reverse=True)
        top_k_components = all_components[:top_n]

        yield json.dumps({
            "stage": "done",
            "data": {
                "target_token": resolved_token,
                "target_token_idx": target_idx,
                "contrastive_token": resolved_contrastive,
                "contrastive_token_idx": contrastive_idx,
                "target_position": pos,
                "y_labels": [f"L{i}" for i in range(n_layers)],
                "x_labels": [f"H{i}" for i in range(n_heads)],
                "layer_attribution": layer_attribution,
                "head_attribution": head_attribution,
                "top_k_components": top_k_components,
            },
        })

    @modal.method()
    def run_activation_patch(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token_idx: int = 0,
        contrastive_token_idx: int | None = None,
        components: list[dict] | None = None,
        k: int = 10,
    ):
        import json
        import torch

        if components is None:
            components = []

        yield json.dumps({"stage": "tokenizing"})
        clean_tokens = self.model.to_tokens(clean_prompt)
        corrupted_tokens = self.model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)
        top_components = components[:k]

        # Validate component layer/head indices against model architecture.
        for comp in top_components:
            layer = comp["layer"]
            head = comp.get("head")
            if not (0 <= layer < self.model.cfg.n_layers):
                raise ValueError(f"layer {layer} out of range (model has {self.model.cfg.n_layers} layers)")
            if head is not None and head >= 0 and not (0 <= head < self.model.cfg.n_heads):
                raise ValueError(f"head {head} out of range (model has {self.model.cfg.n_heads} heads)")

        # Build set of hook names needed for corrupted cache
        hook_names: set[str] = set()
        for comp in top_components:
            L = comp["layer"]
            if comp["component_type"] == "attn_head":
                hook_names.add(f"blocks.{L}.attn.hook_z")
            else:
                hook_names.add(f"blocks.{L}.hook_mlp_out")

        def _metric(logits) -> float:
            val = logits[0, pos, target_token_idx]
            if contrastive_token_idx is not None:
                val = val - logits[0, pos, contrastive_token_idx]
            return float(val)

        yield json.dumps({"stage": "preparing"})
        device = clean_tokens.device
        with torch.no_grad():
            _, clean_cache = self.model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in hook_names,
            )
            clean_metric = _metric(self.model(clean_tokens))
            corrupted_metric = _metric(self.model(corrupted_tokens))
        total_diff = max(abs(clean_metric - corrupted_metric), 1e-8)

        # CPU-offload the clean cache so it doesn't compete with the k patching
        # forward passes for the limited headroom above model weights.
        clean_cache_cpu = {name: clean_cache[name].cpu() for name in hook_names}
        del clean_cache
        torch.cuda.empty_cache()

        results: list[dict] = []
        for i, comp in enumerate(top_components):
            L = comp["layer"]
            H = comp.get("head", -1)

            if comp["component_type"] == "attn_head":
                clean_z_val = clean_cache_cpu[f"blocks.{L}.attn.hook_z"][:, :, H, :].to(device)

                def make_head_hook(cached_z, head_idx):
                    def _fn(value, hook):
                        value[:, :, head_idx, :] = cached_z
                        return value
                    return _fn

                hook_fn = make_head_hook(clean_z_val, H)
                hook_name = f"blocks.{L}.attn.hook_z"
            else:
                clean_mlp_val = clean_cache_cpu[f"blocks.{L}.hook_mlp_out"].to(device)

                def make_mlp_hook(cached_mlp):
                    def _fn(value, hook):
                        return cached_mlp
                    return _fn

                hook_fn = make_mlp_hook(clean_mlp_val)
                hook_name = f"blocks.{L}.hook_mlp_out"

            with torch.no_grad():
                patched_logits = self.model.run_with_hooks(
                    corrupted_tokens,
                    fwd_hooks=[(hook_name, hook_fn)],
                )
            patched_metric = _metric(patched_logits)
            # Denoising: 0 = no recovery (stays corrupted), 1 = full recovery (matches clean).
            actual_effect = (patched_metric - corrupted_metric) / total_diff

            results.append({
                "layer": L,
                "head": H,
                "component_type": comp["component_type"],
                "attribution_score": comp["attribution_score"],
                "actual_effect": actual_effect,
            })

            yield json.dumps({"stage": f"patching_{i + 1}_of_{len(top_components)}"})

        yield json.dumps({"stage": "computing_effects"})
        yield json.dumps({
            "stage": "done",
            "data": {
                "total_diff": total_diff,
                "components": results,
            },
        })

    @modal.method()
    def run_steering(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        components: list[dict] | None = None,
        alpha: float = 1.0,
        n_tokens: int = 50,
        extra_pairs: list[dict] | None = None,
        temperature: float = 1.0,
        repetition_penalty: float = 1.3,
        generation_prompt: str | None = None,
    ):
        import json
        import torch

        if components is None:
            components = []

        yield json.dumps({"stage": "computing"})

        # Apply chat template for instruct-tuned models so generation is in-distribution.
        # Base models (GPT-2, Qwen base, etc.) have no chat_template and get text as-is.
        def _fmt(text: str) -> str:
            tmpl = getattr(self.model.tokenizer, "chat_template", None)
            if tmpl is not None:
                return self.model.tokenizer.apply_chat_template(
                    [{"role": "user", "content": text}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
            return text

        with torch.no_grad():
            gen_prompt_resolved = generation_prompt if generation_prompt else clean_prompt
            gen_tokens = self.model.to_tokens(_fmt(gen_prompt_resolved))
            n_layers = self.model.cfg.n_layers

            # Full pair list: primary pair + any extra CAA-mode pairs.
            all_pairs = [{"clean": clean_prompt, "corrupted": corrupted_prompt}]
            if extra_pairs:
                all_pairs.extend(extra_pairs)

            # Validate component layer/head indices against model architecture.
            for comp in components:
                layer = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                head = comp.get("head")
                if not (0 <= layer < self.model.cfg.n_layers):
                    raise ValueError(f"layer {layer} out of range (model has {self.model.cfg.n_layers} layers)")
                if head is not None and not (0 <= head < self.model.cfg.n_heads):
                    raise ValueError(f"head {head} out of range (model has {self.model.cfg.n_heads} heads)")

            # Accumulate unnormalized DIM vectors across all pairs, then average.
            # Each component gets its own accumulator tensor (initialized on first pair).
            comp_accumulators: list[torch.Tensor | None] = [None] * len(components)

            # Pre-compute the set of hook names needed so run_with_cache only stores
            # the activations we actually read. Drops each forward pass's cache from
            # ~64 MB to a few KB, making multi-pair runs fast.
            _hook_set: set[str] = set()
            for _comp in components:
                _L = _comp["layer"] if _comp["layer"] >= 0 else n_layers // 2
                _inj = _comp.get("injection_type", "residual")
                if _inj == "attn_head" and _comp.get("head") is not None:
                    _hook_set.add(f"blocks.{_L}.attn.hook_z")
                elif _inj == "mlp":
                    _hook_set.add(f"blocks.{_L}.hook_mlp_out")
                else:
                    _hook_set.add(f"blocks.{_L}.hook_in")
            needed_hooks: list[str] = list(_hook_set)

            for pair in all_pairs:
                p_clean = self.model.to_tokens(_fmt(pair["clean"]))
                p_corrupted = self.model.to_tokens(_fmt(pair["corrupted"]))

                # Extract from each sequence's own last token independently.
                # Using a shared min-length index would pull a mid-sequence position from
                # the longer prompt instead of its pre-generation state (per IBM/ActAdd).
                if target_position == "last":
                    cp_pos = int(p_clean.shape[-1]) - 1
                    rp_pos = int(p_corrupted.shape[-1]) - 1
                else:
                    cp_pos = min(int(target_position), int(p_clean.shape[-1]) - 1)
                    rp_pos = min(int(target_position), int(p_corrupted.shape[-1]) - 1)

                _, cache_clean = self.model.run_with_cache(p_clean, names_filter=needed_hooks)
                _, cache_corrupted = self.model.run_with_cache(p_corrupted, names_filter=needed_hooks)

                for ci, comp in enumerate(components):
                    L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                    H = comp.get("head")
                    inj = comp.get("injection_type", "residual")
                    if inj == "attn_head" and H is not None:
                        v = (
                            cache_clean[f"blocks.{L}.attn.hook_z"][0, cp_pos, H, :].float()
                            - cache_corrupted[f"blocks.{L}.attn.hook_z"][0, rp_pos, H, :].float()
                        )
                    elif inj == "mlp":
                        v = (
                            cache_clean[f"blocks.{L}.hook_mlp_out"][0, cp_pos, :].float()
                            - cache_corrupted[f"blocks.{L}.hook_mlp_out"][0, rp_pos, :].float()
                        )
                    else:
                        v = (
                            cache_clean[f"blocks.{L}.hook_in"][0, cp_pos, :].float()
                            - cache_corrupted[f"blocks.{L}.hook_in"][0, rp_pos, :].float()
                        )
                    comp_accumulators[ci] = v if comp_accumulators[ci] is None else comp_accumulators[ci] + v

                del cache_clean, cache_corrupted

            torch.cuda.empty_cache()

            # Normalize the averaged vector for each component.
            pos = _resolve_pos(gen_tokens, target_position)
            n_pairs = len(all_pairs)
            dim_vectors = []
            for ci, comp in enumerate(components):
                L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                H = comp.get("head")
                inj = comp.get("injection_type", "residual")
                avg_v = comp_accumulators[ci] / n_pairs
                dim_vectors.append((L, H, inj, avg_v / (avg_v.norm() + 1e-8)))

            # Build hooks with factory functions to avoid Python late-binding closure bug.
            # Cast dv to value.dtype inside each hook — DIM vectors are float32 but model
            # activations are bfloat16 (loaded with dtype=torch.bfloat16).
            fwd_hooks = []
            for L, H, inj, dim_vec in dim_vectors:
                if inj == "attn_head" and H is not None:
                    def make_attn_hook(dv, h, a):
                        def _fn(value, hook):
                            value[:, :, h, :] = value[:, :, h, :] + a * dv.to(value.dtype)
                            return value
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.attn.hook_z", make_attn_hook(dim_vec, H, alpha)))
                elif inj == "mlp":
                    def make_mlp_hook(dv, a):
                        def _fn(value, hook):
                            return value + a * dv.to(value.dtype)
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.hook_mlp_out", make_mlp_hook(dim_vec, alpha)))
                else:
                    def make_resid_hook(dv, a):
                        def _fn(value, hook):
                            return value + a * dv.to(value.dtype)
                        return _fn
                    fwd_hooks.append((f"blocks.{L}.hook_in", make_resid_hook(dim_vec, alpha)))

            # Closure: apply repetition penalty to already-generated tokens, then sample.
            # Penalizes only the generated portion to avoid interfering with deliberate
            # repetition in the original prompt.
            def _next_token(logits_row: torch.Tensor, generated: list[int]) -> int:
                logits = logits_row.float().clone()
                if repetition_penalty != 1.0:
                    for tok_id in generated:
                        if logits[tok_id] > 0:
                            logits[tok_id] /= repetition_penalty
                        else:
                            logits[tok_id] *= repetition_penalty
                if temperature <= 0.0:
                    return int(logits.argmax())
                return int(torch.multinomial((logits / temperature).softmax(dim=-1), 1).item())

            # Baseline generation + top-K at target position
            baseline_ids = gen_tokens.clone()
            baseline_generated: list[int] = []
            for _ in range(n_tokens):
                logits = self.model(baseline_ids)
                next_id = _next_token(logits[0, -1], baseline_generated)
                baseline_generated.append(next_id)
                baseline_ids = torch.cat(
                    [baseline_ids, torch.tensor([[next_id]], device=baseline_ids.device)], dim=1
                )
            baseline_text = self.model.tokenizer.decode(baseline_ids[0, gen_tokens.shape[1]:].tolist())
            baseline_logits = self.model(gen_tokens)
            vals_b, ids_b = torch.topk(baseline_logits[0, pos].softmax(dim=-1), 5)
            top_k_baseline = [
                {"token": self.model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_b.tolist(), vals_b.tolist())
            ]

            # Steered generation + streaming + top-K at target position
            steered_ids = gen_tokens.clone()
            steered_generated: list[int] = []
            for i in range(n_tokens):
                logits = self.model.run_with_hooks(steered_ids, fwd_hooks=fwd_hooks)
                next_id = _next_token(logits[0, -1], steered_generated)
                steered_generated.append(next_id)
                steered_ids = torch.cat(
                    [steered_ids, torch.tensor([[next_id]], device=steered_ids.device)], dim=1
                )
                yield json.dumps({
                    "stage": "token",
                    "data": {"token": self.model.tokenizer.decode([next_id]), "index": i},
                })
            steered_text = self.model.tokenizer.decode(steered_ids[0, gen_tokens.shape[1]:].tolist())
            steered_logits = self.model.run_with_hooks(gen_tokens, fwd_hooks=fwd_hooks)
            vals_s, ids_s = torch.topk(steered_logits[0, pos].softmax(dim=-1), 5)
            top_k_steered = [
                {"token": self.model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_s.tolist(), vals_s.tolist())
            ]

            target_id = int(baseline_logits[0, pos].argmax())
            logit_diff = float(steered_logits[0, pos, target_id] - baseline_logits[0, pos, target_id])

        yield json.dumps({
            "stage": "done",
            "data": {
                "steered_text": steered_text,
                "baseline_text": baseline_text,
                "top_k_steered": top_k_steered,
                "top_k_baseline": top_k_baseline,
                "logit_diff": logit_diff,
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

        # Per-layer metrics in a single pass: KL divergence from final layer,
        # rank of the final layer's top-1 token, and Shannon entropy.
        eps = 1e-10
        final_probs = pred_probs[-1].float()          # [n_pos, vocab]
        final_top1_ids = final_probs.argmax(dim=-1)   # [n_pos]
        pos_range = torch.arange(n_pos, device=pred_probs.device)
        kl_data, rank_data, entropy_data = [], [], []
        for li in range(n_layers):
            p = pred_probs[li].float()  # [n_pos, vocab]
            kl_data.append(
                (p * (torch.log(p + eps) - torch.log(final_probs + eps))).sum(dim=-1).cpu().tolist()
            )
            target_p = p[pos_range, final_top1_ids]   # [n_pos]
            rank_data.append(
                (p > target_p.unsqueeze(-1)).sum(dim=-1).add(1).cpu().tolist()
            )
            entropy_data.append(
                (-(p * torch.log(p + eps)).sum(dim=-1)).cpu().tolist()
            )

        yield json.dumps({
            "stage": "done",
            "data": {
                "x_labels": token_strings,
                "y_labels": labels,
                "heatmap_data": gathered_probs.float().cpu().tolist(),
                "topk_tokens": topk_token_strings,
                "topk_probs": topk_vals.float().cpu().tolist(),
                "kl_data": kl_data,
                "rank_data": rank_data,
                "entropy_data": entropy_data,
            },
        })

    @modal.method()
    def run_attn(self, prompt: str):
        import json
        import torch

        TOKEN_CAP = 30
        tokens = self.model.to_tokens(prompt)
        truncated = tokens.shape[1] > TOKEN_CAP
        if truncated:
            tokens = tokens[:, :TOKEN_CAP]

        _, cache = self.model.run_with_cache(
            tokens,
            names_filter=lambda name: "hook_pattern" in name,
        )

        n_layers = self.model.cfg.n_layers
        patterns = []
        for layer in range(n_layers):
            layer_pats = cache[f"blocks.{layer}.attn.hook_pattern"][0].cpu().tolist()
            patterns.append(layer_pats)

        token_strs = self.model.tokenizer.convert_ids_to_tokens(tokens[0].tolist())

        yield json.dumps({
            "stage": "done",
            "data": {
                "tokens": token_strs,
                "patterns": patterns,
                "n_layers": n_layers,
                "n_heads": self.model.cfg.n_heads,
                "truncated": truncated,
            },
        })

    @modal.method()
    def run_logit_lens_result(self, prompt: str, top_k: int = 5) -> dict:
        import json
        for chunk_str in self.run_logit_lens.local(prompt, top_k):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_logit_lens produced no done event")

    @modal.method()
    def run_attn_result(self, prompt: str) -> dict:
        import json
        for chunk_str in self.run_attn.local(prompt):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_attn produced no done event")

    @modal.method()
    def run_dla_result(
        self,
        prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
    ) -> dict:
        import json
        for chunk_str in self.run_dla.local(prompt, target_position, target_token, contrastive_token):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_dla produced no done event")

    @modal.method()
    def run_attribution_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token: str | None = None,
        contrastive_token: str | None = None,
        top_n: int = 30,
    ) -> dict:
        import json
        for chunk_str in self.run_attribution.local(
            clean_prompt, corrupted_prompt, target_position, target_token, contrastive_token, top_n
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_attribution produced no done event")

    @modal.method()
    def run_activation_patch_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        target_token_idx: int = 0,
        contrastive_token_idx: int | None = None,
        components: list[dict] | None = None,
        k: int = 10,
    ) -> dict:
        import json
        for chunk_str in self.run_activation_patch.local(
            clean_prompt, corrupted_prompt, target_position, target_token_idx, contrastive_token_idx,
            components or [], k
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_activation_patch produced no done event")

    @modal.method()
    def run_steering_result(
        self,
        clean_prompt: str,
        corrupted_prompt: str,
        target_position: int | str = "last",
        components: list[dict] | None = None,
        alpha: float = 1.0,
        n_tokens: int = 50,
        extra_pairs: list[dict] | None = None,
        temperature: float = 1.0,
        repetition_penalty: float = 1.3,
        generation_prompt: str | None = None,
    ) -> dict:
        import json
        for chunk_str in self.run_steering.local(
            clean_prompt, corrupted_prompt, target_position, components or [], alpha,
            n_tokens, extra_pairs, temperature, repetition_penalty, generation_prompt
        ):
            chunk = json.loads(chunk_str)
            if chunk.get("stage") == "done":
                return chunk["data"]
        raise RuntimeError("run_steering produced no done event")


@app.cls(gpu="L4", **_TL_KWARGS)
class TransformerLensSmall(_TLBase):
    model_id: str = modal.parameter()


@app.cls(gpu="L40S", **_TL_KWARGS)
class TransformerLensMedium(_TLBase):
    model_id: str = modal.parameter()


@app.cls(gpu="A100-80GB", **_TL_LARGE_KWARGS)
class TransformerLensLarge(_TLBase):
    model_id: str = modal.parameter()


@app.cls(gpu="H200", **_TL_XLARGE_KWARGS)
class TransformerLensXLarge(_TLBase):
    model_id: str = modal.parameter()


# ── Routing table ─────────────────────────────────────────────────────────────

_TIER_TO_CLS = {
    "tl_small":  TransformerLensSmall,
    "tl_medium": TransformerLensMedium,
    "tl_large":  TransformerLensLarge,
    "tl_xlarge": TransformerLensXLarge,
}

_TIER_ORDER = ["tl_small", "tl_medium", "tl_large", "tl_xlarge"]

def _bump_tier(tier: str) -> str:
    """Return the next GPU tier up for memory-intensive ops (attribution, activation patch).

    Backward passes retain intermediate activations for all layers, requiring
    significantly more headroom than a forward-only run. One tier up is enough:
      tl_small  (L4, 24 GB)    → tl_medium (L40S, 48 GB)   — 2× VRAM, safe for ≤4B backward
      tl_medium (L40S, 48 GB)  → tl_large  (A100-80GB, 80 GB)
      tl_large  (A100-80GB)    → tl_xlarge (H200, 141 GB)
      tl_xlarge (H200)         → tl_xlarge (ceiling, no tier above)
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


def _resolve_pos(tokens, target_position: int | str) -> int:
    """Resolve target_position ('last' or an int string/int) to an absolute token index."""
    return int(tokens.shape[-1]) - 1 if target_position == "last" else int(target_position)


@app.function(image=web_image, secrets=[hf_secret])
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def api():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel, Field

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
        top_k: int = Field(default=5, ge=1, le=100)

    class DlaRequest(BaseModel):
        prompt: str
        model_name: str
        target_position: int | str = "last"
        target_token: str | None = None
        contrastive_token: str | None = None

    class AttributionRequest(BaseModel):
        prompt: str            # clean prompt
        corrupted_prompt: str
        model_name: str
        target_position: int | str = "last"
        target_token: str | None = None
        contrastive_token: str | None = None
        top_n: int = Field(default=30, ge=1, le=200)

    class ActivationPatchRequest(BaseModel):
        prompt: str            # clean prompt
        corrupted_prompt: str
        model_name: str
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
        model_name: str
        clean_prompt: str
        corrupted_prompt: str
        generation_prompt: str | None = None  # separate probe prompt; falls back to clean_prompt
        target_position: int | str = "last"
        components: list[SteeringComponentRequest]
        alpha: float = Field(default=1.0, ge=-100.0, le=100.0)
        n_tokens: int = Field(default=50, ge=1, le=500)
        extra_pairs: list[dict] | None = None  # [{clean, corrupted}] for CAA-mode averaging
        temperature: float = Field(default=1.0, ge=0.0, le=5.0)
        repetition_penalty: float = Field(default=1.3, ge=0.5, le=5.0)

    class AttentionRequest(BaseModel):
        prompt: str
        model_name: str

    class ValidateModelRequest(BaseModel):
        repo_id: str

    class TokenizeRequest(BaseModel):
        model_name: str
        text: str

    hf_token = os.environ.get("HF_TOKEN")
    _tokenizer_cache: dict = {}

    @web_app.post("/api/tokenize")
    def tokenize_text(request: TokenizeRequest):
        from transformers.models.auto.tokenization_auto import AutoTokenizer

        entry = FEATURED_MODELS.get(request.model_name)
        hf_model_id = entry["model_id"] if entry else request.model_name
        tok_token = hf_token if (entry is None or entry.get("requires_hf_token")) else None

        if hf_model_id not in _tokenizer_cache:
            _tokenizer_cache[hf_model_id] = AutoTokenizer.from_pretrained(
                hf_model_id, token=tok_token
            )

        tokenizer = _tokenizer_cache[hf_model_id]
        ids = tokenizer.encode(request.text, add_special_tokens=True)
        special_ids = set(tokenizer.all_special_ids)
        tokens = []
        for i in ids:
            text = tokenizer.decode([i], skip_special_tokens=False)
            if not text and i in special_ids:
                toks = tokenizer.convert_ids_to_tokens([i])
                text = toks[0] if toks else f"[{i}]"
            tokens.append({"text": text, "special": i in special_ids})
        return {"tokens": tokens}

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

        cls, model_id = _resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_logit_lens.remote_gen.aio(
                    request.prompt, request.top_k
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-dla-stream")
    async def run_dla_stream(request: DlaRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_dla.remote_gen.aio(
                    request.prompt, request.target_position, request.target_token, request.contrastive_token
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-attribution-stream")
    async def run_attribution_stream(request: AttributionRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=True, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_attribution.remote_gen.aio(
                    request.prompt,
                    request.corrupted_prompt,
                    request.target_position,
                    request.target_token,
                    request.contrastive_token,
                    request.top_n,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-activation-patch-stream")
    async def run_activation_patch_stream(request: ActivationPatchRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=True, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_activation_patch.remote_gen.aio(
                    request.prompt,
                    request.corrupted_prompt,
                    request.target_position,
                    request.target_token_idx,
                    request.contrastive_token_idx,
                    request.components,
                    request.k,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-steering-stream")
    async def run_steering_stream(request: SteeringRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=False, hf_token=hf_token)  # forward-pass only

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_steering.remote_gen.aio(
                    request.clean_prompt,
                    request.corrupted_prompt,
                    request.target_position,
                    [c.model_dump() for c in request.components],
                    request.alpha,
                    request.n_tokens,
                    request.extra_pairs,
                    request.temperature,
                    request.repetition_penalty,
                    request.generation_prompt,
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @web_app.post("/api/run-attn-stream")
    async def run_attn_stream(request: AttentionRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_attn.remote_gen.aio(
                    request.prompt
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return web_app
