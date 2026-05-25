# Modal → RunPod Serverless Migration Design

**Date:** 2026-05-24  
**Branch:** runpod-migration  
**Status:** Design approved, pending implementation

---

## Motivation

Modal Starter tier: $30/month free compute, hard $100/month cap before shutdown. Next tier (Team) costs $250/month for $100 of included compute — a punishing step function for a solo project. RunPod Serverless charges per-second with no tier step function.

---

## Architecture Overview

```
Browser
  │  SSE (unchanged)
  ▼
Next.js API routes
  ├── lightweight (resolveModelTier, tokenize, models, generate-pairs)
  │     → FastAPI service on Railway
  └── GPU inference → RunPod REST API (polling loop, proxied as SSE to browser)
                           │
          ┌────────────────┼─────────────────┐
     tl-small          tl-medium         tl-large    tl-xlarge
       (L4)             (L40S)          (A100-80GB)   (H200+vol)
          └──────── all run same Docker image ────────┘
                    handler dispatches by "endpoint" key
```

The browser-facing SSE contract is **unchanged**. `{stage, data?, error?}` event shape is preserved. Polling happens internally in Next.js, invisible to the browser.

---

## Section 1: File Structure

```
backend/
  worker/
    handler.py          # RunPod entrypoint — handler(job) dispatch
    inference.py        # _TLBase logic, ported (no Modal imports)
    model_cache.py      # in-process singleton cache (warm worker reuse)
    requirements.txt    # torch==2.6.0, transformer-lens>=3.0, einops==0.8.1, runpod
  Dockerfile            # single image, all four tiers
  Dockerfile.api        # lightweight image for Railway FastAPI service
  main.py               # kept during transition; deleted after cutover
```

Frontend changes are confined to:
- `app/lib/api-helpers.ts` — `fetchUpstream` replacement, `resolveEndpointUrl`, `bumpTier`
- `app/api/run-*/route.ts` — call site updates (6 routes)
- `.env.local` — new RunPod env vars

---

## Section 2: RunPod Worker / Handler Design

### handler.py

```python
import runpod
from inference import TLInference
from model_cache import get_or_load_model

ENDPOINT_DISPATCH = {
    "run_lens":              TLInference.run_lens,
    "run_dla":               TLInference.run_dla,
    "run_attribution":       TLInference.run_attribution,
    "run_activation_patch":  TLInference.run_activation_patch,
    "run_steering":          TLInference.run_steering,
    "run_attn":              TLInference.run_attn,
}

def handler(job):
    inp = job["input"]
    endpoint = inp.get("endpoint")
    model_id  = inp.get("model_id")        # full HF ID, e.g. "openai-community/gpt2"
    hf_token  = inp.get("hf_token")        # None for public models

    if endpoint not in ENDPOINT_DISPATCH:
        yield {"stage": "error", "error": f"Unknown endpoint: {endpoint}"}
        return

    yield {"stage": "Loading model weights…"}
    model = get_or_load_model(model_id, hf_token)
    yield {"stage": "Running inference…"}

    fn = ENDPOINT_DISPATCH[endpoint]
    yield from fn(model, inp)

runpod.serverless.start({"handler": handler, "return_aggregate_stream": True})
```

`return_aggregate_stream: True` enables incremental chunk delivery via `/stream/{job_id}`.

### model_cache.py

```python
_cache: dict[str, object] = {}

def get_or_load_model(model_id: str, hf_token: str | None = None):
    if model_id not in _cache:
        from transformer_lens import TransformerBridge
        _cache[model_id] = TransformerBridge.boot_transformers(
            model_id, hf_token=hf_token
        )
        _warmup(_cache[model_id])
    return _cache[model_id]
```

Module-level dict persists across invocations on a warm worker — equivalent to Modal's `@modal.enter`. No manual path checks needed for Network Volume; setting `HF_HOME=/runpod-volume/huggingface-cache` makes HuggingFace's own cache logic handle it.

### inference.py

Near-verbatim port of `_TLBase` methods. Changes:

| Modal `_TLBase` | RunPod `TLInference` |
|---|---|
| `@modal.method()` decorator | `@staticmethod` |
| `modal.parameter()` for `model_id` | `model_id` from `job["input"]` |
| Methods return a value | Methods `yield` progress chunks, then `{"stage": "done", "data": result}` |
| `self.model` | `model` passed as argument |

All TL 3.0 API constraints from CLAUDE.md apply verbatim:
- Hook callbacks: second param MUST be named `hook`
- Full hook name strings only (`blocks.{layer}.hook_resid_post`, etc.)
- `hook_result` doesn't exist — compute per-head W_O output manually
- `TransformerBridge.boot_transformers()` — not `HookedTransformer.from_pretrained`

### Cold-start progress events

```
{"stage": "Downloading model weights…"}   ← only on true cold start
{"stage": "Loading model weights…"}       ← TransformerBridge.boot_transformers()
{"stage": "Running warmup pass…"}
{"stage": "Running inference…"}
{"stage": "done", "data": {...}}          ← terminal event, identical shape to current
```

Warm workers skip the first two. Browser renders all `stage` strings identically.

### Dockerfile

```dockerfile
FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime

ENV HF_HOME=/runpod-volume/huggingface-cache

RUN pip install --no-cache-dir \
    transformer-lens>=3.0 \
    einops==0.8.1 \
    runpod \
    huggingface-hub \
    safetensors

COPY worker/ /app/
WORKDIR /app

CMD ["python", "handler.py"]
```

`HF_HOME` set at image level — HuggingFace download logic checks that path automatically. For `tl_small/medium/large` endpoints (no volume mounted), this path doesn't exist and HF falls back to download-on-demand with ephemeral `/tmp` caching.

### RunPod endpoint configuration

Four endpoints in RunPod console, all pointing at the same Docker image:

| Endpoint | GPU SKU | Env var |
|---|---|---|
| `tl-small` | L4 (24 GB) | `RUNPOD_ENDPOINT_SMALL` |
| `tl-medium` | L40S (48 GB) | `RUNPOD_ENDPOINT_MEDIUM` |
| `tl-large` | A100-80GB | `RUNPOD_ENDPOINT_LARGE` |
| `tl-xlarge` | H200 + Network Volume | `RUNPOD_ENDPOINT_XLARGE` |

GPU SKU and scale-down window set in RunPod endpoint settings (not in code). Suggested scale-down: 30s for small/medium, 15s for large/xlarge — matches current `_TL_KWARGS`.

---

## Section 3: Next.js Polling Layer

### fetchUpstream replacement (api-helpers.ts)

```typescript
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY!;
const POLL_INTERVAL_MS = 400;

export async function fetchUpstream(
  endpointUrl: string,
  body: unknown,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const sendEvent = (data: object) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  // Submit job
  const submitRes = await fetch(`${endpointUrl}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
    body: JSON.stringify({ input: body }),
  });
  if (!submitRes.ok) {
    sendEvent({ stage: "error", error: `RunPod submit failed: ${submitRes.status}` });
    return;
  }
  const { id: jobId } = await submitRes.json();

  // Poll /stream until done or error
  while (true) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${endpointUrl}/stream/${jobId}`, {
      headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
    });
    if (!pollRes.ok) {
      sendEvent({ stage: "error", error: `RunPod poll failed: ${pollRes.status}` });
      return;
    }

    const { stream, status } = await pollRes.json();

    for (const chunk of stream ?? []) {
      sendEvent(chunk.output);
      if (chunk.output?.stage === "done" || chunk.output?.stage === "error") return;
    }

    if (status === "FAILED") {
      sendEvent({ stage: "error", error: "RunPod job failed" });
      return;
    }
  }
}
```

### Endpoint URL selection (api-helpers.ts)

```typescript
const RUNPOD_ENDPOINTS: Record<GpuTier, string> = {
  tl_small:   process.env.RUNPOD_ENDPOINT_SMALL!,
  tl_medium:  process.env.RUNPOD_ENDPOINT_MEDIUM!,
  tl_large:   process.env.RUNPOD_ENDPOINT_LARGE!,
  tl_xlarge:  process.env.RUNPOD_ENDPOINT_XLARGE!,
};

function bumpTier(tier: GpuTier): GpuTier {
  const order: GpuTier[] = ["tl_small", "tl_medium", "tl_large", "tl_xlarge"];
  const idx = order.indexOf(tier);
  return order[Math.min(idx + 1, order.length - 1)];
}

export function resolveEndpointUrl(tier: GpuTier, bump = false): string {
  const resolved = bump ? bumpTier(tier) : tier;
  return RUNPOD_ENDPOINTS[resolved];
}
```

`bumpTier` replaces `_bump_tier()` in the Python layer. Attribution and activation-patch pass `bump=true`.

### Per-route changes

| Route | `bump` | `endpoint` key |
|---|---|---|
| `run-lens` | false | `"run_lens"` |
| `run-dla` | false | `"run_dla"` |
| `run-attribution` | true | `"run_attribution"` |
| `run-activation-patch` | true | `"run_activation_patch"` |
| `run-steering` | false | `"run_steering"` |
| `run-attn` | false | `"run_attn"` |

Call pattern per route:
```typescript
const tier = await resolveModelTier(modelName);           // unchanged
const endpointUrl = resolveEndpointUrl(tier, bump);
const workerInput = { endpoint: "run_lens", model_id: modelName, hf_token, ...payload };
// pass controller + encoder to fetchUpstream
```

### Environment variables

```
# .env.local additions
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_SMALL=https://api.runpod.ai/v2/<id>
RUNPOD_ENDPOINT_MEDIUM=https://api.runpod.ai/v2/<id>
RUNPOD_ENDPOINT_LARGE=https://api.runpod.ai/v2/<id>
RUNPOD_ENDPOINT_XLARGE=https://api.runpod.ai/v2/<id>

# Unchanged — now points to Railway FastAPI (lightweight endpoints only)
NEXT_PUBLIC_API_URL=https://doppo-api.railway.app
```

### FastAPI service (Railway)

Lightweight `Dockerfile.api` (no torch) deployed to Railway via GitHub integration. Serves:
- `GET /api/models`
- `POST /api/validate-model`
- `POST /api/tokenize`
- `POST /api/generate-pairs`

Streaming proxy endpoints (`/api/run-*-stream`) are **deleted** — RunPod handles GPU work directly.

---

## Section 4: CI/CD Pipeline

```yaml
# .github/workflows/deploy-worker.yml
name: Deploy RunPod Worker

on:
  push:
    branches: [main]
    paths:
      - "backend/worker/**"
      - "backend/Dockerfile"

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: backend
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:latest
            ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:${{ github.sha }}

      - name: Update RunPod endpoints
        env:
          RUNPOD_API_KEY: ${{ secrets.RUNPOD_API_KEY }}
          IMAGE: ${{ secrets.DOCKERHUB_USERNAME }}/doppo-worker:${{ github.sha }}
          ENDPOINT_SMALL:   ${{ secrets.RUNPOD_ENDPOINT_ID_SMALL }}
          ENDPOINT_MEDIUM:  ${{ secrets.RUNPOD_ENDPOINT_ID_MEDIUM }}
          ENDPOINT_LARGE:   ${{ secrets.RUNPOD_ENDPOINT_ID_LARGE }}
          ENDPOINT_XLARGE:  ${{ secrets.RUNPOD_ENDPOINT_ID_XLARGE }}
        run: |
          for ID in $ENDPOINT_SMALL $ENDPOINT_MEDIUM $ENDPOINT_LARGE $ENDPOINT_XLARGE; do
            curl -sf -X PATCH "https://api.runpod.io/v2/endpoint/${ID}" \
              -H "Authorization: Bearer $RUNPOD_API_KEY" \
              -H "Content-Type: application/json" \
              -d "{\"dockerImage\": \"$IMAGE\"}" \
            && echo "Updated $ID" || echo "Failed $ID"
          done
```

**Secrets required in GitHub:**

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `RUNPOD_API_KEY` | RunPod API key |
| `RUNPOD_ENDPOINT_ID_SMALL` | bare endpoint ID (not full URL) |
| `RUNPOD_ENDPOINT_ID_MEDIUM` | same |
| `RUNPOD_ENDPOINT_ID_LARGE` | same |
| `RUNPOD_ENDPOINT_ID_XLARGE` | same |

**Image tagging:** `:latest` for convenience; `:<git-sha>` pinned to each endpoint for clean rollbacks. RunPod does a rolling update on next cold start — warm workers finish in-flight jobs on the old image.

---

## Section 5: Model Loading / Caching Strategy

| Tier | Strategy | Cold-start time |
|---|---|---|
| `tl_small/medium/large` — featured models | RunPod built-in endpoint caching (`HF_HOME` path populated via first cold start) | ~30s first time; <1s warm |
| `tl_xlarge` — 25–70B models | Network Volume at `/runpod-volume/huggingface-cache` | ~18s (volume read) vs 3–5 min (HF download) |
| All tiers — long-tail models | Download-on-demand; ephemeral `/tmp` per worker | Full HF download each cold start |

`HF_HOME=/runpod-volume/huggingface-cache` set in Dockerfile. For endpoints without a volume mounted, HF falls back to system temp. No manual path logic needed in application code.

---

## Transition Plan

1. Create `backend/worker/` with `handler.py`, `inference.py`, `model_cache.py`
2. Write `backend/Dockerfile` and `backend/Dockerfile.api`
3. Manually push Docker image; create four RunPod endpoints
4. Update `api-helpers.ts` — new `fetchUpstream`, `resolveEndpointUrl`, `bumpTier`
5. Update all six inference routes (`run-lens`, `run-dla`, `run-attribution`, `run-activation-patch`, `run-steering`, `run-attn`)
6. Add env vars to `.env.local`
7. Deploy FastAPI service to Railway; update `NEXT_PUBLIC_API_URL`
8. Smoke test all six endpoints locally against RunPod
9. Set up GitHub Actions workflow
10. Delete `main.py` streaming proxy endpoints; keep validation/models endpoints until Railway is live
