@AGENTS.md

This is a Next.js logit lens visualization/research tool that's intended to be used as a quick no-code alternative to writing out code in a notebook.

The stack is Next.js, Torch + TransformerLens 3.0, FastAPI, Modal, and Neon w/ BetterAuth (Neon Auth) + Drizzle.

There are several things in the works like reducing inference costs via Modal Volumes and GPU Snapshots, but the effect that these have on the final product is unknown. Better Neon integration and refactoring of the backend follows this as well.

---

## Backend architecture notes

### TransformerLens 3.0

TL 3.0 replaces `HookedTransformer` with `TransformerBridge`. Use `TransformerBridge.boot_transformers(hf_model_id)` — not `HookedTransformer.from_pretrained`. Short aliases (`"gpt2-small"`) are deprecated; use full HF IDs (`"openai-community/gpt2"`). Weight-processing kwargs (`fold_ln`, `center_unembed`, etc.) no longer exist.

TL 3.0 supports ~9,000 models out of the box, so any standard HF model can be loaded through the same `_TLBase` class — there is no need to special-case architectures.

**Multi-GPU is not supported.** `TransformerBridge` does not support `device_map="auto"`. Models requiring multiple GPUs (typically >30B params) cannot be loaded. These are rejected at validation time.

### Model loading (backend/main.py)

`FEATURED_MODELS` is editorial curation for the frontend — it is **not a gate** on what can run. Any valid HF model ID is accepted by `run-lens`. Featured entries have explicit `gpu_tier` values; custom models get their tier auto-detected.

**GPU tiers:**
- `tl_small` → L4 (< 4B params)
- `tl_medium` → A10G (4–12B params)
- `tl_large` → A100-80GB (12–30B params)

**GPU tier detection** reads `num_parameters` from `config.json` first; falls back to `num_hidden_layers × hidden_size` as a proxy. Returns `None` (→ rejected) if the model is likely >30B. Conservative fallback when config is absent: `tl_large`.

---

## Frontend architecture notes

### ConfigPane

The model selection UI has two mutually exclusive modes:
1. **Featured model cards** — 2-column grid, scrollable, populated from `/api/models`. Clicking a card deselects any custom input.
2. **Any HuggingFace model** — open text input. Typing anything deselects the featured grid. Requires explicit "Validate" step before "Run Lens" is enabled.

`/api/validate-model` returns `{valid, gpu_tier, reason}`. The `gpu_tier` is shown in the success label (`✓ Valid — A10G`). There is no PEFT-specific UI path.

### API contract

`/api/models` → `{ id, display_name, description, requires_hf_token }[]`
`/api/validate-model` → `{ valid, gpu_tier, reason }`
`/api/run-lens` → `{ x_labels, y_labels, heatmap_data }`