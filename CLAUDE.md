@AGENTS.md

Logit lens visualization tool — no-code mechanistic interpretability for any HuggingFace model.
Stack: Next.js, FastAPI, TransformerLens 3.0, Modal (serverless GPU), Neon + BetterAuth + Drizzle.

## Dev commands

```
npm run dev                     # frontend: localhost:3000
modal serve backend/main.py     # backend hot-reload (prints temp URL)
modal deploy backend/main.py    # production — prints stable URL
```

## Behavioral rules

- **New card type checklist:** update `AnyCard` union in `SandboxCanvas.tsx`, add a case to `renderCard()`, add optional fields to `SerializedCard` in `actions.ts`, add `?? default` in DB restore block in `page.tsx`.
- **`/api/run-steering` payload changes:** sync all three fetch paths in `page.tsx` — `handleSteerComponents`, `handleRerunSteering`, `handleAddStandaloneSteer`.
- **Drizzle migrations in bash:** `drizzle-kit migrate/push` hangs in non-TTY. Use `.mjs` workaround — see `.claude/rules/database.md`.
- **GPU tier labels:** always import from `app/lib/tiers.ts`. Never redefine inline.
- **Auth gate:** `tl_small` models are unauthenticated; all other tiers require a session. Always verify `userId` ownership before mutating DB rows.

## Backend (backend/main.py)

- `_TLBase` — shared inference base; all endpoints (`run_lens`, `run_dla`, `run_attribution`, `run_activation_patch`, `run_steering`) are methods here
- `TransformerLensSmall/Medium/Large/XLarge` — GPU-tiered Modal classes, each extends `_TLBase`
- `api()` — FastAPI web endpoint (lightweight image, no torch)
- `FEATURED_MODELS` — editorial curation for the UI only; not a gate on what `run-lens` accepts
- `_detect_gpu_tier()` / `_bump_tier()` — param-count-to-tier mapping; `_bump_tier` used for attribution backward passes (need ~2–3× model weights in VRAM)

**GPU tiers:**
- `tl_small` → L4 (< 4B params; 24 GB, $0.80/hr)
- `tl_medium` → L40S (4–10B; 48 GB, $1.95/hr)
- `tl_large` → A100-80GB (10–25B; 80 GB, $2.50/hr)
- `tl_xlarge` → H200 (25–70B; 141 GB, $4.54/hr)

>70B and multi-GPU are rejected. B200 unsupported (image pins torch==2.6.0; B200 needs 2.7+).

## TransformerLens 3.0 — critical API differences

Use `TransformerBridge.boot_transformers(hf_model_id)` — not `HookedTransformer.from_pretrained`. Full HF IDs required (`"openai-community/gpt2"`, not `"gpt2-small"`). Weight-processing kwargs (`fold_ln`, `center_unembed`) are gone.

**Local venv is TL 2.18.0.** `TransformerBridge` only runs on Modal — never try to import `model_bridge` locally.

Hook callbacks: second parameter MUST be named `hook` — any other name raises `unexpected keyword argument 'hook'`:
```python
def _fn(value, hook):
    return value
```

`hook_result` doesn't exist in TL3. Compute per-head post-W_O output manually:
```python
z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()  # [n_heads, d_head]
head_results = torch.einsum("hd,hdm->hm", z, model.W_O[layer].float())  # [n_heads, d_model]
```

Full hook name strings only — tuple shorthand is gone:
- `cache[f"blocks.{layer}.hook_attn_out"]` not `cache["attn_out", layer]`
- `cache[f"blocks.{layer}.hook_mlp_out"]`, `cache[f"blocks.{layer}.hook_resid_post"]`

`W_pos` / `W_E` don't exist on `TransformerBridge`. Use `cache["blocks.0.hook_in"][0, pos]` for embedding contribution (= `W_E[token] + W_pos[pos]` for absolute positional; `W_E[token]` only for RoPE). `W_U` and `W_O` do work.

`to_single_token()` is gone — use `model.to_tokens(token, prepend_bos=False)[0, 0]`.

## Frontend key files

- `app/page.tsx` — hero (server component); client state/effects must live in child `"use client"` components
- `app/projects/page.tsx` — canvas; `useReducer` for `{ lensCards, canvas }`
- `app/schema.ts` — all Drizzle table definitions
- `app/actions.ts` — all server actions (`"use server"` file-level directive)
- `app/components/SandboxCanvas.tsx` — exports `AnyCard` union; `renderCard()` switch
- `app/lib/tiers.ts` — canonical GPU tier labels
- `app/lib/palette.ts` — `interpolateColor(palette, prob)` [0,1]; `interpolateColorDivergent` for signed DLA
- `app/share/[shareId]/` — `page.tsx` (server) + `ShareCanvas.tsx` (client, noop callbacks)

## API contracts

```
/api/models              → { id, display_name, description, requires_hf_token }[]
/api/validate-model      → { valid, gpu_tier, reason }
/api/run-lens            → SSE → done: { x_labels, y_labels, heatmap_data }
/api/run-dla             → { target_token, target_position, y_labels, x_labels, layer_dla, head_dla }
/api/run-attribution     → { target_token, target_token_idx, ..., top_k_components } — cached
/api/run-activation-patch → { total_diff, components[{layer, head, component_type, attribution_score, actual_effect}] } — ephemeral
/api/run-steering        → { steered_text, baseline_text, top_k_steered, top_k_baseline, logit_diff }
/api/generate-pairs      → { pairs: [{clean, corrupted}], n_requested }
```

See `.claude/rules/` for: frontend patterns, database/Drizzle, Modal infrastructure.
