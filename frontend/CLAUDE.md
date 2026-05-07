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

---

## Frontend file layout

- `app/projects/page.tsx` — main canvas page; `useReducer` manages `{ lensCards, canvas }` state
- `app/schema.ts` — all Drizzle table definitions
- `app/actions.ts` — all server actions (`"use server"` file-level directive)
- `app/db.ts` — Drizzle client using `drizzle-orm/neon-http` (HTTP, not websocket)
- `app/lib/auth.ts` — BetterAuth server config (Google + GitHub + email/password)
- `app/lib/auth-client.ts` — exports `useSession`, `signIn`, `signOut`, `signUp`
- `app/lib/r2.ts` — Cloudflare R2 helpers: `putHeatmap(key, data)` / `getHeatmap(key)`
- `app/components/` — `SandboxCanvas`, `LensCard`, `ConfigPane`, `Navbar`, `AuthModal`, `ProjectSearch`
- `app/hooks/` — `useCanvasPan`, `useCardDrag`

### Styling

The entire codebase uses **inline styles** — no Tailwind classes, no CSS modules. Keep additions consistent.

Color tokens in use: `#2563eb` (primary blue), `#1d4ed8` (active/hover), `#93c5fd` (border/disabled), `#eff6ff` (hover bg), `#f8fafc` (page bg), `#dc2626` (destructive red). Border radius is consistently `6px`. Navbar is `50px` tall at `zIndex: 40`.

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

Projects persist canvas state and completed lens cards to the `project` table (`id, userId, name, cards jsonb, canvas jsonb`). Each project is identified by `?id=<uuid>` in the URL.

- **New** — creates a project row with **empty cards** (`[]`); cards are only persisted via explicit `updateProject` calls, never implicitly on creation
- **Auto-save** — `updateProject(id, cards, canvas, name?)` fires on each `CARD_RESOLVED` SSE event; uses `projectIdRef` + `stateRef` (synced via `useEffect`) to avoid stale closures inside the async SSE callback
- **Rename** — inline editable name in the floating button row; shown only when a project is loaded; `handleRename` calls `updateProject` with the new name
- **Duplicate** — serializes only `status: "result"` cards (skips loading/error), saves as new row
- **Delete** — inline two-step confirmation in dropdown; deletes row, redirects to `/projects`
- **Search** — command palette (`ProjectSearch` component), triggered by Search button or Cmd+K; fetches all projects via `listProjects()` on open (selects full `cards` jsonb — can be heavy for many large projects), then filters client-side
- On mount, `?id=` is read via `useSearchParams` and restored via `loadProject` server action
- All project actions are auth-gated; buttons use `disabledStyle` / `enabledStyle` objects and `title` for tooltip
- Use `router.replace()` not `router.push()` for project navigation (avoids back-button clutter)