# RunPod Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Modal serverless GPU inference with RunPod Serverless, keeping the browser-facing SSE contract identical.

**Architecture:** One Docker image, four RunPod endpoints (one per GPU tier). Next.js polls RunPod's `/run` + `/stream/{id}` API and proxies results as SSE to the browser. The Python FastAPI service (models list, validation, tokenize, generate-pairs) moves to Railway.

**Tech Stack:** RunPod Serverless (Python handler), TransformerLens 3.0 / TransformerBridge, PyTorch 2.6.0, Next.js App Router, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-05-24-modal-to-runpod-design.md`

---

## File Map

**Created:**
- `backend/worker/requirements.txt` — Python deps for GPU worker image
- `backend/worker/model_cache.py` — in-process singleton model cache
- `backend/worker/inference.py` — ported `_TLBase` methods as `TLInference` statics
- `backend/worker/handler.py` — RunPod entrypoint, dispatch table
- `backend/Dockerfile` — GPU worker image (replaces Modal `tl_image`)
- `backend/Dockerfile.api` — lightweight FastAPI image for Railway
- `backend/worker/tests/test_model_cache.py` — pytest unit tests
- `.github/workflows/deploy-worker.yml` — CI/CD: build + push + update endpoints

**Modified:**
- `backend/main.py` — delete 6 streaming proxy endpoints (keep models, validate, tokenize, generate-pairs)
- `frontend/app/lib/api-helpers.ts` — replace `fetchUpstream`, add `resolveEndpointUrl`, `bumpTier`
- `frontend/app/api/run-lens/route.ts` — call site update
- `frontend/app/api/run-dla/route.ts` — call site update
- `frontend/app/api/run-attribution/route.ts` — call site update
- `frontend/app/api/run-activation-patch/route.ts` — call site update
- `frontend/app/api/run-steering/route.ts` — call site update
- `frontend/app/api/run-attn/route.ts` — call site update

---

## Task 1: Worker scaffold — requirements.txt and Dockerfile

**Files:**
- Create: `backend/worker/requirements.txt`
- Create: `backend/Dockerfile`

- [ ] **Step 1: Write requirements.txt**

```
# backend/worker/requirements.txt
torch==2.6.0
transformer-lens>=3.0
einops==0.8.1
fancy-einsum==0.0.3
jaxtyping==0.3.2
runpod
huggingface-hub
safetensors
pytest
```

- [ ] **Step 2: Write Dockerfile**

```dockerfile
# backend/Dockerfile
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

# HF will check this path first; volumes mount here for tl_xlarge endpoints.
# For tiers without a volume, HF falls back to /tmp download-on-demand.
ENV HF_HOME=/runpod-volume/huggingface-cache
ENV PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

RUN pip install --no-cache-dir \
    "transformer-lens>=3.0" \
    "einops==0.8.1" \
    "fancy-einsum==0.0.3" \
    "jaxtyping==0.3.2" \
    "runpod" \
    "huggingface-hub" \
    "safetensors"

COPY worker/ /app/
WORKDIR /app

CMD ["python", "handler.py"]
```

- [ ] **Step 3: Verify the Dockerfile syntax builds locally (CPU-only check)**

```bash
docker build -t doppo-worker-test backend/ --no-cache 2>&1 | tail -5
```

Expected: `Successfully built ...` (no CUDA at build time, so this just checks layers install).

- [ ] **Step 4: Commit**

```bash
git add backend/worker/requirements.txt backend/Dockerfile
git commit -m "feat: add RunPod worker scaffold (requirements + Dockerfile)"
```

---

## Task 2: model_cache.py

**Files:**
- Create: `backend/worker/model_cache.py`
- Create: `backend/worker/tests/__init__.py`
- Create: `backend/worker/tests/test_model_cache.py`

- [ ] **Step 1: Create test file**

```python
# backend/worker/tests/__init__.py
# (empty)
```

```python
# backend/worker/tests/test_model_cache.py
import importlib
import sys
from unittest.mock import MagicMock, patch

def _fresh_cache_module():
    """Import model_cache with a clean _cache dict each time."""
    if "model_cache" in sys.modules:
        del sys.modules["model_cache"]
    sys.path.insert(0, "backend/worker")
    return importlib.import_module("model_cache")

def test_cache_miss_calls_boot_transformers():
    mc = _fresh_cache_module()
    fake_model = MagicMock()
    with patch("transformer_lens.model_bridge.TransformerBridge.boot_transformers", return_value=fake_model) as mock_boot, \
         patch("torch.bfloat16", MagicMock()), \
         patch("torch.cuda.empty_cache"):
        result = mc.get_or_load_model("openai-community/gpt2")
    mock_boot.assert_called_once()
    assert result is fake_model

def test_cache_hit_skips_boot_transformers():
    mc = _fresh_cache_module()
    fake_model = MagicMock()
    mc._cache["openai-community/gpt2"] = fake_model
    with patch("transformer_lens.model_bridge.TransformerBridge.boot_transformers") as mock_boot:
        result = mc.get_or_load_model("openai-community/gpt2")
    mock_boot.assert_not_called()
    assert result is fake_model
```

- [ ] **Step 2: Run tests to verify they fail (module doesn't exist yet)**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo && python -m pytest backend/worker/tests/test_model_cache.py -v 2>&1 | tail -10
```

Expected: `ModuleNotFoundError: No module named 'model_cache'`

- [ ] **Step 3: Write model_cache.py**

```python
# backend/worker/model_cache.py
import os
import torch

_cache: dict[str, object] = {}


def _warmup(model) -> None:
    dummy = model.to_tokens("the quick brown fox")
    for _ in range(3):
        model(dummy)
    torch.cuda.empty_cache()


def get_or_load_model(model_id: str) -> object:
    """Return a cached TransformerBridge instance, loading on first call.

    HF_TOKEN is read from the environment — set it in RunPod endpoint settings
    for gated models (Llama, Gemma). HuggingFace libraries pick it up automatically.
    """
    if model_id not in _cache:
        from transformer_lens.model_bridge import TransformerBridge
        _cache[model_id] = TransformerBridge.boot_transformers(
            model_id,
            dtype=torch.bfloat16,
        )
        _cache[model_id].eval()
        _warmup(_cache[model_id])
    return _cache[model_id]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo && python -m pytest backend/worker/tests/test_model_cache.py -v 2>&1 | tail -10
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/worker/model_cache.py backend/worker/tests/
git commit -m "feat: add worker model cache with hit/miss tests"
```

---

## Task 3: inference.py — port _TLBase methods

**Files:**
- Create: `backend/worker/inference.py`

This file ports the six `_TLBase` methods from `backend/main.py` verbatim, with these mechanical transformations applied to every method:
1. `@modal.method()` → `@staticmethod`
2. First argument changes from `self` to `model`
3. `self.model` → `model` everywhere
4. `yield json.dumps({...})` → `yield {...}` (dict, not JSON string — RunPod serializes)
5. Remove `import json` from method bodies (no longer needed)

The inference logic itself is **not modified**.

- [ ] **Step 1: Write inference.py — helpers and class skeleton**

```python
# backend/worker/inference.py
"""
TLInference: static methods ported from _TLBase in backend/main.py.
Each method takes (model, inp: dict) and yields dicts.
RunPod serializes the yielded dicts; never yield json.dumps strings here.
"""
import torch


def _resolve_pos(tokens, target_position: int | str) -> int:
    return int(tokens.shape[-1]) - 1 if target_position == "last" else int(target_position)


def _gather_next_token_probs(probs, next_tokens):
    """probs: [n_layers, seq, vocab], next_tokens: [seq-1] → [n_layers, seq-1]"""
    return torch.gather(
        probs, dim=-1,
        index=next_tokens.view(1, -1, 1).expand(probs.shape[0], -1, 1),
    ).squeeze(-1)


class TLInference:
    pass
```

- [ ] **Step 2: Add run_logit_lens static method**

Copy `run_logit_lens` body from `backend/main.py` lines 975–1040, applying the 5 transformations above. The complete method:

```python
    @staticmethod
    def run_logit_lens(model, inp: dict):
        prompt = inp["prompt"]
        top_k = inp.get("top_k", 5)

        yield {"stage": "tokenizing"}
        tokens = model.to_tokens(prompt)

        yield {"stage": "forward_pass"}
        _, cache = model.run_with_cache(tokens)

        yield {"stage": "computing"}
        accumulated_residual, labels = cache.accumulated_resid(
            layer=-1, incl_mid=False, return_labels=True
        )
        resid_at_layers = accumulated_residual[:, 0, :, :]
        scaled_resid = model.ln_final(resid_at_layers)
        layer_logits = model.unembed(scaled_resid)
        layer_probs = layer_logits.softmax(dim=-1)

        pred_probs = layer_probs[:, :-1, :]
        next_tokens = tokens[0, 1:]
        gathered_probs = _gather_next_token_probs(pred_probs, next_tokens)
        token_strings = model.to_str_tokens(tokens)[1:]

        topk_vals, topk_ids = torch.topk(pred_probs, k=top_k, dim=-1)
        n_layers, n_pos, k = topk_ids.shape
        flat_ids = topk_ids.reshape(-1).cpu().tolist()
        flat_strs = [model.tokenizer.decode([int(tid)]) for tid in flat_ids]
        topk_token_strings = [
            [[flat_strs[li * n_pos * k + p * k + j] for j in range(k)] for p in range(n_pos)]
            for li in range(n_layers)
        ]

        eps = 1e-10
        final_probs = pred_probs[-1].float()
        final_top1_ids = final_probs.argmax(dim=-1)
        pos_range = torch.arange(n_pos, device=pred_probs.device)
        kl_data, rank_data, entropy_data = [], [], []
        for li in range(n_layers):
            p = pred_probs[li].float()
            kl_data.append(
                (p * (torch.log(p + eps) - torch.log(final_probs + eps))).sum(dim=-1).cpu().tolist()
            )
            target_p = p[pos_range, final_top1_ids]
            rank_data.append(
                (p > target_p.unsqueeze(-1)).sum(dim=-1).add(1).cpu().tolist()
            )
            entropy_data.append(
                (-(p * torch.log(p + eps)).sum(dim=-1)).cpu().tolist()
            )

        yield {
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
        }
```

- [ ] **Step 3: Add run_dla static method**

Copy `run_dla` body from `backend/main.py` lines 380–463, applying the 5 transformations. The complete method:

```python
    @staticmethod
    def run_dla(model, inp: dict):
        prompt = inp["prompt"]
        target_position = inp.get("target_position", "last")
        target_token = inp.get("target_token")
        contrastive_token = inp.get("contrastive_token")

        yield {"stage": "tokenizing"}
        tokens = model.to_tokens(prompt)
        pos = _resolve_pos(tokens, target_position)

        yield {"stage": "forward_pass"}
        _, cache = model.run_with_cache(tokens)

        yield {"stage": "computing"}

        n_layers = model.cfg.n_layers
        n_heads = model.cfg.n_heads

        if target_token is None:
            final_resid = cache[f"blocks.{n_layers - 1}.hook_resid_post"]
            final_logits = model.unembed(model.ln_final(final_resid))
            target_idx = int(final_logits[0, pos].argmax())
        else:
            ids = model.to_tokens(target_token, prepend_bos=False)
            target_idx = int(ids[0, 0])
        resolved_token = model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = model.tokenizer.decode([contrastive_idx])

        if contrastive_idx is not None:
            logit_dir = (model.W_U[:, target_idx] - model.W_U[:, contrastive_idx]).float()
        else:
            logit_dir = model.W_U[:, target_idx].float()

        embed_dla = float(cache["blocks.0.hook_in"][0, pos].float() @ logit_dir)

        W_O = model.W_O
        head_dla = []
        for layer in range(n_layers):
            z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()
            head_results = torch.einsum("hd,hdm->hm", z, W_O[layer].float())
            head_dla.append((head_results @ logit_dir).cpu().tolist())

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

        yield {
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
        }
```

- [ ] **Step 4: Add run_attribution static method**

Copy `run_attribution` body from `backend/main.py` lines 465–634, applying the 5 transformations. The complete method:

```python
    @staticmethod
    def run_attribution(model, inp: dict):
        clean_prompt = inp["prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        target_token = inp.get("target_token")
        contrastive_token = inp.get("contrastive_token")
        top_n = inp.get("top_n", 30)

        yield {"stage": "tokenizing"}
        clean_tokens = model.to_tokens(clean_prompt)
        corrupted_tokens = model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)

        n_layers = model.cfg.n_layers
        n_heads = model.cfg.n_heads

        yield {"stage": "clean_forward_pass"}
        with torch.no_grad():
            if target_token is None:
                clean_logits = model(clean_tokens)
                target_idx = int(clean_logits[0, pos].argmax())
                del clean_logits
            else:
                ids = model.to_tokens(target_token, prepend_bos=False)
                target_idx = int(ids[0, 0])
        resolved_token = model.tokenizer.decode([target_idx])

        contrastive_idx: int | None = None
        resolved_contrastive: str | None = None
        if contrastive_token is not None:
            ids = model.to_tokens(contrastive_token, prepend_bos=False)
            contrastive_idx = int(ids[0, 0])
            resolved_contrastive = model.tokenizer.decode([contrastive_idx])

        needed_hooks: set[str] = {
            f"blocks.{L}.{suffix}"
            for L in range(n_layers)
            for suffix in ("attn.hook_z", "hook_attn_out", "hook_mlp_out")
        }
        with torch.no_grad():
            _, clean_cache = model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in needed_hooks,
            )

        clean_z_cpu    = [clean_cache[f"blocks.{L}.attn.hook_z"][0, pos].float().cpu()    for L in range(n_layers)]
        clean_attn_cpu = [clean_cache[f"blocks.{L}.hook_attn_out"][0, pos].float().cpu()  for L in range(n_layers)]
        clean_mlp_cpu  = [clean_cache[f"blocks.{L}.hook_mlp_out"][0, pos].float().cpu()   for L in range(n_layers)]
        del clean_cache
        torch.cuda.empty_cache()

        yield {"stage": "corrupted_forward_backward"}

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
            logits_corrupted = model.run_with_hooks(corrupted_tokens, fwd_hooks=fwd_hooks)
            if contrastive_idx is not None:
                metric = logits_corrupted[0, pos, target_idx] - logits_corrupted[0, pos, contrastive_idx]
            else:
                metric = logits_corrupted[0, pos, target_idx]
            metric.backward()

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

        yield {"stage": "computing_attribution"}

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

        yield {
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
        }
```

- [ ] **Step 5: Add run_activation_patch static method**

Copy `run_activation_patch` body from `backend/main.py` lines 636–753, applying the 5 transformations. The complete method:

```python
    @staticmethod
    def run_activation_patch(model, inp: dict):
        clean_prompt = inp["prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        target_token_idx: int = inp["target_token_idx"]
        contrastive_token_idx: int | None = inp.get("contrastive_token_idx")
        components: list[dict] = inp.get("components", [])
        k: int = inp.get("k", 10)

        yield {"stage": "tokenizing"}
        clean_tokens = model.to_tokens(clean_prompt)
        corrupted_tokens = model.to_tokens(corrupted_prompt)
        pos = _resolve_pos(clean_tokens, target_position)
        top_components = components[:k]

        for comp in top_components:
            layer = comp["layer"]
            head = comp.get("head")
            if not (0 <= layer < model.cfg.n_layers):
                raise ValueError(f"layer {layer} out of range (model has {model.cfg.n_layers} layers)")
            if head is not None and head >= 0 and not (0 <= head < model.cfg.n_heads):
                raise ValueError(f"head {head} out of range (model has {model.cfg.n_heads} heads)")

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

        yield {"stage": "preparing"}
        device = clean_tokens.device
        with torch.no_grad():
            _, clean_cache = model.run_with_cache(
                clean_tokens,
                names_filter=lambda name: name in hook_names,
            )
            clean_metric = _metric(model(clean_tokens))
            corrupted_metric = _metric(model(corrupted_tokens))
        total_diff = max(abs(clean_metric - corrupted_metric), 1e-8)

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
                patched_logits = model.run_with_hooks(
                    corrupted_tokens,
                    fwd_hooks=[(hook_name, hook_fn)],
                )
            patched_metric = _metric(patched_logits)
            actual_effect = (patched_metric - corrupted_metric) / total_diff

            results.append({
                "layer": L,
                "head": H,
                "component_type": comp["component_type"],
                "attribution_score": comp["attribution_score"],
                "actual_effect": actual_effect,
            })

            yield {"stage": f"patching_{i + 1}_of_{len(top_components)}"}

        yield {"stage": "computing_effects"}
        yield {
            "stage": "done",
            "data": {
                "total_diff": total_diff,
                "components": results,
            },
        }
```

- [ ] **Step 6: Add run_steering static method**

Copy `run_steering` body from `backend/main.py` lines 755–972, applying the 5 transformations. The complete method:

```python
    @staticmethod
    def run_steering(model, inp: dict):
        clean_prompt = inp["clean_prompt"]
        corrupted_prompt = inp["corrupted_prompt"]
        target_position = inp.get("target_position", "last")
        components: list[dict] = inp.get("components", [])
        alpha: float = inp.get("alpha", 1.0)
        n_tokens: int = inp.get("n_tokens", 50)
        extra_pairs: list[dict] | None = inp.get("extra_pairs")
        temperature: float = inp.get("temperature", 1.0)
        repetition_penalty: float = inp.get("repetition_penalty", 1.3)
        generation_prompt: str | None = inp.get("generation_prompt")

        yield {"stage": "computing"}

        def _fmt(text: str) -> str:
            tmpl = getattr(model.tokenizer, "chat_template", None)
            if tmpl is not None:
                return model.tokenizer.apply_chat_template(
                    [{"role": "user", "content": text}],
                    tokenize=False,
                    add_generation_prompt=True,
                )
            return text

        with torch.no_grad():
            gen_prompt_resolved = generation_prompt if generation_prompt else clean_prompt
            gen_tokens = model.to_tokens(_fmt(gen_prompt_resolved))
            n_layers = model.cfg.n_layers

            all_pairs = [{"clean": clean_prompt, "corrupted": corrupted_prompt}]
            if extra_pairs:
                all_pairs.extend(extra_pairs)

            for comp in components:
                layer = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                head = comp.get("head")
                if not (0 <= layer < model.cfg.n_layers):
                    raise ValueError(f"layer {layer} out of range (model has {model.cfg.n_layers} layers)")
                if head is not None and not (0 <= head < model.cfg.n_heads):
                    raise ValueError(f"head {head} out of range (model has {model.cfg.n_heads} heads)")

            comp_accumulators: list[torch.Tensor | None] = [None] * len(components)

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
                p_clean = model.to_tokens(_fmt(pair["clean"]))
                p_corrupted = model.to_tokens(_fmt(pair["corrupted"]))

                if target_position == "last":
                    cp_pos = int(p_clean.shape[-1]) - 1
                    rp_pos = int(p_corrupted.shape[-1]) - 1
                else:
                    cp_pos = min(int(target_position), int(p_clean.shape[-1]) - 1)
                    rp_pos = min(int(target_position), int(p_corrupted.shape[-1]) - 1)

                _, cache_clean = model.run_with_cache(p_clean, names_filter=needed_hooks)
                _, cache_corrupted = model.run_with_cache(p_corrupted, names_filter=needed_hooks)

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

            pos = _resolve_pos(gen_tokens, target_position)
            n_pairs = len(all_pairs)
            dim_vectors = []
            for ci, comp in enumerate(components):
                L = comp["layer"] if comp["layer"] >= 0 else n_layers // 2
                H = comp.get("head")
                inj = comp.get("injection_type", "residual")
                avg_v = comp_accumulators[ci] / n_pairs
                dim_vectors.append((L, H, inj, avg_v / (avg_v.norm() + 1e-8)))

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

            baseline_ids = gen_tokens.clone()
            baseline_generated: list[int] = []
            for _ in range(n_tokens):
                logits = model(baseline_ids)
                next_id = _next_token(logits[0, -1], baseline_generated)
                baseline_generated.append(next_id)
                baseline_ids = torch.cat(
                    [baseline_ids, torch.tensor([[next_id]], device=baseline_ids.device)], dim=1
                )
            baseline_text = model.tokenizer.decode(baseline_ids[0, gen_tokens.shape[1]:].tolist())
            baseline_logits = model(gen_tokens)
            vals_b, ids_b = torch.topk(baseline_logits[0, pos].softmax(dim=-1), 5)
            top_k_baseline = [
                {"token": model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_b.tolist(), vals_b.tolist())
            ]

            steered_ids = gen_tokens.clone()
            steered_generated: list[int] = []
            for i in range(n_tokens):
                logits = model.run_with_hooks(steered_ids, fwd_hooks=fwd_hooks)
                next_id = _next_token(logits[0, -1], steered_generated)
                steered_generated.append(next_id)
                steered_ids = torch.cat(
                    [steered_ids, torch.tensor([[next_id]], device=steered_ids.device)], dim=1
                )
                yield {
                    "stage": "token",
                    "data": {"token": model.tokenizer.decode([next_id]), "index": i},
                }
            steered_text = model.tokenizer.decode(steered_ids[0, gen_tokens.shape[1]:].tolist())
            steered_logits = model.run_with_hooks(gen_tokens, fwd_hooks=fwd_hooks)
            vals_s, ids_s = torch.topk(steered_logits[0, pos].softmax(dim=-1), 5)
            top_k_steered = [
                {"token": model.tokenizer.decode([int(t)]), "prob": float(p)}
                for t, p in zip(ids_s.tolist(), vals_s.tolist())
            ]

            target_id = int(baseline_logits[0, pos].argmax())
            logit_diff = float(steered_logits[0, pos, target_id] - baseline_logits[0, pos, target_id])

        yield {
            "stage": "done",
            "data": {
                "steered_text": steered_text,
                "baseline_text": baseline_text,
                "top_k_steered": top_k_steered,
                "top_k_baseline": top_k_baseline,
                "logit_diff": logit_diff,
            },
        }
```

- [ ] **Step 7: Add run_attn static method**

Copy `run_attn` body from `backend/main.py` lines 1042–1075, applying the 5 transformations. The complete method:

```python
    @staticmethod
    def run_attn(model, inp: dict):
        prompt = inp["prompt"]

        TOKEN_CAP = 30
        tokens = model.to_tokens(prompt)
        truncated = tokens.shape[1] > TOKEN_CAP
        if truncated:
            tokens = tokens[:, :TOKEN_CAP]

        _, cache = model.run_with_cache(
            tokens,
            names_filter=lambda name: "hook_pattern" in name,
        )

        n_layers = model.cfg.n_layers
        patterns = []
        for layer in range(n_layers):
            layer_pats = cache[f"blocks.{layer}.attn.hook_pattern"][0].cpu().tolist()
            patterns.append(layer_pats)

        token_strs = model.tokenizer.convert_ids_to_tokens(tokens[0].tolist())

        yield {
            "stage": "done",
            "data": {
                "tokens": token_strs,
                "patterns": patterns,
                "n_layers": n_layers,
                "n_heads": model.cfg.n_heads,
                "truncated": truncated,
            },
        }
```

- [ ] **Step 8: Run syntax check**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo && python -c "
import sys; sys.path.insert(0, 'backend/worker')
# Mock torch and transformer_lens so we don't need GPU
import unittest.mock as m
sys.modules['torch'] = m.MagicMock()
sys.modules['transformer_lens'] = m.MagicMock()
sys.modules['transformer_lens.model_bridge'] = m.MagicMock()
import inference
print('TLInference methods:', [k for k in dir(inference.TLInference) if not k.startswith('_')])
"
```

Expected output: `TLInference methods: ['run_activation_patch', 'run_attn', 'run_attribution', 'run_dla', 'run_logit_lens', 'run_steering']`

- [ ] **Step 9: Commit**

```bash
git add backend/worker/inference.py
git commit -m "feat: port _TLBase inference methods to TLInference static class"
```

---

## Task 4: handler.py

**Files:**
- Create: `backend/worker/handler.py`

- [ ] **Step 1: Write handler.py**

```python
# backend/worker/handler.py
import runpod
from model_cache import get_or_load_model
from inference import TLInference

ENDPOINT_DISPATCH = {
    "run_logit_lens":       TLInference.run_logit_lens,
    "run_dla":              TLInference.run_dla,
    "run_attribution":      TLInference.run_attribution,
    "run_activation_patch": TLInference.run_activation_patch,
    "run_steering":         TLInference.run_steering,
    "run_attn":             TLInference.run_attn,
}


def handler(job):
    inp = job["input"]
    endpoint = inp.get("endpoint")
    model_id = inp.get("model_id")

    if endpoint not in ENDPOINT_DISPATCH:
        yield {"stage": "error", "error": f"Unknown endpoint: {endpoint!r}"}
        return

    if not model_id:
        yield {"stage": "error", "error": "model_id is required"}
        return

    yield {"stage": "Loading model weights…"}
    try:
        model = get_or_load_model(model_id)
    except Exception as e:
        yield {"stage": "error", "error": f"Model load failed: {e}"}
        return

    yield {"stage": "Running inference…"}
    try:
        yield from ENDPOINT_DISPATCH[endpoint](model, inp)
    except Exception as e:
        yield {"stage": "error", "error": f"Inference error: {e}"}


runpod.serverless.start({"handler": handler, "return_aggregate_stream": True})
```

- [ ] **Step 2: Run syntax check**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo && python -c "
import sys; sys.path.insert(0, 'backend/worker')
import unittest.mock as m
sys.modules['runpod'] = m.MagicMock()
sys.modules['torch'] = m.MagicMock()
sys.modules['transformer_lens'] = m.MagicMock()
sys.modules['transformer_lens.model_bridge'] = m.MagicMock()
import handler
print('Dispatch keys:', sorted(handler.ENDPOINT_DISPATCH.keys()))
"
```

Expected: `Dispatch keys: ['run_activation_patch', 'run_attn', 'run_attribution', 'run_dla', 'run_logit_lens', 'run_steering']`

- [ ] **Step 3: Commit**

```bash
git add backend/worker/handler.py
git commit -m "feat: add RunPod handler with 6-endpoint dispatch table"
```

---

## Task 5: Dockerfile.api for Railway

**Files:**
- Create: `backend/Dockerfile.api`

- [ ] **Step 1: Write Dockerfile.api**

```dockerfile
# backend/Dockerfile.api
# Lightweight FastAPI image for Railway — no GPU, no torch.
FROM python:3.12-slim

RUN pip install --no-cache-dir \
    "fastapi[standard]" \
    "pydantic" \
    "huggingface-hub>=0.27" \
    "transformers>=4.40"

COPY main.py /app/main.py
WORKDIR /app

CMD ["fastapi", "run", "main.py", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
git add backend/Dockerfile.api
git commit -m "feat: add lightweight Dockerfile.api for Railway FastAPI service"
```

---

## Task 6: Strip streaming proxies from main.py

**Files:**
- Modify: `backend/main.py` — delete lines 1275–1395 (the 6 `@web_app.post("/api/run-*-stream")` functions)

- [ ] **Step 1: Delete the streaming proxy endpoint functions**

Open `backend/main.py`. Delete these 6 functions (they are the only things being removed):
- `run_logit_lens_stream` (lines ~1275–1290)
- `run_dla_stream` (lines ~1292–1307)
- `run_attribution_stream` (lines ~1309–1329)
- `run_activation_patch_stream` (lines ~1331–1352)
- `run_steering_stream` (lines ~1354–1378)
- `run_attn_stream` (lines ~1380–1395)

Keep everything else: `list_models`, `validate_model`, `tokenize_text`, all class definitions, FEATURED_MODELS, validation helpers.

Also update the CORS `allow_origins` to add the Railway domain (add it when the Railway URL is known):
```python
allow_origins=["http://localhost:3000"],  # add Railway URL here when known
```

- [ ] **Step 2: Verify syntax**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo && python -c "
import ast
with open('backend/main.py') as f:
    src = f.read()
ast.parse(src)
print('Syntax OK. Lines remaining:', src.count('\n'))
"
```

Expected: `Syntax OK. Lines remaining: ~850` (exact number varies)

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: remove streaming proxy endpoints from FastAPI service"
```

---

## Task 7: api-helpers.ts — polling fetchUpstream + endpoint routing

**Files:**
- Modify: `frontend/app/lib/api-helpers.ts`

The current file (120 lines) exports `fetchUpstream` with an `UpstreamResult` return type. This task replaces that function and adds `resolveEndpointUrl` and `bumpTier`.

- [ ] **Step 1: Remove the old fetchUpstream and UpstreamResult from api-helpers.ts**

Delete lines 79–120 (the `UpstreamResult` type and old `fetchUpstream` function).

- [ ] **Step 2: Add the new exports at the bottom of api-helpers.ts**

```typescript
// ── RunPod endpoint routing ───────────────────────────────────────────────────

const RUNPOD_ENDPOINTS: Record<GpuTier, string> = {
  tl_small:   process.env.RUNPOD_ENDPOINT_SMALL!,
  tl_medium:  process.env.RUNPOD_ENDPOINT_MEDIUM!,
  tl_large:   process.env.RUNPOD_ENDPOINT_LARGE!,
  tl_xlarge:  process.env.RUNPOD_ENDPOINT_XLARGE!,
};

function bumpTier(tier: GpuTier): GpuTier {
  const order: GpuTier[] = ["tl_small", "tl_medium", "tl_large", "tl_xlarge"];
  const idx = order.indexOf(tier);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function resolveEndpointUrl(tier: GpuTier, bump = false): string {
  return RUNPOD_ENDPOINTS[bump ? bumpTier(tier) : tier];
}

// ── RunPod polling fetchUpstream ─────────────────────────────────────────────

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const POLL_INTERVAL_MS = 400;

type RunPodChunk = {
  output: { stage: string; data?: unknown; error?: string };
};

/**
 * Submit a job to a RunPod endpoint and poll /stream until done.
 * Writes SSE events to `writer` as they arrive.
 * Returns the `data` payload from the "done" event, or null on error.
 */
export async function fetchUpstream(
  endpointUrl: string,
  body: unknown,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<unknown> {
  const send = async (data: object) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  let submitRes: Response;
  try {
    submitRes = await fetch(`${endpointUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input: body }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await send({ stage: "error", error: `Could not reach inference backend: ${msg}` });
    return null;
  }

  if (!submitRes.ok) {
    await send({ stage: "error", error: `RunPod submit failed: ${submitRes.status}` });
    return null;
  }

  const { id: jobId } = (await submitRes.json()) as { id: string };
  let doneData: unknown = null;

  for (;;) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await fetch(`${endpointUrl}/stream/${jobId}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await send({ stage: "error", error: `Poll failed: ${msg}` });
      return null;
    }

    if (!pollRes.ok) {
      await send({ stage: "error", error: `RunPod poll HTTP ${pollRes.status}` });
      return null;
    }

    const { stream, status } = (await pollRes.json()) as {
      stream?: RunPodChunk[];
      status: string;
    };

    for (const chunk of stream ?? []) {
      await send(chunk.output);
      if (chunk.output.stage === "done") doneData = chunk.output.data ?? null;
      if (chunk.output.stage === "done" || chunk.output.stage === "error") return doneData;
    }

    if (status === "FAILED") {
      await send({ stage: "error", error: "RunPod job failed" });
      return null;
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to api-helpers).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/lib/api-helpers.ts
git commit -m "feat: replace fetchUpstream with RunPod polling loop, add resolveEndpointUrl"
```

---

## Task 8: Update run-lens/route.ts

**Files:**
- Modify: `frontend/app/api/run-lens/route.ts`

- [ ] **Step 1: Update imports — remove parseSSE, add resolveEndpointUrl**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find the section starting at `// Cache miss — connect to Modal` (around line 82) and replace everything from that comment to the final `return new Response(readable, ...)` with:

```typescript
  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_logit_lens",
    model_id: modelName,
    prompt,
    top_k: resolvedTopK,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(id, doneData);
        await db
          .insert(heatmapCache)
          .values({ id, prompt, modelName, r2Key: id })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | grep "run-lens" | head -10
```

Expected: no errors for run-lens/route.ts.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-lens/route.ts
git commit -m "feat: migrate run-lens route to RunPod polling"
```

---

## Task 9: Update run-dla/route.ts

**Files:**
- Modify: `frontend/app/api/run-dla/route.ts`

- [ ] **Step 1: Update imports**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find `const upstreamResult = await fetchUpstream(` (around line 84) and replace from there to the final return:

```typescript
  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_dla",
    model_id: modelName,
    prompt,
    target_position: targetPosition,
    target_token: targetToken,
    contrastive_token: contrastiveToken ?? null,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(dlaCache)
          .values({
            id: cacheKey,
            modelName,
            prompt,
            targetPosition: String(targetPosition),
            targetToken: targetToken ?? "__auto__",
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("DLA cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

Note: preserve the existing `cacheKey` construction above this block — only the fetchUpstream call and streaming block changes.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | grep "run-dla" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-dla/route.ts
git commit -m "feat: migrate run-dla route to RunPod polling"
```

---

## Task 10: Update run-attribution/route.ts

**Files:**
- Modify: `frontend/app/api/run-attribution/route.ts`

- [ ] **Step 1: Update imports**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find `const upstreamResult = await fetchUpstream(` (around line 120) and replace from there to the final return. Note `bump=true` for this route.

```typescript
  // Cache miss — submit to RunPod and poll (bump=true: backward pass needs extra VRAM).
  const endpointUrl = resolveEndpointUrl(resolvedTier, true);
  const workerInput = {
    endpoint: "run_attribution",
    model_id: modelName,
    prompt: cleanPrompt,
    corrupted_prompt: corruptedPrompt,
    target_position: targetPosition,
    target_token: targetToken,
    contrastive_token: contrastiveToken ?? null,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(attributionCache)
          .values({
            id: cacheKey,
            modelName,
            prompt: cleanPrompt,
            corruptedPrompt,
            targetPosition: resolvedPosition,
            targetToken: resolvedToken,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Attribution cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | grep "run-attribution" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-attribution/route.ts
git commit -m "feat: migrate run-attribution route to RunPod polling (bump tier)"
```

---

## Task 11: Update run-activation-patch/route.ts

**Files:**
- Modify: `frontend/app/api/run-activation-patch/route.ts`

- [ ] **Step 1: Update imports**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find `const upstreamResult = await fetchUpstream(` (around line 130) and replace from there to the final return. Note `bump=true` for this route.

```typescript
  // Cache miss — submit to RunPod and poll (bump=true: backward pass needs extra VRAM).
  const endpointUrl = resolveEndpointUrl(resolvedTier, true);
  const workerInput = {
    endpoint: "run_activation_patch",
    model_id: modelName,
    prompt: cleanPrompt,
    corrupted_prompt: corruptedPrompt,
    target_position: targetPosition,
    target_token_idx: targetTokenIdx,
    contrastive_token_idx: contrastiveTokenIdx ?? null,
    components,
    k,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(activationPatchCache)
          .values({
            id: cacheKey,
            modelName,
            prompt: cleanPrompt,
            corruptedPrompt,
            targetPosition: String(targetPosition),
            targetTokenIdx,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Activation patch cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

Note: the existing cache DB insert fields — check the exact column names in `app/schema.ts` for `activationPatchCache` and match them.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | grep "run-activation" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-activation-patch/route.ts
git commit -m "feat: migrate run-activation-patch route to RunPod polling (bump tier)"
```

---

## Task 12: Update run-steering/route.ts

**Files:**
- Modify: `frontend/app/api/run-steering/route.ts`

- [ ] **Step 1: Update imports**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find `const upstreamResult = await fetchUpstream(` (around line 175) and replace from there to the final return.

```typescript
  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_steering",
    model_id: modelName,
    clean_prompt: cleanPrompt,
    corrupted_prompt: corruptedPrompt,
    generation_prompt: generationPrompt ?? null,
    target_position: targetPosition,
    components: components.map((c) => ({
      layer: c.layer,
      head: c.head,
      injection_type: c.injectionType,
    })),
    alpha,
    n_tokens: nTokens,
    extra_pairs: extraPairs ?? null,
    temperature,
    repetition_penalty: repetitionPenalty,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(steeringCache)
          .values({
            id: cacheKey,
            modelName,
            prompt: cleanPrompt,
            corruptedPrompt,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Steering cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

Note: check the variable names for `repetitionPenalty` in the existing route — it may be `repetition_penalty` depending on how the request is destructured. Match exactly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | grep "run-steering" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-steering/route.ts
git commit -m "feat: migrate run-steering route to RunPod polling"
```

---

## Task 13: Update run-attn/route.ts

**Files:**
- Modify: `frontend/app/api/run-attn/route.ts`

- [ ] **Step 1: Update imports**

```typescript
import {
  SSE_HEADERS,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
  resolveModelTier,
  resolveEndpointUrl,
} from "@/app/lib/api-helpers";
```

- [ ] **Step 2: Replace the fetchUpstream call and streaming block**

Find `const upstreamResult = await fetchUpstream(` (around line 74) and replace from there to the final return.

```typescript
  // Cache miss — submit to RunPod and poll.
  const endpointUrl = resolveEndpointUrl(resolvedTier);
  const workerInput = {
    endpoint: "run_attn",
    model_id: modelName,
    prompt,
  };

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      doneData = await fetchUpstream(endpointUrl, workerInput, writer, encoder);
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(attnCache)
          .values({
            id: cacheKey,
            modelName,
            prompt,
            r2Key: cacheKey,
          })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Attn cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
```

Note: check the exact column names in `app/schema.ts` for `attnCache` and match them.

- [ ] **Step 3: Verify all routes compile clean**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/run-attn/route.ts
git commit -m "feat: migrate run-attn route to RunPod polling"
```

---

## Task 14: GitHub Actions CI/CD workflow

**Files:**
- Create: `.github/workflows/deploy-worker.yml`

- [ ] **Step 1: Create the workflow directory if it doesn't exist**

```bash
mkdir -p /Users/thisisnotmyname/webdevplayground/doppo/.github/workflows
```

- [ ] **Step 2: Write the workflow file**

```yaml
# .github/workflows/deploy-worker.yml
name: Deploy RunPod Worker

on:
  push:
    branches: [main]
    paths:
      - "backend/worker/**"
      - "backend/Dockerfile"

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: backend
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:${{ github.sha }}

      - name: Update RunPod endpoints
        env:
          RUNPOD_API_KEY: ${{ secrets.RUNPOD_API_KEY }}
          IMAGE: ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:${{ github.sha }}
          ENDPOINT_SMALL:   ${{ secrets.RUNPOD_ENDPOINT_ID_SMALL }}
          ENDPOINT_MEDIUM:  ${{ secrets.RUNPOD_ENDPOINT_ID_MEDIUM }}
          ENDPOINT_LARGE:   ${{ secrets.RUNPOD_ENDPOINT_ID_LARGE }}
          ENDPOINT_XLARGE:  ${{ secrets.RUNPOD_ENDPOINT_ID_XLARGE }}
        run: |
          for ID in "$ENDPOINT_SMALL" "$ENDPOINT_MEDIUM" "$ENDPOINT_LARGE" "$ENDPOINT_XLARGE"; do
            curl -sf -X PATCH "https://api.runpod.io/v2/endpoint/${ID}" \
              -H "Authorization: Bearer $RUNPOD_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{\"dockerImage\": \"$IMAGE\"}" \
            && echo "Updated $ID" || echo "WARN: Failed to update $ID"
          done
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy-worker.yml
git commit -m "feat: add GitHub Actions CI/CD for RunPod worker image"
```

---

## Task 15: Manual setup — RunPod endpoints + Railway + env vars

This task requires manual steps in external consoles. No code changes.

- [ ] **Step 1: Push Docker image manually (first time)**

```bash
docker build -t <dockerhub-user>/doppo-worker:manual-init backend/
docker push <dockerhub-user>/doppo-worker:manual-init
```

- [ ] **Step 2: Create four RunPod Serverless endpoints in the RunPod console**

For each tier, create a new Serverless endpoint with:
| Setting | tl_small | tl_medium | tl_large | tl_xlarge |
|---|---|---|---|---|
| Docker image | `<user>/doppo-worker:manual-init` | same | same | same |
| GPU | L4 | L40S | A100-80GB | H200 |
| Scale-down window | 30s | 30s | 15s | 10s |
| Max workers | 3 | 2 | 1 | 1 |
| Environment vars | `HF_TOKEN=<your-hf-token>` | same | same | same |
| Volume (tl_xlarge only) | — | — | — | Attach Network Volume at `/runpod-volume` |

Copy each endpoint's ID (not full URL) — needed for GitHub secrets.

- [ ] **Step 3: Add secrets to GitHub repository settings**

Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

```
DOCKERHUB_USERNAME   = <your Docker Hub username>
DOCKERHUB_TOKEN      = <Docker Hub access token>
RUNPOD_API_KEY       = <RunPod API key>
RUNPOD_ENDPOINT_ID_SMALL    = <bare endpoint ID, e.g. abc123>
RUNPOD_ENDPOINT_ID_MEDIUM   = <bare endpoint ID>
RUNPOD_ENDPOINT_ID_LARGE    = <bare endpoint ID>
RUNPOD_ENDPOINT_ID_XLARGE   = <bare endpoint ID>
```

- [ ] **Step 4: Add env vars to .env.local**

```bash
# Append to frontend/.env.local
RUNPOD_API_KEY=<your-runpod-api-key>
RUNPOD_ENDPOINT_SMALL=https://api.runpod.ai/v2/<endpoint-id-small>
RUNPOD_ENDPOINT_MEDIUM=https://api.runpod.ai/v2/<endpoint-id-medium>
RUNPOD_ENDPOINT_LARGE=https://api.runpod.ai/v2/<endpoint-id-large>
RUNPOD_ENDPOINT_XLARGE=https://api.runpod.ai/v2/<endpoint-id-xlarge>
```

`NEXT_PUBLIC_API_URL` stays — update its value to the Railway URL once Railway is deployed.

- [ ] **Step 5: Deploy FastAPI service to Railway**

1. Create a new Railway project
2. Connect the GitHub repo
3. Set the root directory to `backend/`
4. Set the Dockerfile path to `backend/Dockerfile.api`
5. Add env var: `HF_TOKEN=<your-hf-token>`
6. Deploy. Copy the generated URL (e.g. `https://doppo-api.railway.app`)
7. Update `NEXT_PUBLIC_API_URL` in `.env.local` to the Railway URL
8. Update `allow_origins` in `backend/main.py` to include the Railway URL

- [ ] **Step 6: Smoke test all six endpoints**

Start the dev server: `npm run dev` in `frontend/`

Test each endpoint type in the UI:
- Logit lens: run GPT-2 Small with any short prompt → verify heatmap appears
- DLA: same model/prompt → verify DLA chart appears
- Attribution: provide clean/corrupted prompts → verify attribution chart
- Activation patch: run after attribution → verify patch results
- Steering: select a component, run steering → verify steered text streams in
- Attention: run any model → verify attention pattern grid appears

For each, check the browser Network tab → SSE stream shows `stage` events including `done`.

---

## Self-Review

**Spec coverage check:**
- ✅ RunPod handler/dispatch (Task 4)
- ✅ Model cache / warm worker reuse (Task 2)
- ✅ Inference methods ported (Task 3)
- ✅ Docker image (Task 1)
- ✅ FastAPI service cleanup (Tasks 5–6)
- ✅ `fetchUpstream` polling loop (Task 7)
- ✅ `resolveEndpointUrl` / `bumpTier` (Task 7)
- ✅ All 6 inference routes updated (Tasks 8–13)
- ✅ CI/CD workflow (Task 14)
- ✅ Env vars + manual RunPod setup (Task 15)
- ✅ `HF_TOKEN` set as RunPod env var, not passed from client (Task 15 Step 2)
- ✅ `bump=true` for attribution and activation-patch (Tasks 10–11)
- ✅ Network Volume via `HF_HOME` env var, not manual path check (Task 1 Dockerfile)

**Placeholder scan:** No TBDs, no "similar to Task N" shortcuts, no "implement later".

**Type consistency:**
- `resolveEndpointUrl(tier: GpuTier, bump = false): string` — used correctly in Tasks 8–13
- `fetchUpstream(endpointUrl, body, writer, encoder): Promise<unknown>` — signature consistent across all call sites
- `TLInference.run_logit_lens(model, inp: dict)` — dispatch key `"run_logit_lens"` matches handler table

**Known issue to watch:** Task 11 and 13 note "check exact column names in app/schema.ts." The implementer must read `app/schema.ts` for `activationPatchCache` and `attnCache` column names before writing the DB insert — these were not pulled into the plan to avoid stale references.
