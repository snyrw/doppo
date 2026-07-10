# Doppo

A browser-based mechanistic interpretability tool — run logit lens, attention pattern
inspection, direct logit attribution (DLA), attribution patching, activation patching,
and difference-in-means activation steering on any HuggingFace model without writing
code.

Hosted at [doppo.tools](https://doppo.tools). Try it without an account via the
[interactive tutorial](https://doppo.tools/tutorial), which walks through an IOI
circuit on GPT-2 Small and DIM steering on Qwen2.5-1.5B-Instruct using pre-computed
results. Reference docs for each analysis type are at
[doppo.tools/docs](https://doppo.tools/docs).

## Analysis types

- **Logit lens** — per-layer residual stream projections to vocabulary space
- **Attention patterns** — per-head attention weights at every layer and position
- **Direct logit attribution (DLA)** — per-layer and per-head contribution to a target token
- **Attribution patching** — a linear approximation of which components causally matter for a prediction
- **Activation patching** — the actual (non-approximated) effect of patching specific components
- **Activation steering** — difference-in-means (DIM) vectors extracted from clean/corrupted prompt pairs, injected at inference time; pairs can be generated automatically from a single example

## Model support

Any model [TransformerLens 3.5](https://github.com/TransformerLensOrg/TransformerLens)
can load via `TransformerBridge` — around 9,000+ HuggingFace repos. GPU tier is
auto-detected from parameter count. Gated models (Llama, Gemma, etc.) work with an
HF token. LoRA and DoRA adapters are supported — they're merged into the base model
at load time. Models above 100B params or requiring multiple GPUs are rejected.

## How it works

```
frontend/           Next.js 16 app (Railway)
  app/api/           Thin proxy routes → Modal backend
  app/components/    Canvas, card types, config panes
  app/projects/       Sandbox canvas (main product surface)
  app/tutorial/        No-auth guided walkthrough with pre-computed data
  app/share/[shareId]/ Read-only public canvas view
  app/lib/            Auth, DB, R2, palette, tier helpers

backend/            FastAPI app on Modal, GPU inference
  main.py             GPU-tier Modal classes + FastAPI app factory
  inference.py         Inference generators shared across analysis types
  routes/               Spawn/poll/cancel job endpoints, model/tokenize utilities
  config.py             Modal app/image/secrets, featured model list
```

Inference jobs are asynchronous: the frontend spawns a job on Modal, then polls for
completion. Results are cached per-user in Cloudflare R2, so re-running an identical
prompt/model/config is instant.

**Data layer:** Neon Postgres (projects, cache metadata) + Cloudflare R2 (result blobs)
**Auth:** BetterAuth with Google, GitHub, and email/password

## GPU tiers

| Tier | GPU | Model size |
|---|---|---|
| `tl_small` | L4 | < 4B params |
| `tl_medium` | L40S | 4–10B params |
| `tl_large` | A100-80GB | 10–25B params |
| `tl_xlarge` | H200 | 25–69B params |
| `tl_xxlarge` | B200 | 69–100B params |

Models above 100B params or requiring multiple GPUs are not supported.

## Accounts and billing

GPU inference requires an account and credits, billed by GPU execution time (queueing
and container boot are free). The tutorial requires no account and makes no live GPU
calls. Credits are purchased via Stripe.

## Sharing

Any project can be published to a stable, read-only public URL at `/share/[shareId]`.

## Self-hosting

| Service | Purpose | Free tier |
|---|---|---|
| [Modal](https://modal.com) | GPU inference | Pay-per-use |
| [Neon](https://neon.tech) | Postgres | Yes |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Result cache | Yes (10 GB) |
| A Next.js host (e.g. [Railway](https://railway.app)) | Frontend hosting | Varies |
| Google or GitHub OAuth app | Auth | Yes |

**Backend**

```bash
cd backend
pip install -r requirements.txt
modal setup
modal deploy -m backend.main
```

Set `NEXT_PUBLIC_API_URL` in the frontend to the URL this prints. In production,
`modal deploy -m backend.main` runs automatically via GitHub Actions on push to `main`.

**Frontend**

```bash
cd frontend
cp .env.example .env.local
# fill in .env.local — see comments in that file
npm install
npm run dev            # http://localhost:3000
```

For full setup instructions including database migrations and OAuth app
configuration, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).