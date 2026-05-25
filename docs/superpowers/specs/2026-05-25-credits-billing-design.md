# Credits & Billing Design

**Date:** 2026-05-25  
**Status:** Approved, pending implementation  
**Branch:** stripe  

---

## Overview

Replace the existing flat call-count quota system (20 anon / 50 signed-in per day) with a compute-dollar credit system tracking actual RunPod serverless costs. Authenticated users receive $1 of free compute credit per month. Additional credit can be purchased via Stripe in prepaid packs at RunPod cost (no margin — pure cost recovery, with Stripe fees folded in via gross-up pricing).

**Key decisions:**
- No anonymous GPU inference tier. All inference requires authentication. The anon tier is removed entirely to eliminate abuse vectors (VPN cycling, IPv6 /64 prefix cycling, Tor).
- Discovery/onboarding for unauthenticated users will be served by a planned pre-computed on-rails tutorial (separate spec, not yet implemented).
- Credits are stored as microdollars (`bigint`): 1 microdollar = $0.000001; $1.00 = 1,000,000 micros.
- Job duration stored as milliseconds (`integer`).
- Idempotency key for Stripe purchases: `stripe_checkout_session_id` (cs_...) — always present, never null, never reused across sessions.

---

## Section 1: Architecture Overview

### Cost tracking

RunPod serverless returns `executionTime` (milliseconds) in the job completion response (`status: "COMPLETED"`). This is used to compute actual cost post-job.

**Rates (RunPod serverless, per second):**

| Tier | GPU | Rate (micros/sec) | Rate ($/hr) |
|------|-----|-------------------|-------------|
| `tl_small` | L4 (24 GB) | 190 | $0.68 |
| `tl_medium` | L40S (48 GB) | 530 | $1.91 |
| `tl_large` | A100-80GB (80 GB) | 760 | $2.74 |
| `tl_xlarge` | H200 (141 GB) | 1550 | $5.58 |

> Note: These are RunPod serverless rates, not on-demand reserved rates. Rates may change — update `app/lib/rates.ts` if RunPod adjusts pricing.

**Cost formula:**
```
costMicros = ceil(executionTimeMs * tierRateMicrosPerSec / 1000)
```

### Pricing

**Free tier:** $1.00 of compute credit per authenticated user per calendar month, granted lazily on first inference call of the month.

**Stripe credit packs (gross-up pricing — Stripe fee folded in, not charged separately):**

| Pack label | Credit deposited | Charged to card |
|-----------|-----------------|-----------------|
| $2 | $2.00 (2,000,000 micros) | $2.37 |
| $5 | $5.00 (5,000,000 micros) | $5.46 |
| $10 | $10.00 (10,000,000 micros) | $10.61 |
| $25 | $25.00 (25,000,000 micros) | $26.06 |

**Gross-up formula:** `ceil((desired + 0.30) / 0.971 * 100) / 100`  
(Stripe standard rate: 2.9% + $0.30. `0.971 = 1 - 0.029`.)

**Required disclosure on checkout line item description:**
> "Prices include Stripe payment processing fees (2.9% + $0.30) passed through at cost. $X.XX charged; $Y.YY deposited as compute credit."

This is gross-up pricing, not a surcharge — legal in all 50 US states. No Stripe surcharge registration needed. Compliant with FTC junk-fee guidance (SaaS/digital goods are not covered).

### Balance floor (pre-job gate)

Because job duration is unknown before execution, we gate on a static floor per tier derived from warm-job 90th-percentile durations. This is not the expected cost — it is the minimum balance required to start a job.

| Tier | Floor duration | Floor cost |
|------|---------------|-----------|
| `tl_small` | 90s | ~$0.017 |
| `tl_medium` | 150s | ~$0.080 |
| `tl_large` | 200s | ~$0.152 |
| `tl_xlarge` | 300s | ~$0.465 |

```typescript
export const MINIMUM_JOB_COST_MICROS: Record<string, number> = {
  tl_small:  Math.ceil( 90 * TIER_RATES_MICROS_PER_SEC.tl_small),
  tl_medium: Math.ceil(150 * TIER_RATES_MICROS_PER_SEC.tl_medium),
  tl_large:  Math.ceil(200 * TIER_RATES_MICROS_PER_SEC.tl_large),
  tl_xlarge: Math.ceil(300 * TIER_RATES_MICROS_PER_SEC.tl_xlarge),
};
```

---

## Section 2: Data Model

### New tables (`app/schema.ts`)

```typescript
export const userCredits = pgTable("user_credits", {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .primaryKey(),
  balanceMicros: bigint("balance_micros", { mode: "number" }).notNull().default(0),
  lastFreeGrantMonth: text("last_free_grant_month"), // YYYY-MM, nullable
});

export const creditLedger = pgTable("credit_ledger", {
  id: text("id").notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "free_grant" | "purchase" | "usage"
  amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
  jobTier: text("job_tier"),              // set for "usage" rows
  jobDurationMs: integer("job_duration_ms"), // set for "usage" rows
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(), // set for "purchase" rows; UNIQUE enforces idempotency
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### New file: `app/lib/rates.ts`

```typescript
export const TIER_RATES_MICROS_PER_SEC: Record<string, number> = {
  tl_small:  190,
  tl_medium: 530,
  tl_large:  760,
  tl_xlarge: 1550,
};

export const FREE_MONTHLY_GRANT_MICROS = 1_000_000; // $1.00

export const CREDIT_PACKS = [
  { label: "$2",  creditMicros:  2_000_000, chargeCents:  237 },
  { label: "$5",  creditMicros:  5_000_000, chargeCents:  546 },
  { label: "$10", creditMicros: 10_000_000, chargeCents: 1061 },
  { label: "$25", creditMicros: 25_000_000, chargeCents: 2606 },
] as const;
```

### Migration notes

Use the `.mjs` workaround (see `.claude/rules/database.md`) — `drizzle-kit migrate/push` hangs in non-TTY. Run two `CREATE TABLE` statements directly via `neon.query(...)`.

---

## Section 3: Credit Lifecycle

### New file: `app/lib/credits.ts`

```typescript
import { db } from "@/db";
import { userCredits, creditLedger } from "@/schema";
import { eq, sql } from "drizzle-orm";
import { TIER_RATES_MICROS_PER_SEC, FREE_MONTHLY_GRANT_MICROS } from "./rates";

export const MINIMUM_JOB_COST_MICROS: Record<string, number> = {
  tl_small:  Math.ceil( 90 * TIER_RATES_MICROS_PER_SEC.tl_small),
  tl_medium: Math.ceil(150 * TIER_RATES_MICROS_PER_SEC.tl_medium),
  tl_large:  Math.ceil(200 * TIER_RATES_MICROS_PER_SEC.tl_large),
  tl_xlarge: Math.ceil(300 * TIER_RATES_MICROS_PER_SEC.tl_xlarge),
};

export async function ensureGrantAndGetBalance(userId: string): Promise<number> {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Create row if first ever inference
  await db.insert(userCredits).values({ userId, balanceMicros: 0 }).onConflictDoNothing();

  // Atomic grant: Postgres row lock prevents double grants
  const granted = await db.execute(sql`
    UPDATE user_credits
    SET balance_micros = balance_micros + ${FREE_MONTHLY_GRANT_MICROS},
        last_free_grant_month = ${currentMonth}
    WHERE user_id = ${userId}
      AND (last_free_grant_month IS NULL OR last_free_grant_month != ${currentMonth})
    RETURNING balance_micros
  `);

  if (granted.rows.length > 0) {
    await db.insert(creditLedger).values({
      userId,
      type: "free_grant",
      amountMicros: FREE_MONTHLY_GRANT_MICROS,
    });
    return Number(granted.rows[0].balance_micros);
  }

  const [row] = await db
    .select({ b: userCredits.balanceMicros })
    .from(userCredits)
    .where(eq(userCredits.userId, userId));
  return row.b;
}

export async function checkBalance(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; balanceMicros: number }> {
  const balanceMicros = await ensureGrantAndGetBalance(userId);
  const floor = MINIMUM_JOB_COST_MICROS[tier] ?? 0;
  return { allowed: balanceMicros >= floor, balanceMicros };
}

export async function deductJobCost(
  userId: string,
  tier: string,
  executionTimeMs: number
): Promise<number> {
  const costMicros = Math.ceil(
    (executionTimeMs * TIER_RATES_MICROS_PER_SEC[tier]) / 1000
  );
  await db.transaction(async (tx) => {
    await tx
      .update(userCredits)
      .set({ balanceMicros: sql`${userCredits.balanceMicros} - ${costMicros}` })
      .where(eq(userCredits.userId, userId));
    await tx.insert(creditLedger).values({
      userId,
      type: "usage",
      amountMicros: -costMicros,
      jobTier: tier,
      jobDurationMs: executionTimeMs,
    });
  });
  return costMicros;
}
```

### Route integration pattern

Each inference route (`run-lens`, `run-dla`, `run-attribution`, `run-activation-patch`, `run-steering`) must:

1. Authenticate — `auth.api.getSession(...)`, 401 if no session.
2. Gate — `checkBalance(userId, tier)`, 402 if not allowed.
3. Run job — `fetchUpstream(...)` now returns `{ executionTimeMs?: number }`.
4. Deduct — `deductJobCost(userId, tier, executionTimeMs)`.
5. Return cost to client — embed `cost_micros` in the `done` SSE event payload (not as a separate event after "done" — SSE clients stop processing after "done").

`fetchUpstream` in `app/lib/api-helpers.ts` must capture `executionTime` from RunPod's final poll response (`status === "COMPLETED"`) and return it.

### Removing old quota files

- `app/lib/quota.ts` — delete (authenticated flat quota).
- `app/lib/ip-quota.ts` — delete (anonymous IP quota, no longer needed).

---

## Section 4: Stripe Top-Up Flow

### New file: `app/api/credits/checkout/route.ts`

```typescript
import Stripe from "stripe";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { CREDIT_PACKS } from "@/lib/rates";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { packLabel } = await req.json();
  const pack = CREDIT_PACKS.find((p) => p.label === packLabel);
  if (!pack) return new Response("Invalid pack", { status: 400 });

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"], // card-only — avoids async payment complexity
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.chargeCents,
          product_data: {
            name: `${pack.label} compute credit`,
            description:
              "Prices include Stripe payment processing fees (2.9% + $0.30) passed through at cost.",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: session.user.id,
    customer_email: session.user.email ?? undefined,
    metadata: {
      userId: session.user.id,
      creditMicros: String(pack.creditMicros),
      packLabel: pack.label,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects?credits=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects`,
  });

  return Response.json({ url: checkout.url });
}
```

### New file: `app/api/stripe/webhook/route.ts`

```typescript
export const runtime = "nodejs"; // Edge Runtime has raw-body encoding issues with Stripe sig verification

import Stripe from "stripe";
import { db } from "@/db";
import { userCredits, creditLedger } from "@/schema";
import { sql } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function creditUser(
  sessionId: string,
  userId: string,
  creditMicros: number,
  tx: typeof db
) {
  // ON CONFLICT DO NOTHING on stripeCheckoutSessionId UNIQUE — idempotent replay-safe
  const inserted = await tx
    .insert(creditLedger)
    .values({
      userId,
      type: "purchase",
      amountMicros: creditMicros,
      stripeCheckoutSessionId: sessionId,
    })
    .onConflictDoNothing()
    .returning({ id: creditLedger.id });

  if (inserted.length === 0) return; // duplicate webhook delivery — skip

  await tx
    .insert(userCredits)
    .values({ userId, balanceMicros: creditMicros })
    .onConflictDoUpdate({
      target: userCredits.userId,
      set: { balanceMicros: sql`${userCredits.balanceMicros} + ${creditMicros}` },
    });
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return new Response("OK"); // pending async payment — wait for async_payment_succeeded
    await db.transaction((tx) =>
      creditUser(
        session.id,
        session.metadata!.userId,
        Number(session.metadata!.creditMicros),
        tx
      )
    );
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await db.transaction((tx) =>
      creditUser(
        session.id,
        session.metadata!.userId,
        Number(session.metadata!.creditMicros),
        tx
      )
    );
  }

  // checkout.session.async_payment_failed: card declined after pending.
  // No credit granted. Future: email notification to user.

  return new Response("OK");
}
```

### Balance query endpoint: `app/api/credits/balance/route.ts`

```typescript
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { userCredits } from "@/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ balanceMicros: null });

  const [row] = await db
    .select({ b: userCredits.balanceMicros })
    .from(userCredits)
    .where(eq(userCredits.userId, session.user.id));

  return Response.json({ balanceMicros: row?.b ?? 0 });
}
```

Note: No `export const dynamic = "force-dynamic"` needed — Next.js App Router does not cache route handlers by default (Next.js 15+).

### Middleware fix: `middleware.ts`

BetterAuth's middleware must not intercept the Stripe webhook (it checks for auth headers, which Stripe doesn't send):

```typescript
export const config = {
  matcher: ["/((?!api/stripe/webhook).*)"],
};
```

### Stripe dashboard setup

Register webhook endpoint: `https://yourdomain.com/api/stripe/webhook`

Subscribe to events:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Required env vars:
- `STRIPE_SECRET_KEY` — `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` (from dashboard after registering endpoint)
- `NEXT_PUBLIC_APP_URL` — full origin (e.g. `https://doppo.ai`)

---

## Section 5: UI Changes

### Balance display: `app/components/CreditsDisplay.tsx`

New client component mounted in the navbar. Key patterns:

**`useCreditsBalance` hook:**
- Fetch `/api/credits/balance` on mount.
- Expose `refresh()` callable.
- Listen for `window.dispatchEvent(new CustomEvent("credits-updated"))` — allows cross-component refresh (post-deduction from route handlers).

**`CreditsDisplay` component:**
- Reads `?credits=success` query param via `useSearchParams()` to trigger refresh after Stripe redirect; then calls `router.replace(pathname)` to strip the param.
- Color thresholds: < $0.05 = orange text; $0.00 = red with "Add credits" link.
- Must be wrapped in `<Suspense fallback={null}>` at call site — `useSearchParams` requires Suspense in App Router.

```tsx
// At call site (e.g. Navbar):
<Suspense fallback={null}>
  <CreditsDisplay />
</Suspense>
```

### Purchase modal: `app/components/BuyCreditsModal.tsx`

Client component with pack selector and Stripe Checkout redirect. Key implementation notes:

```tsx
async function handlePack(pack: typeof CREDIT_PACKS[number]) {
  setLoading(pack.label);
  setError(null);
  try {
    const res = await fetch("/api/credits/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packLabel: pack.label }),
    });
    const { url, error } = await res.json();
    if (!res.ok || !url) {
      setLoading(null);
      setError(error ?? "Checkout failed");
      return;
    }
    // Save canvas state before leaving the page
    await updateProject(projectId, serializeState(state));
    window.location.href = url;
  } catch (e) {
    setLoading(null);
    setError("Network error — please try again.");
  }
}
```

Display on each pack option: "charged to card" vs "deposited as credit" (separate lines).

### Cost annotation in result cards

After a job completes, the `done` SSE event payload includes `cost_micros` (embedded in the `done` payload — **not** sent as a separate `stage: "cost"` event after "done", which would be silently dropped by SSE clients).

Backend shape:
```python
yield f"data: {json.dumps({'stage': 'done', 'data': result_payload, 'cost_micros': cost_micros})}\n\n"
```

Frontend: dispatch `"credits-updated"` custom event after receiving `done` so `CreditsDisplay` refreshes without a full page reload.

### 402 handling (insufficient balance)

When an inference route returns 402:

1. Set card to error state with `showBuyCredits: true`.
2. Render error card with "Add credits" button that opens `BuyCreditsModal`.
3. Action union must include `showBuyCredits` flag:

```typescript
// In projects/types.ts (or wherever the reducer action union lives)
{ type: "CARD_ERRORED"; id: string; error: string; showBuyCredits?: boolean }
```

Use `"CARD_ERRORED"` — not `"CARD_ERROR"` (verify against the actual reducer).

### Cold start UX

Add a loading state annotation for `tl_large` / `tl_xlarge` jobs: display estimated cold-start time (e.g. "Large models may take 2–5 min on first load"). This is informational only — not a gate.

---

## Section 6: Removed / Deprecated

| Item | Action |
|------|--------|
| `app/lib/quota.ts` | Delete — flat authenticated quota |
| `app/lib/ip-quota.ts` | Delete — anonymous IP quota |
| Anonymous GPU inference | Removed entirely — no anon `tl_small` |
| `20 calls/day anon` + `50 calls/day signed-in` limits | Replaced by credit system |

---

## Planned Follow-On: On-Rails Tutorial

A pre-computed, scripted walkthrough of all six analysis tools (logit lens → DLA → attribution → activation patch → steering → attention) on a fixed model/prompt, served as static data (no GPU). This replaces anonymous GPU inference as the discovery/onboarding path for unauthenticated users. Spec TBD — out of scope for this implementation.

---

## Implementation Checklist

- [ ] DB migration: create `user_credits`, `credit_ledger` tables
- [ ] Create `app/lib/rates.ts`
- [ ] Create `app/lib/credits.ts`
- [ ] Update `app/lib/api-helpers.ts` — `fetchUpstream` returns `executionTimeMs`
- [ ] Update all five inference routes — auth gate, balance gate, deduction, cost in `done` payload
- [ ] Create `app/api/credits/checkout/route.ts`
- [ ] Create `app/api/stripe/webhook/route.ts`
- [ ] Create `app/api/credits/balance/route.ts`
- [ ] Fix `middleware.ts` — exclude webhook from BetterAuth matcher
- [ ] Create `app/components/CreditsDisplay.tsx`
- [ ] Create `app/components/BuyCreditsModal.tsx`
- [ ] Extend `CARD_ERRORED` action union with `showBuyCredits`
- [ ] Wire 402 → `BuyCreditsModal` in error card renderer
- [ ] Delete `app/lib/quota.ts` and `app/lib/ip-quota.ts`
- [ ] Set Stripe env vars and register webhook in dashboard
- [ ] Smoke test: free grant fires once per month, not twice
- [ ] Smoke test: duplicate webhook delivery doesn't double-credit
