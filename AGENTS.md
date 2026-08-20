# doppo

No-code mechanistic interpretability for any HuggingFace model.
Stack: Next.js, FastAPI, TransformerLens 3.0+, Modal (serverless GPU), Neon + BetterAuth + Drizzle.

## Architecture

Frontend (Next.js) owns UI, auth, billing, and the Postgres DB (Neon/Drizzle). Backend (FastAPI on Modal) owns GPU inference. The two are bridged by a spawn+poll pattern (`POST /api/job/spawn-*` → `GET /api/job/{id}`, see API contracts below) because GPU jobs routinely outlive a single HTTP request.

New here? [CONTRIBUTING.md](CONTRIBUTING.md) covers environment setup — this file assumes a working dev environment and documents behavior, not setup.

## Before you write any code

This version of Next.js has breaking changes vs. training data — APIs, conventions, and file structure may differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing frontend code. Heed deprecation notices.

## Dev commands

```
cd frontend && npm run dev      # frontend: localhost:3000
cd frontend && npm test         # frontend unit tests (vitest, frontend/tests/)
modal deploy -m backend.main    # deploy backend (requires Modal credentials)
backend/venv/bin/python -m pytest backend/tests/test_utils.py backend/tests/test_api.py  # backend unit tests (same subset CI runs; test_validation.py needs `transformers`, not in the venv)
```

Full setup and the rest of the test suite: [CONTRIBUTING.md](CONTRIBUTING.md).

## Code style

No project-specific style guide. Frontend lints with stock `eslint-config-next` (`npm run lint`) — no Prettier config, no overridden rules. Backend has no linter or formatter configured; match surrounding code.

## Repository etiquette

Commit messages are lowercase, imperative, no trailing period (`fix issue with steering going below the viewport`); an optional `docs:`/`chore:`/`feat:` prefix shows up but isn't enforced or consistent — don't force one. No PR/issue template; [CONTRIBUTING.md](CONTRIBUTING.md) asks only that setup and tests are covered.

## Behavioral rules

- **Modal async in `api()`:** All route handlers in the `api()` FastAPI function are `async def`. Use `.aio()` variants for every Modal call: `.spawn.aio()`, `FunctionCall.from_id.aio()`, `.get.aio(timeout=0)`, `.cancel.aio()`. Sync versions cause `AsyncUsageWarning` and block the event loop.
- **Steering components are `[{ layer }]` only:** one method (Arditi-style DIM read at resid_pre, unnormalized, injected at the same hook at all positions) — no `method` field, no `injection_type`/`head`. Old DB rows still carry legacy camelCase fields; `spawn-steering/route.ts` strips them to the canonical shape before hashing/sending.
- **Backend deploys on push, not commit:** GitHub Actions only triggers on `git push` to `main`. Local commits to backend files are not deployed until pushed.
- **New card type checklist:** update `AnyCard` union in `SandboxCanvas.tsx`, add a case to `renderCard()`, add a branch to `serializeCard()` in `projects/helpers.ts`, add a `CardResolvedAction` variant in `projects/types.ts`, add optional fields to `SerializedCard` in `actions.ts`, add `?? default` in DB restore blocks in `projects/page.tsx` and `share/[shareId]/page.tsx`, add `tutorialMode?: boolean` prop + hide remove button (and any mutation-only controls) when true, add `explainSections?: InfoSection[]` if the new type should support the "?" explanation popup.
- **Steering payload changes:** the spawn-steering request body is built in one place — `spawnBody()` in `projects/hooks/useSteeringHandlers.ts`. New fields go there and in `spawn-steering/route.ts`'s `parse`/`upstreamBody`.
- **Drizzle migrations in bash:** `drizzle-kit migrate/push` hangs in non-TTY. Use a `.mjs` workaround — see "Database migrations" in [CONTRIBUTING.md](CONTRIBUTING.md); worked examples in `frontend/scripts/apply-000{4,5}.mjs`.
- **GPU tier labels and pair caps:** always import `TIER_LABELS` / `TIER_PAIR_CAPS` from `frontend/app/lib/tiers.ts`. Never redefine inline.
- **Auth gate:** All GPU inference requires authentication and credits — there is no anonymous inference tier. Credits billing is live. Always verify `userId` ownership before mutating DB rows. Exceptions: `/tutorial` and `/docs` are publicly accessible (tutorial serves pre-computed static data — no live GPU calls).
- **Card verification for big GPUs:** tiers in `GATED_TIERS` (`tl_large`/`tl_xlarge`/`tl_xxlarge`, in `lib/tiers.ts`) also require a verified payment method — `/api/credits/verify-card` runs a $0 Stripe setup-mode checkout.
- **Billing = GPU execution time only:** jobs are billed from the worker's execution-start heartbeat, not from spawn (queue/boot wait is unbilled). Settlement lives in `lib/jobs.ts` (`settleJob`, `billStoppedJob`). Jobs whose owner stopped polling are settled by `POST /api/jobs/sweep` (Bearer `CRON_SECRET`), pinged by the `sweep-jobs.yml` GitHub Actions schedule.
- **Stripe:** Hosted Stripe Checkout — gated only by `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Railway env vars (no publishable key; nothing client-side reads one). Webhook `https://doppo.tools/api/stripe/webhook` must be registered in the Stripe dashboard for `checkout.session.completed` and `checkout.session.async_payment_succeeded` (the `whsec_` secret comes from that registration). If either env var is missing in Railway, `api/credits/checkout/route.ts` returns 503 and the buy flow appears "off" with no visible error.
- **Tutorial (`/tutorial`):** Pre-computed, no-auth demo, not a step-gated walkthrough. All cards are built and shown at once. `TutorialClient.tsx` loads `data.json` on mount and calls `buildInitialCards()` (which calls `createCardFromData()` per entry) to build all 8 cards: IOI circuit on GPT-2 Small (steps "0"-"4") and three French/English DIM steering cards on Llama 3.1 (8B) Instruct (keys "5"/"5b"/"5c": same layer-16 residual DIM vector at alpha=+1, different generation prompts; only "5" stores `extraPairs`). A `TutorialWelcomeModal` shows on entry, reading its heading/paragraphs/links from `tutorial/content/welcome.md` (a `TutorialStep` identified by `id: welcome` rather than a `cardType`, found via `steps.find(s => s.id === "welcome")` in `TutorialClient.tsx`); there is no completion modal and no step gating or "+Add" menu. Step copy lives as markdown in `tutorial/content/step-1..6-*.md`, parsed by `load-steps.ts`; `tutorial/explain-content.ts`'s `explainSectionsFor`/`explainSectionsByCardType` turn that copy into the `InfoSection[]` shown by each card's "?" trigger. Full regen: `python scripts/generate_tutorial_data.py` (~5–10 min); circuit-only: `scripts/regen_tutorial_circuit.py`; steering-only: `scripts/regen_tutorial_steering.py` (regenerates pairs via Claude Haiku, needs `ANTHROPIC_API_KEY`; retries with a "continue" turn if Haiku undershoots the requested pair count). **DIM alpha for Llama 3.1 8B Instruct:** the DIM vector is unnormalized (raw mean difference), so alpha=1 is already "one full unit" per Arditi et al., not a small number. At alpha=1 the direction reliably lands on French across prompts (unlike Qwen2.5-7B-Instruct, tried earlier, which shifted away from English but landed inconsistently — Chinese/Vietnamese/Spanish depending on prompt and pair batch). Steering at this layer/alpha still perturbs factual content riding along with the language shift (e.g. invents a wrong death year and calls a novelist a manga author) even though the language target itself is hit reliably; behavior at other alpha values hasn't been tested for this model. **Scripts call Modal `api()` endpoints directly** (not Next.js routes): responses are snake_case; `SpawnAttributionRequest` and `SpawnActivationPatchRequest` use `prompt` for the clean prompt; `SpawnSteeringRequest` uses `clean_prompt`.

## Backend gotchas (`backend/` package)

File layout is discoverable by reading the code; these are the parts that aren't:

- `backend/config.py` — `FEATURED_MODELS` is editorial curation for the landing UI only, **not** a gate on which models are accepted.
- `backend/schemas.py` — `MAX_PROMPT_CHARS` / `MAX_EXTRA_PAIRS` are duplicated in `frontend/app/lib/api-helpers.ts`; keep both in sync. Workers additionally enforce a 48-token prompt limit not reflected in either constant.
- `backend/validation.py` — `_bump_tier` exists because attribution/activation-patch backward passes need ~2–3× the model's weights in VRAM.
- `backend/errors.py` — `UserFacingError` is the only exception type whose message is safe to relay to the client; everything else becomes a generic internal error so raw exception text never leaks.
- `backend/inference.py` — LoRA/DoRA adapters are merged onto the re-validated base at load time; don't assume a plain `from_pretrained` load.

**GPU tiers:**
- `tl_small` → L4 (< 4B params; 24 GB)
- `tl_medium` → L40S (4–10B; 48 GB)
- `tl_large` → A100-80GB (10–25B; 80 GB)
- `tl_xlarge` → H200 (25–69B; 141 GB)
- `tl_xxlarge` → B200 (70B–100B; 192 GB)

>100B and multi-GPU are rejected.

## TransformerLens 3.x — critical API differences

Modal image pins `transformer-lens==3.5.0` (3.5 bridges VLM text towers; 3.4 crashed on the Siglip vision path).

Use `TransformerBridge.boot_transformers(hf_model_id)` — not `HookedTransformer.from_pretrained`. Full HF IDs required (`"openai-community/gpt2"`, not `"gpt2-small"`). Weight-processing kwargs (`fold_ln`, `center_unembed`) are gone.

**TransformerLens is not installed locally** — `backend/venv` has only the dev deps (pytest/httpx/fastapi/pydantic/modal). `TransformerBridge` only runs on the Modal worker — never try to import `model_bridge` locally.

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

## Frontend gotchas

All frontend source lives under `frontend/app/`; file layout is discoverable by reading the code. These are the parts that aren't — single-source-of-truth locations and things that look duplicable but shouldn't be:

- `frontend/app/page.tsx` — the landing page's `<Deck>` (large/landscape) vs. `<LandingFlow>` (small/portrait: native scroll) switch is done purely by CSS media gates (`.deck-only`/`.flow-only` in `globals.css`, twin of `DECK_QUERY` in `deck-logic.ts`), not JS — keep both in sync, there's no single conditional to grep for.
- `frontend/app/projects/hooks/job-runner.ts` — `runJob()` is the one spawn+poll lifecycle (spawn → cached short-circuit → poll `/api/job/{id}` → resolve/error) used by every job-backed card. New job types call this, they don't reimplement it.
- `frontend/app/hooks/useModelSelection.ts` — the one model-selection state machine, shared by all five ConfigPanes. Same rule: extend it, don't fork it.
- `frontend/app/lib/loading-stage.ts` — the one place raw backend stage keys map to display text + timeline phase. Don't add a second mapping layer.
- `frontend/app/lib/spawn-route.ts` — `createSpawnHandler()` factory behind all six `/api/job/spawn-*` routes. Cache-key strings and `cachePayload` shapes are load-bearing — changing them orphans cache rows / breaks settlement.

## API contracts

```
/api/job/spawn-{lens,attn,dla,attribution,activation-patch,steering} → POST → { jobId } or { status: "cached", data }
/api/job/{jobId}         → GET → { status: "running" | "done" | "error", data?, error?, stage? … } (heartbeat stage fields consumed by lib/loading-stage.ts)
/api/job/{jobId}         → DELETE → { cancelled: true }
/api/models              → { id, display_name, description, requires_hf_token, gpu_tier }[]
/api/validate-model      → 200 { valid, gpu_tier, reason, revision, adapter? } on success; 400 { detail } on invalid
/api/tokenize            → { tokens: { text, special }[] }
/api/generate-pairs      → { pairs: [{clean, corrupted}], n_requested }
/api/jobs/sweep          → POST (Bearer CRON_SECRET) → settles abandoned jobs
/api/credits/{balance,checkout,portal,verify-card}, /api/stripe/webhook → credits + Stripe
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
