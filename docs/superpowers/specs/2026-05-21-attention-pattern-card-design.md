# Attention Pattern Card — Design Spec

**Date:** 2026-05-21  
**Status:** Approved

---

## Overview

A new standalone canvas card that visualizes per-head attention patterns for any HuggingFace model supported by TransformerLens 3.0. The user picks a model and prompt, runs the card, and sees the attention weight matrices for each head organized by layer — one layer visible at a time, navigable with prev/next buttons.

---

## Architecture

Five new files, mirroring the DLA card pattern:

| File | Purpose |
|---|---|
| `frontend/app/components/AttentionCard.tsx` | Card component + `AttentionCardData` type |
| `frontend/app/components/AttentionConfigPane.tsx` | Config pane (model + prompt only) |
| `frontend/app/api/run-attn/route.ts` | Next.js API route → Modal |
| `_TLBase.run_attn` in `backend/main.py` | Forward pass returning all patterns |
| `attn_cache` table in `app/schema.ts` + migration | R2-backed cache |

Standard card registration touches in five existing files:

- `SandboxCanvas.tsx` — add `AttentionCardData` to `AnyCard` union; add `"attention-pattern"` case to `renderCard()`
- `actions.ts` — add `"attention-pattern"` to `SerializedCard.cardType`; add restore block with `?? default` for all fields
- `projects/types.ts` — add `ATTENTION_CARD_RESOLVED` action
- `projects/page.tsx` — add dispatch handler
- `projects/hooks/useSSEHandlers.ts` — add resolved handler (or new `useAttnHandlers.ts` hook if preferred)

---

## Data Shapes

### Backend response (single JSON, no SSE)

```ts
type AttentionData = {
  tokens: string[];          // decoded token strings, len ≤ 64
  patterns: number[][][][];  // [n_layers][n_heads][seq][seq]
  n_layers: number;
  n_heads: number;
  truncated: boolean;        // true if prompt was capped at 64 tokens
}
```

### Card state

```ts
type AttentionCardData = {
  id: string;
  cardType: "attention-pattern";
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: AttentionData | null;
  error: string | null;
  position: { x: number; y: number };
  gpuTier?: string;
  startedAt?: number;
  loadingStage?: string;
}
```

---

## Backend Implementation

### Hook name

`cache[f"blocks.{layer}.attn.hook_pattern"]` — shape `[1, n_heads, seq, seq]`.  
Filtered via `names_filter=lambda name: "hook_pattern" in name` to minimize peak VRAM.

### `_TLBase.run_attn` method

```python
@modal.method()
def run_attn(self, prompt: str):
    import json, torch

    TOKEN_CAP = 64
    tokens = self.model.to_tokens(prompt)
    truncated = tokens.shape[1] > TOKEN_CAP
    if truncated:
        tokens = tokens[:, :TOKEN_CAP]

    _, cache = self.model.run_with_cache(
        tokens,
        names_filter=lambda name: "hook_pattern" in name,
    )

    n_layers = self.model.cfg.n_layers
    patterns = []
    for layer in range(n_layers):
        layer_pats = cache[f"blocks.{layer}.attn.hook_pattern"][0].cpu().tolist()
        patterns.append(layer_pats)

    token_strs = [self.model.tokenizer.decode([t]) for t in tokens[0].tolist()]

    yield json.dumps({
        "stage": "done",
        "data": {
            "tokens": token_strs,
            "patterns": patterns,
            "n_layers": n_layers,
            "n_heads": self.model.cfg.n_heads,
            "truncated": truncated,
        },
    })
```

### `/api/run-attn/route.ts`

Mirrors `/api/run-dla/route.ts`:
- Validates session for non-`tl_small` tiers
- SHA-256 cache key: `modelName:prompt`
- Cache hit: serve from R2 via `getHeatmap(r2Key)` (reuse existing helper)
- Cache miss: call Modal `run_attn`, write to R2 + `attn_cache` row
- Returns plain JSON (no SSE — single-stage response)

---

## Card Layout and Interaction

### Header

Drag handle · model name · prompt · `×` close. No `overflow: hidden` — avoids the known LensCard clipping issue.

### Sub-header (result state only)

- `← L{n} →` layer navigation (prev/next buttons, current layer label centered)
- GPU tier chip
- `truncated to 64 tok` badge when `data.truncated === true`

### Body

A wrapped grid of `n_heads` attention matrices for the current layer.

- **Cell size:** 10px × 10px fixed
- **Max card width:** ~900px; heads wrap to multiple rows beyond that
- **Head label:** small `H{n}` above each matrix
- **Token labels:** y-axis (query tokens, left), x-axis (key tokens, top, rotated 45°), monospace 7px
- **Background:** `var(--color-card)` on scroll containers to prevent white-layer browser bug

### Color

Each head gets a distinct hue distributed evenly across the HSL wheel:

```
hue(h) = h * 360 / n_heads
cell color = hsl(hue, weight * 80%, lerp(95%, 25%, weight))
```

- Zero attention → near white
- Full attention → deep saturated hue for that head

New helper added to `app/lib/palette.ts`:

```ts
export function getHeadColor(headIdx: number, nHeads: number, weight: number): string
```

### Hover

Tooltip: `L{l} H{h}: "{queryTok}" → "{keyTok}" = 0.312`

### Click interaction

Clicking any cell `(q, k)` sets `selectedQ` / `selectedK` in local component state. All `n_heads` matrices in the current layer highlight the same `(q, k)` cell with a 1.5px white/black outline ring (color-agnostic, works across all head hues). Clicking the same cell again deselects.

### Loading state

`CardLoadingState` with fixed label `"Computing attention patterns…"` + elapsed timer. No multi-stage SSE — single request, single response.

---

## Caching and DB Schema

### New table

```ts
export const attnCache = pgTable("attn_cache", {
  id: text("id").primaryKey(),       // SHA-256 of "modelName:prompt"
  r2Key: text("r2_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

### R2 key format

`attn/{hash}.json` — consistent with `dla/{hash}.json`.

### Migration script

Non-TTY `.mjs` workaround per database rules:

```js
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL);
await sql.query(`CREATE TABLE attn_cache (
  id text PRIMARY KEY,
  r2_key text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
)`);
```

---

## Entry Point

New "Attention" button in the `ConfigPane` "Add +" dropdown, triggering `AttentionConfigPane`. Config pane has only two fields: model selection (same featured model grid / free-text HF ID flow as other panes) and prompt input. No target token, no contrastive token.
