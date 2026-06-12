@AGENTS.md

Logit lens visualization tool — no-code mechanistic interpretability for any HuggingFace model.
Stack: Next.js, FastAPI, TransformerLens 3.0, Modal (serverless GPU), Neon + BetterAuth + Drizzle.

## Dev commands

```
cd frontend && npm run dev      # frontend: localhost:3000
modal deploy -m backend.main    # deploy backend (requires Modal credentials)
```

## Behavioral rules

- **Modal async in `api()`:** All route handlers in the `api()` FastAPI function are `async def`. Use `.aio()` variants for every Modal call: `.spawn.aio()`, `FunctionCall.from_id.aio()`, `.get.aio(timeout=0)`, `.cancel.aio()`. Sync versions cause `AsyncUsageWarning` and block the event loop.
- **`injection_type` vs `injectionType`:** Frontend `SteeringComponent` uses camelCase `injectionType`; the backend Pydantic model expects snake_case `injection_type`. `spawn-steering/route.ts` maps this before sending. Any new steering-related endpoint must do the same.
- **Backend deploys on push, not commit:** GitHub Actions only triggers on `git push` to `main`. Local commits to backend files are not deployed until pushed.
- **New card type checklist:** update `AnyCard` union in `SandboxCanvas.tsx`, add a case to `renderCard()`, add a branch to `serializeCard()` in `projects/helpers.ts`, add a `CardResolvedAction` variant in `projects/types.ts`, add optional fields to `SerializedCard` in `actions.ts`, add `?? default` in DB restore blocks in `projects/page.tsx` and `share/[shareId]/page.tsx`, add `tutorialMode?: boolean` prop + hide remove button (and any mutation-only controls) when true — see Tutorial mode section in `.claude/rules/frontend.md`.
- **Steering payload changes:** the spawn-steering request body is built in one place — `spawnBody()` in `projects/hooks/useSteeringHandlers.ts`. New fields go there and in `spawn-steering/route.ts`'s `parse`/`upstreamBody`.
- **Drizzle migrations in bash:** `drizzle-kit migrate/push` hangs in non-TTY. Use `.mjs` workaround — see `.claude/rules/database.md`.
- **GPU tier labels and pair caps:** always import `TIER_LABELS` / `TIER_PAIR_CAPS` from `frontend/app/lib/tiers.ts`. Never redefine inline.
- **Auth gate:** All GPU inference requires authentication and credits — there is no anonymous inference tier. Credits billing is live. Always verify `userId` ownership before mutating DB rows. Exception: `/tutorial` is publicly accessible but serves pre-computed static data — no live GPU calls.
- **Stripe:** Hosted Stripe Checkout — gated only by `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Railway env vars (no publishable key; nothing client-side reads one). Webhook `https://doppo.tools/api/stripe/webhook` must be registered in the Stripe dashboard for `checkout.session.completed` and `checkout.session.async_payment_succeeded` (the `whsec_` secret comes from that registration). If either env var is missing in Railway, `api/credits/checkout/route.ts` returns 503 and the buy flow appears "off" with no visible error.
- **Tutorial (`/tutorial`):** Pre-computed, no-auth walkthrough — IOI circuit on GPT-2 Small (steps 1–5) and Romance-language DIM steering on Qwen2.5-1.5B-Instruct (steps 6A and 6B). Steps 6A/6B are separate tutorial steps (indices 5 and 6 in `TutorialClient`); data.json stores them under keys `"5"` (layer 14 → Portuguese) and `"5b"` (layer 16 → Spanish). `createCardFromData(6)` maps to key `"5b"`. Full regen: `python scripts/generate_tutorial_data.py` (~5–10 min). Steering-only regen: `python scripts/regen_tutorial_steering.py` (reuses stored `extraPairs` from key `"5"` to skip the Claude Haiku API call). **DIM alpha for Qwen2.5-1.5B-Instruct:** α=−3 is far too weak (produces English); effective range is α≈−20. The DIM direction from English/French pairs captures Romance language broadly — not specifically French. **Script calls Modal `api()` endpoints directly** (not Next.js routes): responses are snake_case; `SpawnAttributionRequest` and `SpawnActivationPatchRequest` use `prompt` for the clean prompt; `SpawnSteeringRequest` uses `clean_prompt`.

## Backend (backend/ package)

- `backend/main.py` — five Modal GPU-tier classes (`TransformerLensSmall` … `TransformerLensXXLarge`), `_TIER_TO_CLS` routing table, `_bump_tier()`, and the FastAPI `api()` app factory
- `backend/inference.py` — `_TLBase` class: shared inference generators for all analysis types (`run_logit_lens`, `run_dla`, `run_attribution`, `run_activation_patch`, `run_steering`, `run_attn`) plus `_result` wrapper methods (`run_logit_lens_result`, etc.) — non-generator wrappers that call the generator via `.local()` and return only the final `done` data dict; used by the spawn+poll system
- `backend/config.py` — Modal app/image/secrets, `FEATURED_MODELS` (editorial curation for the UI only; not a gate on accepted models), per-tier Modal kwargs
- `backend/schemas.py` — Pydantic request models (`MAX_PROMPT_CHARS`, `MAX_EXTRA_PAIRS` live here; frontend mirrors them in `lib/api-helpers.ts`)
- `backend/validation.py` — `validate_hf_repo`, `_detect_gpu_tier()` param-count-to-tier mapping; `_bump_tier` used for attribution/activation-patch backward passes (need ~2–3× model weights in VRAM)
- `backend/routes/jobs.py` — spawn+poll endpoints: `POST /api/job/spawn-{lens,attn,dla,attribution,activation-patch,steering}`, `GET /api/job/{job_id}` (poll), `DELETE /api/job/{job_id}` (cancel); `backend/routes/utils.py` — `/api/models`, `/api/tokenize`, `/api/validate-model`
- `backend/auth.py` — shared bearer-secret guard; every route requires `BACKEND_API_SECRET`
- `activeJobs` DB table tracks in-flight jobs for billing (elapsed time) and cache writes on completion
- Deployed via `modal deploy -m backend.main`; GitHub Actions CI/CD on push to `main`
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
- `frontend/app/projects/hooks/job-runner.ts` — `runJob()`: the single spawn+poll lifecycle (spawn fetch → cached short-circuit → poll `/api/job/{id}` → resolve/error) used by every job-backed card
- `frontend/app/projects/hooks/useJobHandlers.ts` — card creation via `runJob`: lens, DLA, attribution, activation, attn. `spawnEntropyCard` is the one exception (synchronous, derived from parent lens card).
- `frontend/app/projects/hooks/useSteeringHandlers.ts` — steering card creation: `steerComponents`, `rerunSteering`, `addStandaloneSteer`; request body built once in `spawnBody()`
- `frontend/app/projects/types.ts` — `AppState`, `AppAction`, `AnyCard` re-export, `HeatmapData`
- `frontend/app/projects/helpers.ts` — `serializeCard()`, `getCardPrompt()`, `autoArrangePos()`
- `frontend/app/schema.ts` — all Drizzle table definitions
- `frontend/app/actions.ts` — all server actions (`"use server"` file-level directive)
- `frontend/app/components/SandboxCanvas.tsx` — exports `AnyCard` union; `renderCard()` switch
- `frontend/app/lib/tiers.ts` — canonical GPU tier labels (`TIER_LABELS`) and steering pair caps (`TIER_PAIR_CAPS`)
- `frontend/app/lib/palette.ts` — `interpolateColor(palette, prob)` [0,1]; `interpolateColorDivergent` for signed DLA
- `frontend/app/lib/api-helpers.ts` — shared route utilities: `requireAuth()`, `validateGpuTier()`, `resolveModelTier()`, `backendHeaders()`
- `frontend/app/lib/spawn-route.ts` — `createSpawnHandler()` factory behind all six `/api/job/spawn-*` routes (validate → auth → tier → cache check → job cap → balance → spawn → insert `activeJobs`); each route file is just a config object. Cache-key strings and `cachePayload` shapes are load-bearing — changing them orphans cache rows / breaks settlement.
- `frontend/app/hooks/useModelSelection.ts` + `frontend/app/components/ModelPicker.tsx` — shared model-selection state machine and UI used by all five ConfigPanes
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
/api/generate-pairs      → { pairs: [{clean, corrupted}], n_requested }
```

Job `data` payloads by type (returned from `GET /api/job/{jobId}` on done, or inline on cache hit):

```
lens             → { x_labels, y_labels, heatmap_data, topk_tokens, topk_probs, kl_data, rank_data, entropy_data }
dla              → { target_token, target_position, y_labels, x_labels, layer_dla, head_dla }
attribution      → { target_token, target_token_idx, ..., top_k_components }
activation-patch → { total_diff, components[{layer, head, component_type, attribution_score, actual_effect}] }
steering         → { steered_text, baseline_text, top_k_steered, top_k_baseline, logit_diff } — cached only when temperature <= 0
attn             → { tokens, patterns[layer][head][q][k], n_layers, n_heads, truncated } — truncates to 30 tokens
```

All inference cache keys include `userId` as a scope prefix — caches are per-user.

See `.claude/rules/` for: frontend patterns, database/Drizzle, Modal infrastructure.
