# LogitLensViz

A browser-based mechanistic interpretability tool — run logit lens, direct logit attribution (DLA), attribution patching, and activation patching on any HuggingFace model without writing code.

## What it does

You pick a model, enter a prompt, and get interactive visualizations of how information flows through the model's layers and attention heads. All compute runs on RunPod serverless GPUs; results are cached in Cloudflare R2 so repeated runs are instant.

**Available analysis types:**
- **Logit lens** — per-layer residual stream projections to vocabulary space
- **Direct logit attribution (DLA)** — per-layer and per-head contribution to a target token
- **Attribution patching** — identify which components causally matter for a prediction
- **Activation patching** — measure the actual effect of patching specific components

**Model support:** ~9,000+ HuggingFace models via TransformerLens 3.0. GPU tier is auto-detected from parameter count.

## Architecture

```
frontend/           Next.js 16 app (Vercel)
  app/api/          Thin proxy routes → RunPod endpoints
  app/components/   Canvas, card types, config panes
  app/lib/          Auth, DB, R2, palette helpers

backend/worker/     RunPod serverless Python worker
  handler.py        Entry point — INFERENCE_ENDPOINTS dispatch dict
  inference.py      Per-endpoint inference logic
  model_cache.py    In-process model cache
```

**Data layer:** Neon Postgres (projects, cache metadata) + Cloudflare R2 (heatmap blobs)
**Auth:** BetterAuth with Google and GitHub OAuth

## Self-hosting prerequisites

| Service | Purpose | Free tier |
|---|---|---|
| [RunPod](https://runpod.io) | GPU inference | Pay-per-use |
| [Neon](https://neon.tech) | Postgres | Yes |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Heatmap cache | Yes (10 GB) |
| [Vercel](https://vercel.com) | Frontend hosting | Yes |
| Google or GitHub OAuth app | Auth | Yes |

## Quickstart

**Backend**

The RunPod worker is deployed via GitHub Actions CI/CD on push to `main`. Set `RUNPOD_ENDPOINT_SMALL`, `RUNPOD_ENDPOINT_MEDIUM`, `RUNPOD_ENDPOINT_LARGE`, and `RUNPOD_ENDPOINT_XLARGE` env vars in Vercel to point at your RunPod endpoint IDs.

**Frontend**

```bash
cp .env.example .env.local
# fill in .env.local — see comments in that file
npm install
npm run dev            # http://localhost:3000
```

For full setup instructions including database migrations and OAuth app configuration, see [CONTRIBUTING.md](CONTRIBUTING.md).

## GPU tiers

| Tier | GPU | Model size |
|---|---|---|
| `tl_small` | L4 | < 4B params |
| `tl_medium` | L40S | 4–10B params |
| `tl_large` | A100-80GB | 10–25B params |
| `tl_xlarge` | H200 | 25–70B params |

Models above 70B are not supported. Multi-GPU is not supported.

## License

MIT — see [LICENSE](LICENSE).
