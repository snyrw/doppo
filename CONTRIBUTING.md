# Contributing

Contributions on Doppo are currently welcome! If you're curious about adding/fixing/removing/doing anything, follow the instructions below to get started.

## Prerequisites

- Node.js 20+
- Python 3.12+ (CI runs 3.13)
- A [Modal](https://modal.com) account and the `modal` CLI (`pip install modal`)
- A [Neon](https://neon.tech) Postgres project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket
- A GitHub OAuth app (the only social provider; email/password also works)

Optional, only needed for specific features:
- [Stripe](https://stripe.com) secret key + webhook secret for usage billing. Without these, the buy-usage flow returns 503 and the purchase UI appears inert.
- [Resend](https://resend.com) API key for transactional email (verification, password reset, email change). Without it, links print to the console in dev.
- [Anthropic API key](https://console.anthropic.com) for LLM-assisted steering pair generation.
- [Sentry](https://sentry.io) DSN for error monitoring. Leave blank to disable.

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

### Modal secrets

The backend references two Modal secrets by name at import time, so **both must exist in your Modal workspace before `modal deploy` will succeed**, even if you never touch a gated model.

```bash
# Shared bearer secret gating every backend route. Must match BACKEND_API_SECRET
# in the frontend's .env.local, or all inference calls fail with 401.
modal secret create backend-auth-secret BACKEND_API_SECRET=$(openssl rand -base64 32)

# HuggingFace token. Required for gated models (Llama, Gemma, etc.); the secret
# still has to exist for other models, so create it either way.
modal secret create huggingface-secret HF_TOKEN=hf_yourtoken
```

If `BACKEND_API_SECRET` is missing on the worker, the backend fails closed and every route returns 503.

---

## Frontend setup

```bash
cd frontend
cp .env.example .env.local
```

Fill in every variable in `.env.local`. The comments in that file explain each one. Then:

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

**GitHub** is the only configured social provider. Go to [GitHub Developer Settings](https://github.com/settings/developers) → OAuth Apps → New. Set callback URL to `http://localhost:3000/api/auth/callback/github` for local dev, then put the client ID and secret in `.env.local`.

Email/password sign-in works without any OAuth app. In development, verification and reset links print to the console instead of being emailed.

### Cloudflare R2

Create a bucket and an API token with Object Read & Write permissions. R2 stores serialized inference results, scoped per user, so repeated runs are served from cache instead of hitting Modal.

---

## Running tests

Both suites run on every pull request via `.github/workflows/test.yml`, and the backend suite also gates the Modal deploy. Run them locally before opening a PR.

```bash
# Frontend (vitest, frontend/tests/)
cd frontend && npm test
cd frontend && npm run lint

# Backend (pytest, backend/tests/)
pip install -r backend/requirements-dev.txt
pytest backend/tests/
```

Run pytest from the repo root so the `backend` package resolves. The suite is CPU-only and needs no GPU or Modal credentials: TransformerLens is never imported locally, since it only runs on the Modal worker.

`backend/tests/test_integration.py` is the exception. It is a real GPU smoke test invoked as `modal run backend/tests/test_integration.py`, requires Modal credentials, and in CI runs only on push to `main`.

---

## Project structure

```
backend/
  main.py           GPU-tier Modal classes, _TIER_TO_CLS routing, FastAPI app factory
  inference.py      Inference generators shared across analysis types + _result wrappers
  config.py         Modal app/image/secrets, featured model list, per-tier kwargs
  schemas.py        Pydantic request models
  validation.py     HF repo validation, GPU tier detection, revision pinning
  errors.py         UserFacingError (worker messages safe to relay verbatim)
  auth.py           Shared bearer-secret guard
  routes/           jobs.py (spawn/poll/cancel), utils.py (models/tokenize/validate)
  tests/            pytest suite
  requirements.txt      Runtime deps (a single line: modal)
  requirements-dev.txt  Test deps (pytest, httpx, fastapi, pydantic, modal, transformers)

frontend/
  app/
    api/            Next.js route handlers (thin proxies to Modal)
    components/     Canvas, card types (LensCard, DlaCard, AttributionCard,
                     ActivationCard, SteeringCard, AttentionCard), config panes
    hooks/          useCanvasPan, useCardDrag, usePalette, useModelSelection,
                     useTokenPreview
    lib/            auth.ts, auth-client.ts, db.ts, r2.ts, palette.ts, tiers.ts,
                     spawn-route.ts (createSpawnHandler factory), jobs.ts
                     (settlement), credits.ts + rates.ts (billing),
                     steering-presets.ts (saved pair sets)
    schema.ts       Drizzle table definitions
    actions.ts      Server actions ("use server")
    page.tsx        Landing page (server component)
    projects/       Canvas page with useReducer state; hooks/job-runner.ts (runJob)
    tutorial/       No-auth guided walkthrough with pre-computed data
    docs/           Reference documentation pages
    share/[shareId] Read-only public canvas
  migrations/       SQL migration files
  tests/            vitest suite
  .env.example      All required environment variables
```

---

## Issues and PRs


