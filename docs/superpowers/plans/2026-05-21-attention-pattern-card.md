# Attention Pattern Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Attention Pattern" canvas card that visualizes per-head softmax attention weights for any supported HuggingFace model, with per-layer navigation and cross-head cell highlighting.

**Architecture:** New `AttentionCard` + `AttentionConfigPane` components following the DLA card pattern exactly — standalone config pane (model + prompt only), `/api/run-attn` Next.js route calling a new `run_attn` Modal backend method, response cached in R2 + `attn_cache` Postgres table. All layers' attention patterns returned in one payload; layer navigation is purely client-side.

**Tech Stack:** Next.js 15 App Router, TransformerLens 3.0 via `TransformerBridge`, Modal serverless GPU, Drizzle ORM + Neon, Cloudflare R2.

---

## File Map

**Create:**
- `frontend/app/components/AttentionCard.tsx` — card component + `AttentionData` + `AttentionCardData` types
- `frontend/app/components/AttentionConfigPane.tsx` — config pane (model + prompt)
- `frontend/app/api/run-attn/route.ts` — Next.js API route with R2 caching

**Modify:**
- `backend/main.py` — add `run_attn` method to `_TLBase`; add `AttentionRequest` Pydantic model + `/api/run-attn-stream` FastAPI endpoint inside `api()`
- `frontend/app/lib/palette.ts` — add `getHeadColor(headIdx, nHeads, weight)`
- `frontend/app/schema.ts` — add `attnCache` table
- `frontend/app/projects/types.ts` — add `ATTENTION_CARD_RESOLVED` action; import `AttentionData`
- `frontend/app/projects/helpers.ts` — add `"attention-pattern"` case to `serializeCard`
- `frontend/app/projects/hooks/useSSEHandlers.ts` — add `addAttn` callback
- `frontend/app/projects/page.tsx` — reducer case, DB restore block, state var, handler, dropdown item, pane render
- `frontend/app/components/SandboxCanvas.tsx` — add to `AnyCard` union + `renderCard`

**Migration script (temp, delete after run):**
- `migrate-attn-cache.mjs`

---

## Task 1: DB Schema — add `attnCache` table

**Files:**
- Modify: `frontend/app/schema.ts`
- Create (temp): `migrate-attn-cache.mjs`

- [ ] **Step 1: Add `attnCache` to `schema.ts`**

Open `frontend/app/schema.ts`. After the `activationPatchCache` table definition (line ~74), add:

```ts
export const attnCache = pgTable("attn_cache", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  prompt: text("prompt").notNull(),
  r2Key: text("r2_key"),
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at"),
});
```

- [ ] **Step 2: Create migration script `migrate-attn-cache.mjs` in repo root**

```js
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: "frontend/.env.local" });
const sql = neon(process.env.DATABASE_URL);
await sql.query(`CREATE TABLE IF NOT EXISTS attn_cache (
  id text PRIMARY KEY,
  model_name text NOT NULL,
  prompt text NOT NULL,
  r2_key text,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz
)`);
console.log("attn_cache table created (or already exists)");
```

- [ ] **Step 3: Run the migration**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo
node migrate-attn-cache.mjs
```

Expected output: `attn_cache table created (or already exists)`

- [ ] **Step 4: Delete the migration script**

```bash
rm migrate-attn-cache.mjs
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/schema.ts
git commit -m "feat: add attn_cache table for attention pattern caching"
```

---

## Task 2: `getHeadColor` utility in `palette.ts`

**Files:**
- Modify: `frontend/app/lib/palette.ts`

- [ ] **Step 1: Add `getHeadColor` export at the end of `palette.ts`**

```ts
export function getHeadColor(headIdx: number, nHeads: number, weight: number): string {
  const hue = (headIdx * 360) / Math.max(nHeads, 1);
  const saturation = weight * 80;
  const lightness = 95 - weight * 70;
  return `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`;
}
```

- [ ] **Step 2: Smoke-test in browser console**

Start the dev server (`npm run dev` inside `frontend/`) and open the browser console. Run:

```js
// Verify: weight=0 → near white (lightness ~95%)
// Verify: weight=1 → deep saturated (lightness ~25%)
// Verify: headIdx=0 → hue=0 (red), headIdx=6/12 → hue=180 (cyan)
```

The function produces valid CSS `hsl(...)` strings. Check no NaN or Infinity appears for edge cases `nHeads=1` and `weight=0`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/lib/palette.ts
git commit -m "feat: add getHeadColor helper for per-head HSL coloring"
```

---

## Task 3: Backend — `run_attn` method + FastAPI endpoint

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add `run_attn` method to `_TLBase` in `main.py`**

Inside the `_TLBase` class (after `run_logit_lens`, before the concrete subclass definitions at line ~1042), add:

```python
    @modal.method()
    def run_attn(self, prompt: str):
        import json
        import torch

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

- [ ] **Step 2: Add `AttentionRequest` Pydantic model inside `api()` function**

Inside the `api()` function in `main.py`, after the `SteeringRequest` class definition (around line ~1179), add:

```python
    class AttentionRequest(BaseModel):
        prompt: str
        model_name: str
```

- [ ] **Step 3: Add `/api/run-attn-stream` endpoint inside `api()` function**

After the `run_steering_stream` endpoint (at the end of the FastAPI route definitions), add:

```python
    @web_app.post("/api/run-attn-stream")
    async def run_attn_stream(request: AttentionRequest):
        from fastapi.responses import StreamingResponse

        cls, model_id = _resolve_model(request.model_name, bump=False, hf_token=hf_token)

        async def event_stream():
            try:
                async for chunk in cls(model_id=model_id).run_attn.remote_gen.aio(
                    request.prompt
                ):
                    yield f"data: {chunk}\n\n"
            except Exception as e:
                yield _sse_error(e)

        return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 4: Verify syntax**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo
python -c "import ast; ast.parse(open('backend/main.py').read()); print('syntax OK')"
```

Expected output: `syntax OK`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat: add run_attn backend method and run-attn-stream endpoint"
```

---

## Task 4: API route `/api/run-attn/route.ts`

**Files:**
- Create: `frontend/app/api/run-attn/route.ts`

- [ ] **Step 1: Create the route file**

Create `frontend/app/api/run-attn/route.ts`:

```ts
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { attnCache } from "@/app/schema";
import { putHeatmap, getHeatmap } from "@/app/lib/r2";
import {
  SSE_HEADERS,
  parseSSE,
  requireAuth,
  fetchUpstream,
  validateGpuTier,
} from "@/app/lib/api-helpers";

export async function POST(request: NextRequest) {
  const { prompt, modelName, gpuTier } = (await request.json()) as {
    prompt: string;
    modelName: string;
    gpuTier?: string;
  };

  if (typeof modelName !== "string" || modelName.length < 1 || modelName.length > 200) {
    return new Response(
      JSON.stringify({ error: "modelName must be a string between 1 and 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (typeof prompt !== "string" || prompt.length < 1 || prompt.length > 8000) {
    return new Response(
      JSON.stringify({ error: "prompt must be a non-empty string of at most 8000 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!validateGpuTier(gpuTier)) {
    return new Response(
      JSON.stringify({ error: "gpuTier must be one of: tl_small, tl_medium, tl_large, tl_xlarge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const authResult = await requireAuth(gpuTier);
  if (!("userId" in authResult)) return authResult;

  const cacheKey = createHash("sha256")
    .update(`${modelName}:${prompt}`)
    .digest("hex");

  const cached = await db
    .select({ r2Key: attnCache.r2Key })
    .from(attnCache)
    .where(eq(attnCache.id, cacheKey))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    const data = await getHeatmap(cached[0].r2Key);
    db.update(attnCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(attnCache.id, cacheKey))
      .catch(console.error);
    const payload = JSON.stringify({ stage: "done", data });
    return new Response(`data: ${payload}\n\n`, { headers: SSE_HEADERS });
  }

  const upstreamResult = await fetchUpstream(
    `${process.env.NEXT_PUBLIC_API_URL}/api/run-attn-stream`,
    { prompt, model_name: modelName }
  );
  if (!upstreamResult.ok) return upstreamResult.errorResponse;

  const encoder = new TextEncoder();
  let doneData: unknown = null;

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const event of parseSSE(upstreamResult.response.body!)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.stage === "done") doneData = event.data;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writer
        .write(encoder.encode(`data: ${JSON.stringify({ stage: "error", error: msg })}\n\n`))
        .catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }

    if (doneData) {
      try {
        await putHeatmap(cacheKey, doneData);
        await db
          .insert(attnCache)
          .values({ id: cacheKey, modelName, prompt, r2Key: cacheKey })
          .onConflictDoNothing();
      } catch (err) {
        console.error("Attention cache write failed:", err);
      }
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `run-attn/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/run-attn/route.ts
git commit -m "feat: add /api/run-attn route with R2 caching"
```

---

## Task 5: `AttentionCard.tsx` component

**Files:**
- Create: `frontend/app/components/AttentionCard.tsx`

- [ ] **Step 1: Create `AttentionCard.tsx`**

Create `frontend/app/components/AttentionCard.tsx`:

```tsx
"use client";

import React from "react";
import { getHeadColor } from "../lib/palette";
import { TIER_LABELS } from "../lib/tiers";
import { CardDragHandle, CardLoadingState, CardErrorState } from "./CardShell";

export type AttentionData = {
  tokens: string[];
  patterns: number[][][][];  // [n_layers][n_heads][seq][seq]
  n_layers: number;
  n_heads: number;
  truncated: boolean;
};

export type AttentionCardData = {
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
};

type AttentionCardProps = {
  card: AttentionCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
};

const CELL_SIZE = 10;
const Y_LABEL_W = 42;
const X_LABEL_H = 40;

type SelectedCell = { q: number; k: number } | null;

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function AttentionMatrix({
  headIdx,
  nHeads,
  pattern,
  tokens,
  selectedCell,
  onCellClick,
}: {
  headIdx: number;
  nHeads: number;
  pattern: number[][];
  tokens: string[];
  selectedCell: SelectedCell;
  onCellClick: (q: number, k: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Head label */}
      <div style={{
        height: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontFamily: "var(--font-azeret-mono), monospace",
        color: "var(--color-text-muted)",
        marginBottom: 2,
      }}>
        H{headIdx}
      </div>

      <div style={{ display: "flex" }}>
        {/* Y-axis labels (query tokens) */}
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ height: X_LABEL_H }} />
          {tokens.map((tok, qi) => (
            <div
              key={qi}
              style={{
                width: Y_LABEL_W,
                height: CELL_SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <span style={{
                fontSize: 6,
                fontFamily: "var(--font-azeret-mono), monospace",
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: Y_LABEL_W - 4,
              }}>
                {tok}
              </span>
            </div>
          ))}
        </div>

        {/* Matrix body: x labels + cells */}
        <div style={{ flexShrink: 0 }}>
          {/* X-axis labels (key tokens, rotated 45°) */}
          <div style={{ display: "flex", height: X_LABEL_H, alignItems: "flex-end" }}>
            {tokens.map((tok, ki) => (
              <div
                key={ki}
                style={{
                  width: CELL_SIZE,
                  height: X_LABEL_H,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  overflow: "visible",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  fontSize: 6,
                  fontFamily: "var(--font-azeret-mono), monospace",
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  transform: "rotate(-45deg)",
                  transformOrigin: "bottom center",
                  display: "block",
                  maxWidth: 28,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {tok}
                </span>
              </div>
            ))}
          </div>

          {/* Cell rows */}
          {pattern.map((row, qi) => (
            <div key={qi} style={{ display: "flex" }}>
              {row.map((weight, ki) => {
                const isSelected = selectedCell?.q === qi && selectedCell?.k === ki;
                const color = getHeadColor(headIdx, nHeads, weight);
                return (
                  <div
                    key={ki}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => onCellClick(qi, ki)}
                    title={`H${headIdx}: "${tokens[qi]}" → "${tokens[ki]}" = ${weight.toFixed(3)}`}
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      background: color,
                      boxSizing: "border-box",
                      cursor: "pointer",
                      outline: isSelected ? "1.5px solid var(--color-text)" : "none",
                      outlineOffset: "-1px",
                      position: "relative",
                      zIndex: isSelected ? 1 : 0,
                      flexShrink: 0,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AttentionCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
}: AttentionCardProps) {
  const [currentLayer, setCurrentLayer] = React.useState(0);
  const [selectedCell, setSelectedCell] = React.useState<SelectedCell>(null);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [headerHovered, setHeaderHovered] = React.useState(false);

  React.useEffect(() => {
    if (card.status !== "loading") return;
    const start = card.startedAt ?? Date.now();
    setElapsedMs(Date.now() - start);
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [card.status, card.startedAt]);

  React.useEffect(() => {
    setCurrentLayer(0);
    setSelectedCell(null);
  }, [card.data]);

  const nLayers = card.data?.n_layers ?? 0;

  function handleCellClick(q: number, k: number) {
    setSelectedCell(prev => (prev?.q === q && prev?.k === k ? null : { q, k }));
  }

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        background: "var(--color-card)",
        borderRadius: 8,
        border: "1px solid var(--color-card-border)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Hover popup */}
      {headerHovered && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: 0,
          background: "var(--color-card)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px",
          zIndex: 100,
          pointerEvents: "none",
          minWidth: 200,
          maxWidth: 320,
          animation: "fadeUp 120ms ease-out",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, margin: 0, color: "var(--color-text)", fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-all" }}>
            {card.modelName}
          </p>
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "5px 0 0", lineHeight: 1.5, fontFamily: "var(--font-azeret-mono), monospace", wordBreak: "break-word" }}>
            {card.prompt}
          </p>
          <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
              Attn
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          borderBottom: "1px solid var(--color-surface-border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {/* Drag strip */}
        <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <CardDragHandle />
          <span style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, flexShrink: 0 }}>
            {card.modelName}
          </span>
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {card.prompt}
          </span>
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onRemove(card.id)}
            style={{ fontSize: 12, color: "var(--color-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Sub-header: layer nav (result only) */}
        {card.status === "result" && card.data && (
          <div
            onPointerDown={e => e.stopPropagation()}
            style={{
              padding: "4px 10px",
              borderTop: "1px solid var(--color-surface-border)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <button
              onClick={() => setCurrentLayer(l => Math.max(0, l - 1))}
              disabled={currentLayer === 0}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === 0 ? "not-allowed" : "pointer", color: currentLayer === 0 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >
              ←
            </button>
            <span style={{ fontSize: 10, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text)", minWidth: 28, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              L{currentLayer}
            </span>
            <button
              onClick={() => setCurrentLayer(l => Math.min(nLayers - 1, l + 1))}
              disabled={currentLayer === nLayers - 1}
              style={{ fontSize: 12, background: "none", border: "none", cursor: currentLayer === nLayers - 1 ? "not-allowed" : "pointer", color: currentLayer === nLayers - 1 ? "var(--color-text-muted)" : "var(--color-text)", padding: "0 4px", lineHeight: 1 }}
            >
              →
            </button>
            <div style={{ flex: 1 }} />
            {card.gpuTier && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            )}
            {card.data.truncated && (
              <span style={{ fontSize: 9, fontWeight: 600, color: "#d97706", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                truncated to 64 tok
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {card.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, minHeight: 110 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {card.gpuTier ? (
              <span style={{ fontSize: 9, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-surface-border)", border: "1px solid var(--color-card-border)", borderRadius: 3, padding: "1px 5px" }}>
                {TIER_LABELS[card.gpuTier] ?? card.gpuTier}
              </span>
            ) : <span />}
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-azeret-mono), monospace", fontVariantNumeric: "tabular-nums" }}>
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <CardLoadingState
            stage="Computing attention patterns…"
            elapsed={elapsedMs}
            warmup={elapsedMs > 30_000}
          />
        </div>
      )}

      {/* Error */}
      {card.status === "error" && <CardErrorState message={card.error ?? undefined} />}

      {/* Result */}
      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", background: "var(--color-card)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: 10 }}>
            {Array.from({ length: card.data.n_heads }, (_, h) => (
              <AttentionMatrix
                key={h}
                headIdx={h}
                nHeads={card.data!.n_heads}
                pattern={card.data!.patterns[currentLayer][h]}
                tokens={card.data!.tokens}
                selectedCell={selectedCell}
                onCellClick={handleCellClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(AttentionCard);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `AttentionCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/AttentionCard.tsx
git commit -m "feat: add AttentionCard component with per-head HSL coloring and cell selection"
```

---

## Task 6: `AttentionConfigPane.tsx` component

**Files:**
- Create: `frontend/app/components/AttentionConfigPane.tsx`

- [ ] **Step 1: Create `AttentionConfigPane.tsx`**

This is a trimmed version of `DlaConfigPane` — model selection + prompt, no Analysis Target section.

Create `frontend/app/components/AttentionConfigPane.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/app/lib/auth-client";
import { TIER_LABELS } from "../lib/tiers";
import { useTokenPreview } from "../hooks/useTokenPreview";
import TokenPreview from "./TokenPreview";

type ModelInfo = {
  id: string;
  display_name: string;
  description: string;
  requires_hf_token: boolean;
  gpu_tier: string;
};

type CustomValidation = {
  valid: boolean;
  gpu_tier: string | null;
  reason: string;
};

type AttentionConfigPaneProps = {
  isOpen: boolean;
  availableModels: ModelInfo[];
  modelsLoading: boolean;
  onSubmit: (config: { modelName: string; prompt: string; gpuTier?: string }) => void;
  onClose: () => void;
};

const DEFAULT_PROMPT = "The capital of France is Paris. The capital of Germany is";

export default function AttentionConfigPane({
  isOpen,
  availableModels,
  modelsLoading,
  onSubmit,
  onClose,
}: AttentionConfigPaneProps) {
  const { data: session } = useSession();
  const [selectedModel, setSelectedModel] = useState("");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [customRepoId, setCustomRepoId] = useState("");
  const [customValidation, setCustomValidation] = useState<CustomValidation | null>(null);
  const [customValidating, setCustomValidating] = useState(false);

  useEffect(() => {
    if (selectedModel === "" && availableModels.length > 0 && customRepoId === "") {
      setSelectedModel(availableModels[0].id);
    }
  }, [availableModels, selectedModel, customRepoId]);

  const doReset = () => {
    setSelectedModel(availableModels[0]?.id ?? "");
    setPrompt(DEFAULT_PROMPT);
    setCustomRepoId("");
    setCustomValidation(null);
    setCustomValidating(false);
  };

  const handleClose = () => {
    doReset();
    onClose();
  };

  const selectFeaturedModel = (id: string) => {
    setSelectedModel(id);
    setCustomRepoId("");
    setCustomValidation(null);
  };

  const handleCustomRepoChange = (value: string) => {
    setCustomRepoId(value);
    setSelectedModel("");
    setCustomValidation(null);
  };

  const validateCustomRepo = async () => {
    setCustomValidating(true);
    setCustomValidation(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/validate-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: customRepoId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCustomValidation({ valid: false, gpu_tier: null, reason: json.detail ?? "Validation failed." });
      } else {
        setCustomValidation(json);
      }
    } catch {
      setCustomValidation({ valid: false, gpu_tier: null, reason: "Network error during validation." });
    } finally {
      setCustomValidating(false);
    }
  };

  const usingCustom = customRepoId.trim() !== "";
  const activeModelId = usingCustom
    ? (customValidation?.valid ? customRepoId.trim() : "")
    : selectedModel;
  const tokenPreview = useTokenPreview(activeModelId, prompt);
  const modelOk = usingCustom ? customValidation?.valid === true : selectedModel !== "";
  const canRun = modelOk && prompt.trim() !== "";

  const selectedGpuTier = usingCustom
    ? (customValidation?.gpu_tier ?? null)
    : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? null);
  const isLockedByAuth = !session && selectedGpuTier !== null && selectedGpuTier !== "tl_small";

  const handleRun = () => {
    if (!canRun) return;
    const modelName = usingCustom ? customRepoId.trim() : selectedModel;
    const gpuTier = usingCustom
      ? (customValidation?.gpu_tier ?? undefined)
      : (availableModels.find(m => m.id === selectedModel)?.gpu_tier ?? undefined);
    onSubmit({ modelName, prompt, gpuTier });
    doReset();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 380,
        maxWidth: "min(380px, calc(100vw - 24px))",
        maxHeight: "calc(100vh - 100px)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-card)",
        border: "1px solid var(--color-card-border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
        animation: "cfgDropIn 140ms ease-out",
      }}
    >
      <style>{`@keyframes cfgDropIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: "1px solid var(--color-surface-border)" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", letterSpacing: "0.01em" }}>
          New Attention
        </span>
        <button
          onClick={handleClose}
          style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, transition: "background 120ms, color 120ms" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)"; }}
        >
          ×
        </button>
      </div>

      {/* Form body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* Featured models */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Featured Models
          </label>
          {modelsLoading ? (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "12px 0" }}>Loading models…</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, maxHeight: 260, overflowY: "auto", paddingRight: 2 }}>
              {availableModels.map(m => {
                const isSelected = selectedModel === m.id && !usingCustom;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectFeaturedModel(m.id)}
                    title={m.description}
                    style={{ border: `1.5px solid ${isSelected ? "var(--color-accent)" : "var(--color-card-border)"}`, borderRadius: 7, padding: "8px 9px", background: isSelected ? "var(--color-surface-border)" : "var(--color-card)", cursor: "pointer", textAlign: "left", transition: "border-color 120ms, background 120ms", display: "flex", flexDirection: "column", gap: 3 }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-accent)"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-card-border)"; }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--color-accent)" : "var(--color-text)", lineHeight: 1.3 }}>{m.display_name}</span>
                    <span style={{ fontSize: 10, color: "var(--color-text-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.description}</span>
                    {m.requires_hf_token && (
                      <span style={{ fontSize: 9, color: "var(--color-text-muted)", marginTop: 1, letterSpacing: "0.02em" }}>HF token required</span>
                    )}
                    {!session && m.gpu_tier !== "tl_small" && (
                      <span style={{ fontSize: 9, color: "#d97706", marginTop: 1, letterSpacing: "0.02em" }}>Sign in to run</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
        </div>

        {/* Any HuggingFace model */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
            Any HuggingFace Model
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              placeholder="username/model-name"
              value={customRepoId}
              onChange={e => handleCustomRepoChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && customRepoId.trim()) validateCustomRepo(); }}
              style={{ flex: 1, border: `1px solid ${usingCustom ? "var(--color-accent)" : "var(--color-card-border)"}`, borderRadius: 6, padding: "6px 8px", fontSize: 11, fontFamily: "var(--font-azeret-mono), monospace", color: "var(--color-text)", background: "var(--color-bg)", outline: "none", transition: "border-color 120ms" }}
            />
            <button
              onClick={validateCustomRepo}
              disabled={!customRepoId.trim() || customValidating}
              style={{ border: "1px solid var(--color-card-border)", borderRadius: 6, padding: "6px 10px", fontSize: 11, background: "var(--color-surface-border)", color: "var(--color-text-muted)", cursor: (!customRepoId.trim() || customValidating) ? "not-allowed" : "pointer", opacity: (!customRepoId.trim() || customValidating) ? 0.5 : 1, whiteSpace: "nowrap", transition: "background 120ms" }}
            >
              {customValidating ? "…" : "Validate"}
            </button>
          </div>
          {customValidation && (
            <p style={{ marginTop: 6, fontSize: 11, color: customValidation.valid ? "#16a34a" : "#dc2626", margin: "6px 0 0" }}>
              {customValidation.valid
                ? `✓ Valid — ${customValidation.gpu_tier ? TIER_LABELS[customValidation.gpu_tier] ?? customValidation.gpu_tier : "unknown GPU"}`
                : `✗ ${customValidation.reason}`}
            </p>
          )}
        </div>

        {/* Prompt */}
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={5}
            style={{ width: "100%", border: "1px solid var(--color-card-border)", borderRadius: 6, padding: "8px 10px", fontSize: 13, color: "var(--color-text)", background: "var(--color-bg)", resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
          />
          <TokenPreview tokens={tokenPreview.tokens} loading={tokenPreview.loading} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-surface-border)" }}>
        {isLockedByAuth && (
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--color-text-muted)", textAlign: "center" }}>
            Sign in to run medium and large models
          </p>
        )}
        <button
          onClick={handleRun}
          disabled={!canRun || isLockedByAuth}
          style={{ width: "100%", padding: "10px 0", borderRadius: 6, border: "none", background: (!canRun || isLockedByAuth) ? "var(--color-surface-border)" : "var(--color-accent)", color: (!canRun || isLockedByAuth) ? "var(--color-text-muted)" : "var(--color-accent-fg)", fontSize: 13, fontWeight: 600, cursor: (!canRun || isLockedByAuth) ? "not-allowed" : "pointer", letterSpacing: "0.02em", transition: "background 150ms" }}
          onMouseEnter={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent-hover)"; }}
          onMouseLeave={e => { if (canRun && !isLockedByAuth) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)"; }}
        >
          {isLockedByAuth ? "Sign in to run →" : "Run Attention →"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `AttentionConfigPane.tsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/AttentionConfigPane.tsx
git commit -m "feat: add AttentionConfigPane (model + prompt, no target token)"
```

---

## Task 7: State types and serialization — `types.ts`, `helpers.ts`, `actions.ts`

**Files:**
- Modify: `frontend/app/projects/types.ts`
- Modify: `frontend/app/projects/helpers.ts`
- Modify: `frontend/app/actions.ts`

- [ ] **Step 1: Add `ATTENTION_CARD_RESOLVED` action to `types.ts`**

In `frontend/app/projects/types.ts`, add the import after the existing imports:

```ts
import type { AttentionData } from "@/app/components/AttentionCard";
```

Then add the action to the `AppAction` union (after the `SPAWN_ENTROPY_CARD` line):

```ts
  | { type: "ATTENTION_CARD_RESOLVED"; id: string; data: AttentionData };
```

- [ ] **Step 2: Add `"attention-pattern"` serialize case to `helpers.ts`**

In `frontend/app/projects/helpers.ts`, add the import after existing imports:

```ts
import type { AttentionCardData } from "../components/AttentionCard";
```

Inside `serializeCard`, add the attention case BEFORE the final `const lc = c as LensCardData` fallthrough:

```ts
  if (c.cardType === "attention-pattern") {
    const ac = c as AttentionCardData;
    return { id: ac.id, cardType: "attention-pattern" as const, modelName: ac.modelName, prompt: ac.prompt, data: ac.data as Record<string, unknown>, position: ac.position, gpuTier: ac.gpuTier };
  }
```

- [ ] **Step 3: Add `"attention-pattern"` to `SerializedCard.cardType` in `actions.ts`**

`SerializedCard` already has all needed fields (`id`, `cardType?: string`, `modelName`, `prompt`, `data`, `position`, `gpuTier`). No new fields are required. The only change needed is documentation clarity — the existing `cardType?: string` already accepts `"attention-pattern"`. No edit required here.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/projects/types.ts frontend/app/projects/helpers.ts
git commit -m "feat: add ATTENTION_CARD_RESOLVED action type and attention-pattern serialize case"
```

---

## Task 8: `useSSEHandlers.ts` — add `addAttn`

**Files:**
- Modify: `frontend/app/projects/hooks/useSSEHandlers.ts`

- [ ] **Step 1: Add `AttentionCardData` and `AttentionData` imports**

At the top of `useSSEHandlers.ts`, after the existing imports, add:

```ts
import type { AttentionCardData, AttentionData } from "@/app/components/AttentionCard";
```

- [ ] **Step 2: Add `addAttn` callback inside `useSSEHandlers`**

Add after the `spawnEntropyCard` callback (before the `return` statement):

```ts
  const addAttn = useCallback(({ modelName, prompt, gpuTier }: {
    modelName: string; prompt: string; gpuTier?: string;
  }) => {
    const id = crypto.randomUUID();
    const card: AttentionCardData = {
      id, cardType: "attention-pattern", status: "loading", modelName, prompt,
      data: null, error: null,
      position: autoArrangePos(stateRef.current.lensCards.length),
      gpuTier, startedAt: Date.now(),
    };
    dispatch({ type: "ADD_CARD", card });
    fetch("/api/run-attn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, modelName, gpuTier }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const err = await response.json().catch(() => ({})) as { error?: string; detail?: string };
          dispatch({ type: "CARD_ERRORED", id, error: handleFetchError(response, err) });
          return;
        }
        for await (const event of readSSEStream(response)) {
          if (event.stage === "done" && event.data) {
            const data = event.data as AttentionData;
            dispatch({ type: "ATTENTION_CARD_RESOLVED", id, data });
            const pid = projectIdRef.current;
            if (pid) {
              const existing = stateRef.current.lensCards.filter(c => c.status === "result").map(serializeCard);
              updateProject(pid, [...existing, { id, cardType: "attention-pattern" as const, modelName, prompt, data: data as Record<string, unknown>, position: card.position, gpuTier }], stateRef.current.canvas).catch(console.error);
            }
          } else if (event.stage === "error") {
            dispatch({ type: "CARD_ERRORED", id, error: event.error ?? "Unknown error" });
          } else {
            dispatch({ type: "CARD_STAGE", id, stage: event.stage });
          }
        }
      })
      .catch(err => dispatch({ type: "CARD_ERRORED", id, error: err instanceof Error ? err.message : "Unknown error" }));
  }, [dispatch, projectIdRef, stateRef]);
```

- [ ] **Step 3: Add `addAttn` to the return object**

Change the return statement from:
```ts
  return { addLens, addDla, addAttribution, verifyTopK, spawnEntropyCard };
```
to:
```ts
  return { addLens, addDla, addAttribution, verifyTopK, spawnEntropyCard, addAttn };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/projects/hooks/useSSEHandlers.ts
git commit -m "feat: add addAttn handler to useSSEHandlers"
```

---

## Task 9: Wire into `page.tsx`

**Files:**
- Modify: `frontend/app/projects/page.tsx`

This task has five sub-changes. Apply them in order.

- [ ] **Step 1: Add imports at the top of `page.tsx`**

After the existing component imports (after `EntropyCard` import), add:

```ts
import AttentionConfigPane from "../components/AttentionConfigPane";
import type { AttentionCardData, AttentionData } from "../components/AttentionCard";
```

- [ ] **Step 2: Add `ATTENTION_CARD_RESOLVED` case to `appReducer`**

After the `SPAWN_ENTROPY_CARD` case in `appReducer`, add:

```ts
    case "ATTENTION_CARD_RESOLVED":
      return {
        ...state,
        lensCards: state.lensCards.map(c =>
          c.id === action.id && c.cardType === "attention-pattern"
            ? { ...c, status: "result" as const, data: action.data } : c
        ),
      };
```

Also update the `CARD_RESOLVED` case guard to exclude `"attention-pattern"` (preventing the generic heatmap resolver from accidentally applying):

Change the existing `CARD_RESOLVED` map condition from:
```ts
      c.id === action.id && c.cardType !== "dla" && c.cardType !== "attribution" && c.cardType !== "activation" && c.cardType !== "steering" && c.cardType !== "entropy"
```
to:
```ts
      c.id === action.id && c.cardType !== "dla" && c.cardType !== "attribution" && c.cardType !== "activation" && c.cardType !== "steering" && c.cardType !== "entropy" && c.cardType !== "attention-pattern"
```

- [ ] **Step 3: Add `"attention-pattern"` case to `loadAndSetProject`**

In `loadAndSetProject`, inside the `result.cards.map(c => { ... })` block, add a case before the final `return { ...c, cardType: "logit-lens" ... }` fallthrough:

```ts
        if (c.cardType === "attention-pattern") {
          return {
            ...c,
            cardType: "attention-pattern" as const,
            status: "result" as const,
            error: null,
            data: (c.data ?? null) as AttentionData | null,
          } as AttentionCardData;
        }
```

- [ ] **Step 4: Add `attentionOpen` state + `handleAddAttn` handler + destructure `addAttn`**

After the `const [steeringOpen, setSteeringOpen] = useState(false);` line, add:

```ts
  const [attentionOpen, setAttentionOpen] = useState(false);
```

After the `handleAddStandaloneSteer` function, add:

```ts
  const handleAddAttn = (args: Parameters<typeof sseHandlers.addAttn>[0]) => {
    setAttentionOpen(false);
    sseHandlers.addAttn(args);
  };
```

The `sseHandlers` destructure at the top of the component does not need updating — the hook's return type is inferred and `sseHandlers.addAttn` is accessible.

- [ ] **Step 5: Update the "Add +" button and outside-click effect to include `attentionOpen`**

**Outside-click effect** — change the condition from:
```ts
    if (!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen) return;
```
to:
```ts
    if (!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen && !attentionOpen) return;
```

Also update the `handleClickOutside` body to close `attentionOpen`:
```ts
        setAttentionOpen(false);
```
(add alongside the other `setXxxOpen(false)` calls)

**"Add +" button `onClick`** — add `setAttentionOpen(false)`:
```ts
onClick={() => { setAddOpen(o => !o); setConfigOpen(false); setDlaOpen(false); setAttributionOpen(false); setSteeringOpen(false); setAttentionOpen(false); }}
```

**"Add +" button active-state background check** — change:
```ts
        background: (addOpen || configOpen || dlaOpen || attributionOpen || steeringOpen) ? "var(--color-accent-hover)" : "var(--color-accent)",
```
to:
```ts
        background: (addOpen || configOpen || dlaOpen || attributionOpen || steeringOpen || attentionOpen) ? "var(--color-accent-hover)" : "var(--color-accent)",
```

**"Add +" button `onMouseEnter`/`onMouseLeave`** — change both checks from `!addOpen && !configOpen && !dlaOpen && !attributionOpen && !steeringOpen` to include `&& !attentionOpen`.

**Each existing dropdown button `onClick`** — add `setAttentionOpen(false)` to the Logit Lens, DLA, Attribution, and Steer button click handlers.

**Dropdown outside-click `useEffect` dependency array** — add `attentionOpen`.

- [ ] **Step 6: Add "Attention" dropdown item and `<AttentionConfigPane>` render**

In the dropdown menu (`{addOpen && ...}`), the current last button is "Steer" with `borderRadius: "0 0 6px 6px"`. Change it to `borderRadius: 0` and add a new last item:

```tsx
                <button
                  onClick={() => { setAddOpen(false); setAttentionOpen(true); setConfigOpen(false); setDlaOpen(false); setAttributionOpen(false); setSteeringOpen(false); }}
                  style={{ background: "var(--color-card)", border: "none", borderRadius: "0 0 6px 6px", padding: "10px 16px", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", color: "var(--color-text)", transition: "background 120ms", display: "flex", flexDirection: "column", gap: 2 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                >
                  <span>Attention</span>
                  <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontWeight: 400 }}>Per-head attention weight matrices</span>
                </button>
```

After the `<SteeringConfigPane ... />` render, add:

```tsx
            <AttentionConfigPane
              isOpen={attentionOpen}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
              onSubmit={handleAddAttn}
              onClose={() => setAttentionOpen(false)}
            />
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/projects/page.tsx
git commit -m "feat: wire attention card into page.tsx reducer, restore, dropdown, and config pane"
```

---

## Task 10: Wire into `SandboxCanvas.tsx`

**Files:**
- Modify: `frontend/app/components/SandboxCanvas.tsx`

- [ ] **Step 1: Add import and update `AnyCard` union**

At the top of `SandboxCanvas.tsx`, after the `EntropyCard` import line, add:

```ts
import AttentionCard, { type AttentionCardData } from "./AttentionCard";
```

Change the `AnyCard` type from:

```ts
export type AnyCard = LensCardData | DlaCardData | AttributionCardData | ActivationCardData | SteeringCardData | EntropyCardData;
```

to:

```ts
export type AnyCard = LensCardData | DlaCardData | AttributionCardData | ActivationCardData | SteeringCardData | EntropyCardData | AttentionCardData;
```

- [ ] **Step 2: Add `"attention-pattern"` case to `renderCard`**

In the `renderCard` switch, add a case after `"entropy"` and before `default`:

```ts
      case "attention-pattern":
        return <AttentionCard key={card.id} {...sharedProps} card={card as AttentionCardData} />;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/thisisnotmyname/webdevplayground/doppo/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Full end-to-end smoke test**

Start the frontend dev server and `modal serve` the backend, then:

1. Open `http://localhost:3000/projects`
2. Click "Add +" — verify "Attention" appears as the last dropdown item with subtitle "Per-head attention weight matrices"
3. Click "Attention" — verify `AttentionConfigPane` opens with "New Attention" header
4. Select GPT-2 Small, use the default prompt, click "Run Attention →"
5. Verify the card appears in loading state with spinner + "Computing attention patterns…" label
6. After response: verify the card shows `n_heads` (12 for GPT-2 Small) attention matrices in a wrapped grid
7. Verify each head has a different hue; cells are light at near-zero attention and saturated at high attention
8. Click "→" to advance to layer 1 — verify the matrices update
9. Click a cell — verify that cell gets a white outline across all heads in the current layer
10. Click the same cell again — verify deselection (outline removed)
11. Hover a cell — verify tooltip shows `H{n}: "{query}" → "{key}" = 0.XXX`
12. For a long prompt (>64 tokens), verify "truncated to 64 tok" badge appears in the sub-header

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/SandboxCanvas.tsx
git commit -m "feat: register AttentionCard in SandboxCanvas AnyCard union and renderCard"
```

---

## Self-Review Findings (applied inline)

1. **`CARD_RESOLVED` exclusion** — added `"attention-pattern"` to the exclusion list in Task 9 step 2 to prevent the generic logit-lens resolver from applying to attention cards.
2. **Outside-click effect** — Task 9 step 5 explicitly lists every location in `page.tsx` that needs `attentionOpen` wired in. No location was missed.
3. **`run_attn` hook name** — `"hook_pattern"` substring filter is correct for TL3; `blocks.{layer}.attn.hook_pattern` contains the substring `"hook_pattern"`.
4. **`putHeatmap`/`getHeatmap`** — confirmed these store/retrieve arbitrary JSON blobs (not heatmap-specific); safe to reuse for attention data.
5. **`SerializedCard`** — confirmed no new fields needed; existing `id`, `cardType`, `modelName`, `prompt`, `data`, `position`, `gpuTier` cover attention cards completely.
