# Contributing

## Prerequisites

- Node.js 20+
- Python 3.12+
- A [Modal](https://modal.com) account and the `modal` CLI (`pip install modal`)
- A [Neon](https://neon.tech) Postgres project
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket
- At least one OAuth app (Google or GitHub)

---

## Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
modal setup                     # opens browser to authenticate
```

To run in dev mode (hot-reload, temporary URL):
```bash
modal serve main.py
```

To deploy to production:
```bash
modal deploy main.py
```

Both commands print the endpoint URL you need for `NEXT_PUBLIC_API_URL` in the frontend.

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

Create a bucket and an API token with Object Read & Write permissions. R2 stores serialized heatmap blobs so repeated inference runs are served from cache instead of hitting Modal.

---

## Project structure

```
backend/
  main.py           All Modal endpoints (lens, DLA, attribution, activation patch)
  requirements.txt

frontend/
  app/
    api/            Next.js route handlers — thin proxies to Modal
    components/     Canvas, card types (LensCard, DlaCard, AttributionCard, ActivationCard), config panes
    hooks/          useCanvasPan, useCardDrag, usePalette
    lib/            auth.ts, auth-client.ts, db.ts, r2.ts, palette.ts, tiers.ts
    schema.ts       Drizzle table definitions
    actions.ts      Server actions ("use server")
    page.tsx        Landing page (server component)
    projects/       Canvas page with useReducer state
    share/[shareId] Read-only public canvas
  migrations/       SQL migration files
  .env.example      All required environment variables
```

---

## Making changes

**Adding a new analysis type** requires changes in both halves:
1. `backend/main.py` — new Modal function + endpoint
2. `frontend/app/api/` — new route handler proxying to Modal
3. `frontend/app/components/` — new card component + config pane
4. `frontend/app/projects/page.tsx` — wire into the canvas reducer and `renderCard` switch

**GPU tiers** are defined in `frontend/app/lib/tiers.ts`. Import `TIER_LABELS` from there — do not redefine inline.

**TransformerLens 3.0 notes** — see `frontend/CLAUDE.md` for API differences from TL 2.x (hook naming, `TransformerBridge`, removed helpers).

---

## Issues and PRs

Open an issue before starting significant work so we can discuss scope. PRs should include a description of what changed and why.
