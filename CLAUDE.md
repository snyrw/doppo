@AGENTS.md

This is a Next.js logit lens visualization/research tool that's intended to be used as a quick no-code alternative to writing out code in a notebook.

The stack is Next.js, Torch + TransformerLens 3.0, FastAPI, Modal, and Neon w/ BetterAuth (Neon Auth) + Drizzle.

There are several things in the works like reducing inference costs via Modal Volumes and GPU Snapshots, but the effect that these have on the final product is unknown. Better Neon integration and refactoring of the backend follows this as well.

---

## Backend architecture notes

### TransformerLens 3.0

TL 3.0 replaces `HookedTransformer` with `TransformerBridge`. Use `TransformerBridge.boot_transformers(hf_model_id)` — not `HookedTransformer.from_pretrained`. Short aliases (`"gpt2-small"`) are deprecated; use full HF IDs (`"openai-community/gpt2"`). Weight-processing kwargs (`fold_ln`, `center_unembed`, etc.) no longer exist.

TL 3.0 supports ~9,000 models out of the box, so any standard HF model can be loaded through the same `_TLBase` class — there is no need to special-case architectures.

**Multi-GPU is not supported.** `TransformerBridge` does not support `device_map="auto"`. Models that require multiple GPUs cannot be loaded. Models up to 70B fit on a single H200 and are supported; >70B is rejected at validation time.

### DLA / component attribution in TL3

**Attribution patching top-K workflow is intentional.** Neel Nanda's attribution patching post explicitly recommends "find the top N attribution patches, then check with actual activation patching" as the primary workflow. The full [layer × position] residual sweep is expensive and not the recommended default for this tool.

`hook_result` (per-head post-W_O output) does **not** exist in TL3. Compute it manually from `hook_z` and `W_O`:
```python
z = cache[f"blocks.{layer}.attn.hook_z"][0, pos, :, :].float()  # [n_heads, d_head]
head_results = torch.einsum("hd,hdm->hm", z, model.W_O[layer].float())  # [n_heads, d_model]
```
Use full string hook names — tuple shorthand (`cache["attn_out", layer]`) is gone: use `cache[f"blocks.{layer}.hook_attn_out"]`, `cache[f"blocks.{layer}.hook_mlp_out"]`, `cache[f"blocks.{layer}.hook_resid_post"]`.

`to_single_token()` is gone — use `model.to_tokens(token, prepend_bos=False)[0, 0]`.

`W_pos` and `W_E` do **not** exist on `TransformerBridge`. To get the combined embedding contribution (token + positional), use `cache["blocks.0.hook_in"][0, pos]` — this is the residual stream entering block 0, which equals `W_E[token] + W_pos[pos]` for absolute positional models and `W_E[token]` for RoPE models (Llama, Qwen, Gemma). `W_U` and `W_O` *do* work as direct attributes.

**Local venv is TL 2.18.0, not 3.0.** `TransformerBridge` only runs on Modal. Don't try to introspect it locally — `model_bridge` module won't import.

### Hook callbacks in `run_with_hooks`

`run_with_hooks` passes the hook object as a **keyword argument** named `hook`: `fn(value, hook=hook_obj)`. The second parameter MUST be named `hook` — any other name (`__h`, `*_`, etc.) causes `got an unexpected keyword argument 'hook'` at runtime. Correct pattern:
```python
def _fn(value, hook):   # 'hook' name is required
    ...
    return value
```

### Model loading (backend/main.py)

`FEATURED_MODELS` is editorial curation for the frontend — it is **not a gate** on what can run. Any valid HF model ID is accepted by `run-lens`. Featured entries have explicit `gpu_tier` values; custom models get their tier auto-detected.

**GPU tiers:**
- `tl_small` → L4 (< 4B params; 24 GB, $0.80/hr)
- `tl_medium` → L40S (4–10B params; 48 GB, $1.95/hr) — **not A10G**: L4 and A10G both have 24 GB, so the old small→medium attribution bump was a VRAM no-op; L40S doubles it
- `tl_large` → A100-80GB (10–25B params; 80 GB, $2.50/hr)
- `tl_xlarge` → H200 (25–70B params; 141 GB, $4.54/hr)

Attribution backward passes need ~2–3× model weights in working VRAM (autograd graph retains activations). This is why tier ceilings are conservative and `_bump_tier` must provide a genuine VRAM increase. 27B+ models are `tl_xlarge` because their attribution backward (~108–135 GB) was too close to H200's 141 GB limit when bumped from `tl_large`.

**B200 is not supported** — requires PyTorch 2.7+; current image pins `torch==2.6.0`.

**GPU tier detection** reads `num_parameters` from `config.json` first; falls back to `num_hidden_layers × hidden_size` as a proxy. Returns `None` (→ rejected) if the model is likely >70B. Conservative fallback when config is absent: `tl_large`. Tier labels are defined in `app/lib/tiers.ts` — import from there, do not redefine inline per component.

---

## Frontend architecture notes

### ConfigPane

The model selection UI has two mutually exclusive modes:
1. **Featured model cards** — 2-column grid, scrollable, populated from `/api/models`. Clicking a card deselects any custom input.
2. **Any HuggingFace model** — open text input. Typing anything deselects the featured grid. Requires explicit "Validate" step before "Run Lens" is enabled.

`/api/validate-model` returns `{valid, gpu_tier, reason}`. The `gpu_tier` is shown in the success label (`✓ Valid — A10G`). There is no PEFT-specific UI path.

### Sandbox card types

Four card types exist: `"logit-lens"` (`LensCardData`), `"dla"` (`DlaCardData`), `"attribution"` (`AttributionCardData`), `"activation"` (`ActivationCardData`). A fifth type, `"steering"` (`SteeringCardData`), holds DIM-vector steering results. `SteeringCardData` carries `nPairs` (defaults to 1 for old DB rows); always set it explicitly when constructing new cards. The full union is `AnyCard`, exported from `SandboxCanvas.tsx`. `SandboxCanvas` uses a `renderCard(card)` switch on `cardType`; `ShareCanvas` passes a noop `onVerifyTopK`. When restoring cards from the DB, discriminate on `cardType` and cast explicitly — don't rely on spreading `SerializedCard` directly into a typed card.

`AttributionCardData` uses `cleanPrompt` / `corruptedPrompt` instead of a single `prompt` field. Use the `getCardPrompt(card)` helper in `page.tsx` for generic prompt access across all card types.

Attribution payload (`/api/run-attribution` done event) includes both `target_token` (decoded string) and `target_token_idx` (vocab integer) — the activation patch endpoint requires the integer.

`SerializedCard.data` in `actions.ts` is `Record<string, unknown>` — never a concrete heatmap or DLA type — because the DB stores jsonb and doesn't care about shape. Cast through `unknown` when restoring typed card data from DB.

### Canvas interaction invariants

`useCanvasPan` fires on any left-click on the canvas viewport. The only thing preventing pan from triggering over a card is `e.stopPropagation()` on `onPointerDown`. Every interactive element inside a card (drag handle, buttons, toggles, clickable cells) **must** call `e.stopPropagation()` on `onPointerDown`, or the click will bubble to the viewport and start an unintended pan.

`renderCard()` in `SandboxCanvas` passes `sharedProps` without `key`; the `key={card.id}` prop must be placed directly on each JSX element — spreading `key` via a props object is a React error.

`overflow: auto` containers inside card components need an explicit `background: "var(--color-card)"` — without it some browsers render a white paint layer independent of the parent's background.

### API contract

`/api/models` → `{ id, display_name, description, requires_hf_token }[]`
`/api/validate-model` → `{ valid, gpu_tier, reason }`
`/api/run-lens` → `{ x_labels, y_labels, heatmap_data }`
`/api/run-dla` → `{ target_token, target_position, y_labels, x_labels, layer_dla, head_dla }`
`/api/run-attribution` → `{ target_token, target_token_idx, target_position, y_labels, x_labels, layer_attribution, head_attribution, top_k_components }` — cached in `attribution_cache` table + R2
`/api/run-activation-patch` → `{ total_diff, components[{layer, head, component_type, attribution_score, actual_effect}] }` — not cached (ephemeral)
`/api/run-steering` → `{ steered_text, baseline_text, top_k_steered, top_k_baseline, logit_diff }` — not cached; accepts optional `extraPairs: [{clean, corrupted}]` for CAA-style multi-pair averaging
`/api/generate-pairs` → `{ pairs: [{clean, corrupted}], n_requested }` — calls Claude Haiku to generate contrastive pairs; requires `ANTHROPIC_API_KEY` in `.env.local`

---

## Frontend file layout

- `app/page.tsx` — hero/landing page; **server component** — client interactivity (state, effects) must live in a child `"use client"` component
- `app/projects/page.tsx` — main canvas page; `useReducer` manages `{ lensCards, canvas }` state
- `app/schema.ts` — all Drizzle table definitions
- `app/actions.ts` — all server actions (`"use server"` file-level directive)
- `app/db.ts` — Drizzle client using `drizzle-orm/neon-http` (HTTP, not websocket)
- `app/lib/auth.ts` — BetterAuth server config (Google + GitHub + email/password)
- `app/lib/auth-client.ts` — exports `useSession`, `signIn`, `signOut`, `signUp`
- `app/lib/r2.ts` — Cloudflare R2 helpers: `putHeatmap(key, data)` / `getHeatmap(key)`
- `app/lib/palette.ts` — four heatmap palettes; `interpolateColor(palette, prob)` for unsigned [0,1] values; `interpolateColorDivergent(palette, value, absMax)` for signed DLA values (rdbu anchored at zero)
- `app/hooks/usePalette.ts` — reads `localStorage` + listens for `palettechange` custom events; returns current `PaletteName`
- `app/lib/tiers.ts` — shared `TIER_LABELS` constant for all four GPU tiers; import here, never redefine inline
- `app/components/` — `SandboxCanvas` (exports `AnyCard` union), `LensCard`, `DlaCard`, `AttributionCard`, `ActivationCard`, `SteeringCard`, `ConfigPane`, `DlaConfigPane`, `AttributionConfigPane`, `SteeringConfigPane`, `Navbar`, `AuthModal`, `ProjectSearch`, `HeroSpecimen`. `SteeringConfigPane` has a Quick (single pair) / Research (multi-pair with LLM generation) mode toggle.
- `app/hooks/` — `useCanvasPan`, `useCardDrag`, `usePalette`
- `app/share/[shareId]/` — `page.tsx` (server, fetches via `loadPublicProject`) + `ShareCanvas.tsx` (client, wraps `SandboxCanvas` with noop callbacks)

### Styling

**Hybrid approach:** CSS custom properties + utility classes in `globals.css` for static/themed styles; inline styles only for computed runtime values (card positions, probability-based cell colors). Tailwind utility classes are also present in some components (`page.tsx`, `AuthModal.tsx`).

**CSS custom property tokens** (defined in `globals.css`, toggled by `[data-theme="dark"]` on `<html>`):
- `--color-bg` / `--color-panel` / `--color-card` / `--color-card-border` / `--color-surface-border`
- `--color-text` / `--color-text-muted`
- `--color-accent` / `--color-accent-hover` / `--color-accent-fg` — warm neutral: `#3a3938` light, `#d4d2cb` dark (redesign moved away from the old evergreen `#3a6b55`; accent is now essentially the inverted text color)
- `--heatmap-rgb` — RGB channels of the text color (`28,28,28` light / `220,218,210` dark) for `rgba(var(--heatmap-rgb), ${prob})`. **Only valid for `warm-mono`** — for all other palettes use `interpolateColor(palette, prob)` from `app/lib/palette.ts`

**Heatmap palettes** — four options, cycled in `PALETTE_ORDER`: `warm-mono` (amber `rgba(175,118,32,alpha)`, the default), `rdbu` (ColorBrewer diverging blue→red), `viridis` (perceptually uniform, colorblind-safe), `inferno` (high contrast dark-to-bright). `PALETTE_META` has `label`, `description`, and `swatchCss` gradient strings for each. Palette is persisted to `localStorage` as `"heatmap-palette"` and broadcast via a `palettechange` custom event.

**Dark mode:** `data-theme="dark"` attribute on `<html>`, set by an inline `<script>` in `layout.tsx`'s `<head>` (reads `localStorage` + system preference). Toggled at runtime by `Navbar`. `<html>` carries `suppressHydrationWarning`. Do **not** use `@custom-variant dark` — it causes a silent Turbopack compile failure where old CSS is served with no error logged.

**CSS not updating?** Kill the dev server, `rm -rf .next/cache`, restart. Turbopack can silently serve stale compiled CSS when a directive causes a parse error.

Navbar is `50px` tall at `zIndex: 40`. `ConfigPane` uses `top: 57px` (navbar + 7px gap). `border-radius: 6px` is the standard for interactive controls; cards use `12px`.

### Auth patterns

Client-side session check: `const { data: session } = useSession()` from `lib/auth-client`.

Server-side (routes and server actions):
```ts
import { headers } from "next/headers";
import { auth } from "./lib/auth";
const session = await auth.api.getSession({ headers: await headers() });
if (!session?.user) throw new Error("Unauthorized");
```

`tl_small` models are accessible without auth; `tl_medium` / `tl_large` require a session. Always verify row ownership (`userId` match) before mutating DB rows.

### Heatmap caching

`/api/run-lens` checks the `heatmap_cache` table before forwarding to Modal. Cache key = SHA-256 of `modelName:prompt`. Hits are served from Cloudflare R2 via `getHeatmap(r2Key)`; misses call Modal, then write to R2 + insert a `heatmap_cache` row.

**DLA and attribution cache lookups use `eq(table.id, cacheKey)` only** — not a multi-field WHERE clause. The hash ID already incorporates all relevant fields (model, prompt, position, token, contrastive token). This avoids needing schema migrations when new cache dimensions are added.

### Steering / DIM vectors

`run_steering` in `main.py` computes a difference-in-means vector per component, accumulated across all pairs then averaged: `avg_v / (avg_v.norm() + 1e-8)`. Primary `clean_prompt`/`corrupted_prompt` always count as pair 1; `extra_pairs` are appended. Generate `cap - 1` extra pairs so total = cap (seed occupies slot 1).

**DIM extraction position for free-form pairs:** Use `cp_pos = clean_len - 1` and `rp_pos = corrupted_len - 1` independently — each sequence's own last token. Never use `min_len - 1` as a shared index; it pulls a mid-sequence position from the longer prompt instead of its pre-generation state. LLM-generated pairs routinely tokenize to different lengths even with semantically matched words.

**Tier pair caps for `/api/generate-pairs`:** tl_small=40, tl_medium=25, tl_large=15, tl_xlarge=10. These must stay in sync between `generate-pairs/route.ts` (`TIER_CAPS`) and `SteeringConfigPane.tsx` (`TIER_PAIR_CAPS`).

**Generation in `run_steering` uses temperature sampling + repetition penalty** — `temperature` (default 1.0) and `repetition_penalty` (default 1.3, HF-style: divide positive logits / multiply negative for already-generated tokens only) are fields on `SteeringRequest` and params on `run_steering`. The `_next_token` closure captures both; set `temperature <= 0` to get argmax. Both baseline and steered loops track a `*_generated` list and call `_next_token`.

**Three steering fetch paths in `page.tsx` must stay in sync** when the `/api/run-steering` payload changes: `handleSteerComponents` (from attribution/activation cards, uses hardcoded defaults), `handleRerunSteering` (alpha slider re-run), and `handleAddStandaloneSteer` (standalone config pane).

**`SerializedCard` in `actions.ts` is the DB serialization boundary** — new fields on `SteeringCardData` (or any card type) must also be added as optional to `SerializedCard`, or TypeScript errors surface at `updateProject` call sites rather than at the type definition. Add `?? default` in the DB restore block in `page.tsx` for backward compat with old rows.

### SSE streaming (`/api/run-lens`)

The route streams Server-Sent Events from Modal. Event shape: `data: { stage, data?, error? }`. `stage` is `"done"` (with `data`), `"error"` (with `error`), or a descriptive loading string. Client splits on `\n\n`, finds `data: ` lines, and JSON-parses each chunk.

### `useSearchParams` requires `<Suspense>`

Any client component using `useSearchParams` must be wrapped in `<Suspense>` — missing it causes a build-time error in App Router prerendered routes.

---

## Database / Drizzle notes

### Applying migrations

**`drizzle-kit migrate` and `drizzle-kit push` both hang in non-TTY environments** (Claude Code bash, CI) due to the `@neondatabase/serverless` websocket transport. Workaround — write a temporary `.mjs` script:

```js
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
await sql.query(`CREATE TABLE ...`);  // .query(string), NOT sql`` or sql()
```

`neon(url)` returns a tagged-template function — calling it as `sql("string")` throws; use `sql.query("string")` for programmatic use.

### `updatedAt` on UPDATE

`timestamp.defaultNow()` only fires on INSERT. Always set `updatedAt: new Date()` explicitly inside `.set()` when writing UPDATE queries.

---

## Projects feature

Projects persist canvas state and completed lens cards to the `project` table (`id, userId, name, cards jsonb, canvas jsonb, isPublic boolean, shareId text unique`). Each project is identified by `?id=<uuid>` in the URL.

- **New** — creates a project row with **empty cards** (`[]`); cards are only persisted via explicit `updateProject` calls, never implicitly on creation
- **Auto-save** — `updateProject(id, cards, canvas, name?)` fires on each `CARD_RESOLVED` SSE event; uses `projectIdRef` + `stateRef` (synced via `useEffect`) to avoid stale closures inside the async SSE callback
- **Rename** — inline editable name in the floating button row; shown only when a project is loaded; `handleRename` calls `updateProject` with the new name
- **Duplicate** — serializes only `status: "result"` cards (skips loading/error), saves as new row
- **Delete** — inline two-step confirmation in dropdown; deletes row, redirects to `/projects`
- **Search** — command palette (`ProjectSearch` component), triggered by Search button or Cmd+K; fetches all projects via `listProjects()` on open (selects full `cards` jsonb — can be heavy for many large projects), then filters client-side
- **Share** — `setProjectShare(projectId)` generates/returns a stable `shareId` UUID and sets `isPublic = true`; public read-only canvas at `/share/[shareId]` via `loadPublicProject(shareId)` (no auth). Share button copies `origin/share/<id>` to clipboard.
- **Export** — per-card PNG via `html-to-image`; see html-to-image note below.
- On mount, `?id=` is read via `useSearchParams` and restored via `loadProject` server action
- All project actions are auth-gated; buttons use `disabledStyle` / `enabledStyle` objects and `title` for tooltip
- Use `router.replace()` not `router.push()` for project navigation (avoids back-button clutter)

### html-to-image

Used for per-card PNG export. Two required workarounds:
1. **Blank image when element is `position: absolute` inside a CSS-transformed parent** — the card's `left`/`top` values push content outside the canvas. Fix: `toPng(el, { pixelRatio: 3, width: el.offsetWidth, height: el.offsetHeight, style: { position: "relative", left: "0", top: "0" } })`.
2. **SSR** — never import at module level; use `const { toPng } = await import("html-to-image")` inside the handler.

### Dropdown submenus

A dropdown with `overflow: hidden` clips `position: absolute` children even when correctly positioned. For fly-out submenus: set the dropdown to `overflow: visible` and add `borderRadius` to the first (`"6px 6px 0 0"`) and last (`"0 0 6px 6px"`) items instead.

---

## Modal / infrastructure notes

### Volumes

The volume uses `version=2` (`modal.Volume.from_name("model-weights-vol-v2", create_if_missing=True, version=2)`). v1 is the default and has a 500K inode hard limit; v2 removes it.

`modal volume ls` reports directory sizes as metadata bytes, not recursive content. To verify model weights exist: `modal volume ls model-weights-vol-v2 /hf_home/hub/models--<org>--<model>/blobs` — real safetensor shards will show GB-scale sizes there.

No explicit `volume.commit()` is needed: Modal runs background commits every few seconds and a final commit on container shutdown.

### GPU snapshots

GPU snapshots (`enable_memory_snapshot=True` + `experimental_options={"enable_gpu_snapshot": True}` + `@modal.enter(snap=True)`) do not survive `modal serve` hot-reloads — every file save restarts containers and resets snapshots. They are only meaningful after `modal deploy`.

### Timeouts

`_TL_LARGE_KWARGS` overrides `timeout=1200` for `TransformerLensLarge` and `TransformerLensXLarge`. Small/medium stay at 600. The split exists because 10–70B models can take 10–20 min to download to the volume on first cold start.