# Contributing

## Prerequisites

- Node.js 20+
- Python 3.12+
- A [Modal](https://modal.com) account and the `modal` CLI (`pip install modal`)
- A [Neon](https://neon.tech) Postgres project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket
- At least one OAuth app (Google or GitHub)

Optional, only needed for specific features:
- [Stripe](https://stripe.com) secret key + webhook secret — credits billing (without these, the buy-credits flow is disabled)
- [Resend](https://resend.com) API key — transactional email (password reset, etc.)
- [Anthropic API key](https://console.anthropic.com) — LLM-assisted steering pair generation

---

## Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
modal setup                     # opens browser to authenticate
cd ..                           # -m backend.main needs to run from the repo root
```

To run in dev mode (hot-reload, temporary URL):
```bash
modal serve -m backend.main
```

To deploy to production:
```bash
modal deploy -m backend.main
```

Both commands print the endpoint URL you need for `NEXT_PUBLIC_API_URL` in the frontend.
In production this deploy runs automatically via GitHub Actions on push to `main`
(only when files under `backend/` change).

**HuggingFace secret (for gated models):** If you want to run gated models (Llama, Gemma, etc.) create a Modal secret named `huggingface-secret` with key `HF_TOKEN`:
```bash
modal secret create huggingface-secret HF_TOKEN=hf_yourtoken
```

---

## Frontend setup

```bash
cd frontend
cp .env.example .env.local
```

Fill in every variable in `.env.local` — the comments in that file explain each one. Then:

```bash
npm install
npm run dev     # http://localhost:3000
```

### Database migrations

`drizzle-kit migrate` and `drizzle-kit push` hang in non-TTY environments because of the Neon websocket transport. Apply migrations by writing a temporary `.mjs` script instead:

```js
// run-migration.mjs
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
await sql.query(`
  -- your SQL here
`);
console.log("done");
```

```bash
node run-migration.mjs
```

Existing migration SQL lives in `frontend/migrations/`.

### OAuth setup

**Google:** Go to [Google Cloud Console](https://console.developers.google.com) → Credentials → Create OAuth 2.0 Client ID. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI for local dev.

**GitHub:** Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New. Set callback URL to `http://localhost:3000/api/auth/callback/github` for local dev.

### Cloudflare R2

Create a bucket and an API token with Object Read & Write permissions. R2 stores serialized inference results, scoped per user, so repeated runs are served from cache instead of hitting Modal.

---

## Project structure

```
backend/
  main.py           GPU-tier Modal classes, _TIER_TO_CLS routing, FastAPI app factory
  inference.py      Inference generators shared across analysis types + _result wrappers
  config.py         Modal app/image/secrets, featured model list, per-tier kwargs
  schemas.py        Pydantic request models
  validation.py     HF repo validation, GPU tier detection
  auth.py           Shared bearer-secret guard
  routes/           jobs.py (spawn/poll/cancel), utils.py (models/tokenize/validate)
  requirements.txt

frontend/
  app/
    api/            Next.js route handlers — thin proxies to Modal
    components/     Canvas, card types (LensCard, DlaCard, AttributionCard,
                     ActivationCard, SteeringCard, AttentionCard), config panes
    hooks/          useCanvasPan, useCardDrag, usePalette
    lib/            auth.ts, auth-client.ts, db.ts, r2.ts, palette.ts, tiers.ts,
                     spawn-route.ts (createSpawnHandler factory)
    schema.ts       Drizzle table definitions
    actions.ts      Server actions ("use server")
    page.tsx        Landing page (server component)
    projects/       Canvas page with useReducer state; hooks/job-runner.ts (runJob)
    tutorial/       No-auth guided walkthrough with pre-computed data
    docs/           Reference documentation pages
    share/[shareId] Read-only public canvas
  migrations/       SQL migration files
  .env.example      All required environment variables
```

---

## Making changes

**Adding a new analysis type** requires changes across the spawn+poll job lifecycle:
1. `backend/inference.py` — new inference generator + `_result` wrapper on `_TLBase`
2. `backend/routes/jobs.py` — new `POST /api/job/spawn-*` endpoint
3. `frontend/app/lib/spawn-route.ts` — new spawn route via the `createSpawnHandler()` factory (don't hand-roll a route)
4. `frontend/app/projects/hooks/job-runner.ts` — `runJob()` already handles spawn → poll → resolve; wire the new job type's config in
5. `frontend/app/components/` — new card component + config pane
6. `frontend/app/components/SandboxCanvas.tsx` — add to the `AnyCard` union and `renderCard()` switch
7. `frontend/app/projects/helpers.ts` — add a branch to `serializeCard()`
8. `frontend/app/projects/types.ts` and `app/actions.ts` — add a `CardResolvedAction` variant and `SerializedCard` fields

See the "New card type checklist" in the root `CLAUDE.md` and `.claude/rules/frontend.md` for the full list, including DB restore call sites and tutorial-mode handling.

**GPU tiers** are defined in `frontend/app/lib/tiers.ts`. Import `TIER_LABELS` / `TIER_PAIR_CAPS` from there — do not redefine inline.

**TransformerLens 3.5 notes** — see the root [CLAUDE.md](CLAUDE.md) for API differences from TL 2.x (hook naming, `TransformerBridge`, removed helpers).

---

## Issues and PRs

Open an issue before starting significant work so we can discuss scope. PRs should include a description of what changed and why.
