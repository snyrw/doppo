@AGENTS.md

Logit lens visualization tool — no-code mechanistic interpretability for any HuggingFace model.
Stack: Next.js, FastAPI, TransformerLens 3.0, Modal (serverless GPU), Neon + BetterAuth + Drizzle.

## Dev commands

```
cd frontend && npm run dev      # frontend: localhost:3000
modal deploy backend/main.py    # deploy backend (requires Modal credentials)
```

## Behavioral rules

- **Modal async in `api()`:** All route handlers in the `api()` FastAPI function are `async def`. Use `.aio()` variants for every Modal call: `.spawn.aio()`, `FunctionCall.from_id.aio()`, `.get.aio(timeout=0)`, `.cancel.aio()`. Sync versions cause `AsyncUsageWarning` and block the event loop.
- **`injection_type` vs `injectionType`:** Frontend `SteeringComponent` uses camelCase `injectionType`; the backend Pydantic model expects snake_case `injection_type`. `spawn-steering/route.ts` maps this before sending. Any new steering-related endpoint must do the same.
- **Backend deploys on push, not commit:** GitHub Actions only triggers on `git push` to `main`. Local commits to `backend/main.py` are not deployed until pushed.
- **New card type checklist:** update `AnyCard` union in `SandboxCanvas.tsx`, add a case to `renderCard()`, add a branch to `serializeCard()` in `projects/helpers.ts`, add optional fields to `SerializedCard` in `actions.ts`, add `?? default` in DB restore blocks in `projects/page.tsx` and `share/[shareId]/page.tsx`, add `tutorialMode?: boolean` prop + hide remove button (and any mutation-only controls) when true — see Tutorial mode section in `.claude/rules/frontend.md`.
- **`/api/run-steering` payload changes:** sync all three fetch bodies in `projects/hooks/useSteeringHandlers.ts` — `steerComponents`, `rerunSteering`, `addStandaloneSteer`.
- **Drizzle migrations in bash:** `drizzle-kit migrate/push` hangs in non-TTY. Use `.mjs` workaround — see `.claude/rules/database.md`.
- **GPU tier labels:** always import from `frontend/app/lib/tiers.ts`. Never redefine inline.
- **Auth gate:** All GPU inference requires authentication and credits — there is no anonymous inference tier. Credits billing is live. Always verify `userId` ownership before mutating DB rows. Exception: `/tutorial` is publicly accessible but serves pre-computed static data — no live GPU calls.
- **Stripe (deferred):** Checkout and webhook routes are fully implemented but gated by missing env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`). To activate: (1) set those three vars in Railway, (2) register `https://doppo.tools/api/stripe/webhook` in the Stripe dashboard for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. No code changes needed — the guards in `api/credits/checkout/route.ts` and `api/stripe/webhook/route.ts` will fall through automatically.
- **Tutorial (`/tutorial`):** Pre-computed, no-auth walkthrough of all six tools — IOI circuit on GPT-2 Small (steps 1–5) and English→French DIM steering on Qwen2.5-1.5B-Instruct (step 6). Results live in `frontend/app/tutorial/data.json` (committed, imported at build time — no GPU at runtime). To regenerate: `python scripts/generate_tutorial_data.py` (reads `frontend/.env.local` for `NEXT_PUBLIC_API_URL`, calls the Modal backend directly, ~5–10 min), then commit the file. **Script calls Modal `api()` endpoints directly** (not Next.js routes), so: responses are snake_case (`job_id` not `jobId`); `SpawnAttributionRequest` and `SpawnActivationPatchRequest` use `prompt` for the clean prompt; `SpawnSteeringRequest` uses `clean_prompt`.

## Backend (backend/main.py)

- `_TLBase` class — shared inference logic with methods for all 7 analysis types (`run_logit_lens`, `run_dla`, `run_attribution`, `run_activation_patch`, `run_steering`, `run_attn`)
- `_TLBase` also has `_result` wrapper methods (`run_logit_lens_result`, etc.) — non-generator wrappers that call the generator via `.local()` and return only the final `done` data dict; used by the async spawn+poll system
- Five Modal GPU-tier classes (`TransformerLensSmall`, `TransformerLensMedium`, `TransformerLensLarge`, `TransformerLensXLarge`, `TransformerLensXXLarge`) — one per GPU tier
- `FEATURED_MODELS` — editorial curation for the UI only; not a gate on what `run-lens` accepts
- `_detect_gpu_tier()` / `_bump_tier()` — param-count-to-tier mapping; `_bump_tier` used for attribution/activation-patch backward passes (need ~2–3× model weights in VRAM)
- Async spawn+poll endpoints live in `api()`: `POST /api/job/spawn-{lens,attn,dla,attribution,activation-patch,steering}`, `GET /api/job/{job_id}` (poll), `DELETE /api/job/{job_id}` (cancel)
- `activeJobs` DB table tracks in-flight jobs for billing (elapsed time) and cache writes on completion
- Deployed via `modal deploy backend/main.py`; GitHub Actions CI/CD on changes to `backend/main.py`
- Single env var `NEXT_PUBLIC_API_URL` points to the deployed Modal app URL

**GPU tiers:**
- `tl_small` → L4 (< 4B params; 24 GB)
- `tl_medium` → L40S (4–10B; 48 GB)
- `tl_large` → A100-80GB (10–25B; 80 GB)
- `tl_xlarge` → H200 (25–69B; 141 GB)
- `tl_xxlarge` → B200 (70B–100B; 192 GB)

>100B and multi-GPU are rejected.

## TransformerLens 3.0 — critical API differences

Use `TransformerBridge.boot_transformers(hf_model_id)` — not `HookedTransformer.from_pretrained`. Full HF IDs required (`"openai-community/gpt2"`, not `"gpt2-small"`). Weight-processing kwargs (`fold_ln`, `center_unembed`) are gone.

**Local venv is TL 2.18.0.** `TransformerBridge` only runs on the Modal worker — never try to import `model_bridge` locally.

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

All frontend source lives under `frontend/app/`.

- `frontend/app/page.tsx` — hero (server component); renders `<Navbar>` + `<HeroContent>`
- `frontend/app/components/HeroContent.tsx` — hero UI with tabs (techniques / inference / pricing)
- `frontend/app/projects/page.tsx` — canvas; `useReducer` for `{ lensCards, canvas }`; imports from hooks/types/helpers
- `frontend/app/projects/hooks/useSSEHandlers.ts` — polling-based card creation (spawn+poll, no SSE): lens, DLA, attribution, activation, attn. `spawnEntropyCard` is the one exception (synchronous, derived from parent lens card).
- `frontend/app/projects/hooks/useSteeringHandlers.ts` — steering card creation: `steerComponents`, `rerunSteering`, `addStandaloneSteer`
- `frontend/app/projects/types.ts` — `AppState`, `AppAction`, `AnyCard` re-export, `HeatmapData`
- `frontend/app/projects/helpers.ts` — `serializeCard()`, `getCardPrompt()`, `autoArrangePos()`
- `frontend/app/schema.ts` — all Drizzle table definitions
- `frontend/app/actions.ts` — all server actions (`"use server"` file-level directive)
- `frontend/app/components/SandboxCanvas.tsx` — exports `AnyCard` union; `renderCard()` switch
- `frontend/app/lib/tiers.ts` — canonical GPU tier labels
- `frontend/app/lib/palette.ts` — `interpolateColor(palette, prob)` [0,1]; `interpolateColorDivergent` for signed DLA
- `frontend/app/lib/stream-sse.ts` — `readSSEStream()` / `parseSSE()` async generators for SSE consumption
- `frontend/app/lib/api-helpers.ts` — shared route utilities: `requireAuth()`, `fetchUpstream()`, `validateGpuTier()`, `resolveModelTier()`
- `frontend/app/share/[shareId]/` — `page.tsx` (server) + `ShareCanvas.tsx` (client, noop callbacks)
- `frontend/app/tutorial/` — `page.tsx` (server) + `TutorialClient.tsx` (orchestrator) + `TutorialDrawer.tsx` + `TutorialWelcomeModal.tsx` + `TutorialCompleteModal.tsx` + `steps.ts` (content + configs) + `data.json` (pre-computed results)

## API contracts

```
/api/job/spawn-{lens,attn,dla,attribution,activation-patch,steering} → POST → { jobId } or { status: "cached", data }
/api/job/{jobId}         → GET → { status: "running" | "done" | "error", data?, error? }
/api/job/{jobId}         → DELETE → { cancelled: true }
/api/models              → { id, display_name, description, requires_hf_token }[]
/api/validate-model      → { valid, gpu_tier, reason }
/api/tokenize            → { tokens: { text, special }[] }
/api/run-lens            → SSE → done: { x_labels, y_labels, heatmap_data, topk_tokens, topk_probs, kl_data, rank_data, entropy_data }
/api/run-dla             → { target_token, target_position, y_labels, x_labels, layer_dla, head_dla }
/api/run-attribution     → { target_token, target_token_idx, ..., top_k_components } — cached
/api/run-activation-patch → { total_diff, components[{layer, head, component_type, attribution_score, actual_effect}] } — ephemeral
/api/run-steering        → { steered_text, baseline_text, top_k_steered, top_k_baseline, logit_diff }
/api/run-attn            → SSE → done: { tokens, patterns[layer][head][q][k], n_layers, n_heads, truncated } — cached; truncates to 30 tokens
/api/generate-pairs      → { pairs: [{clean, corrupted}], n_requested }
```

All inference cache keys include `userId` as a scope prefix — caches are per-user.

See `.claude/rules/` for: frontend patterns, database/Drizzle, Modal infrastructure.
