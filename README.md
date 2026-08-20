<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/darklogo.png">
    <source media="(prefers-color-scheme: light)" srcset="frontend/public/lightlogo.png">
    <img src="frontend/public/lightlogo.png" alt="Doppo logo" width="72">
  </picture>
</p>

<h1 align="center">Doppo</h1>

<p align="center">
  <a href="https://doppo.tools"><img alt="Live at doppo.tools" src="https://img.shields.io/badge/live-doppo.tools-000000"></a>
  <a href="https://github.com/snyrw/doppo/actions/workflows/test.yml"><img alt="Tests" src="https://github.com/snyrw/doppo/actions/workflows/test.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/github/license/snyrw/doppo"></a>
</p>

A browser-based mechanistic interpretability tool aiming to bring easy and quick
access to some of the field's well-known techniques. Currently, we host the logit
lens, attention pattern analysis, direct logit attribution, patching, and difference-
in-means steering. These load in as "cards" in a sandbox that one can compare with
others.

Hosted at [doppo.tools](https://doppo.tools). Try [our demo](https://doppo.tools/tutorial) first without an account to see how the sandbox works. 

## Analysis types

- **Logit lens**: per-layer residual stream projections to vocabulary space
- **Attention patterns**: per-head attention weights at every layer and position, CircuitsVis-style
- **Direct logit attribution (DLA)**: per-layer and per-head contribution to a target token
- **Attribution patching**: a linear approximation of which components causally matter for a prediction
- **Activation patching**: the actual (non-approximated) effect of patching specific components
- **Activation steering**: difference-in-means vectors extracted from clean/corrupted prompt pairs, injected at inference time. Pairs can be generated automatically from a single example, and saved to your account for reuse across runs.

## Model support

Under the hood, we use [TransformerLens](https://github.com/TransformerLensOrg/TransformerLens)'s `TransformerBridge` to load in many different models from HuggingFace. This covers a very wide range of models, which TransformerLens themselves have verified [here](https://transformerlensorg.github.io/TransformerLens/generated/transformer_bridge_models.html). Doppo itself can do the following:
- Load in popular "featured" models (Llamas, Gemmas, Qwens, etc) from a set of around 20 or so via a model picker
- Load in custom models and LoRA adapters (merged onto base at runtime) directly from HuggingFace via a HF ID; these are ran through a verification process checking for config details and security

In theory, this should allow many of TransformerLens models to be usable on Doppo. However, due to our verification process and other issues that may arise, we cannot ensure that every single model you'll try to use with us will work.

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
**Auth:** BetterAuth with GitHub and email/password

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
| A GitHub OAuth app | Auth | Yes |

**Backend**

```bash
pip install -r backend/requirements.txt
modal setup
modal deploy -m backend.main      # run from the repo root, not from backend/
```

The deploy needs two Modal secrets to exist first (`backend-auth-secret` and
`huggingface-secret`). See [CONTRIBUTING.md](CONTRIBUTING.md) for the exact commands.
Set `NEXT_PUBLIC_API_URL` in the frontend to the URL the deploy prints. In production,
`modal deploy -m backend.main` runs automatically via GitHub Actions on push to `main`.

**Frontend**

```bash
cd frontend
cp .env.example .env.local
# fill in .env.local (the comments in that file explain each variable)
npm install
npm run dev            # http://localhost:3000
```

**Job sweeper (required):** point a cron at `/api/jobs/sweep` (GET or POST) every few minutes
with `Authorization: Bearer $CRON_SECRET`. It settles billing for jobs whose owner
stopped polling. Without it, abandoned `active_jobs` rows are never cleared and users
get stuck at the concurrent-job cap. `.github/workflows/sweep-jobs.yml` does this on a
5-minute schedule for the hosted deployment.

For full setup instructions including database migrations and OAuth app
configuration, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).