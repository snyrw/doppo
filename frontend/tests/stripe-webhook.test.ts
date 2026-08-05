import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// constructEvent is swapped per-test: return an event to simulate a verified
// webhook, throw to simulate a bad signature.
const constructEvent = vi.fn();
let stripeAvailable = true;
vi.mock("../app/lib/stripe", () => ({
  getStripe: () => (stripeAvailable ? { webhooks: { constructEvent } } : null),
}));

const markPaymentVerified = vi.fn().mockResolvedValue(undefined);
vi.mock("../app/lib/credits", () => ({
  markPaymentVerified: (...a: unknown[]) => markPaymentVerified(...a),
}));

// creditUser runs as a single db.execute(sql`…`). Drizzle keeps raw bound
// values as plain entries in queryChunks (StringChunk objects are the literal
// SQL text), so filtering StringChunks out yields the bound params.
const executed: { queryChunks: unknown[] }[] = [];
vi.mock("../app/db", () => ({
  db: {
    execute: (q: { queryChunks: unknown[] }) => {
      executed.push(q);
      return Promise.resolve({ rows: [] });
    },
  },
}));

function boundParams(q: { queryChunks: unknown[] }): unknown[] {
  return q.queryChunks.filter(
    (c) => !(typeof c === "object" && c !== null && c.constructor?.name === "StringChunk")
  );
}

import { POST } from "../app/api/stripe/webhook/route";

function webhookRequest(body = "{}"): Request {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}

function checkoutEvent(
  type: string,
  session: Partial<Stripe.Checkout.Session>
): Stripe.Event {
  return { type, data: { object: { id: "cs_test_1", ...session } } } as unknown as Stripe.Event;
}

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  stripeAvailable = true;
  constructEvent.mockReset();
  markPaymentVerified.mockClear();
  executed.length = 0;
});

describe("stripe webhook", () => {
  it("returns 503 when Stripe is not configured", async () => {
    stripeAvailable = false;
    const res = await POST(webhookRequest());
    expect(res.status).toBe(503);
  });

  it("returns 503 when the webhook secret is missing", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await POST(webhookRequest());
    expect(res.status).toBe(503);
  });

  it("rejects a bad signature with 400 and credits nothing", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(webhookRequest());
    expect(res.status).toBe(400);
    expect(executed).toHaveLength(0);
  });

  it("verifies the signature against the raw body", async () => {
    constructEvent.mockReturnValue({ type: "unrelated.event", data: { object: {} } });
    await POST(webhookRequest('{"raw":true}'));
    expect(constructEvent).toHaveBeenCalledWith('{"raw":true}', "sig_test", "whsec_test");
  });

  it("credits a paid checkout session and marks the card verified", async () => {
    constructEvent.mockReturnValue(
      checkoutEvent("checkout.session.completed", {
        mode: "payment",
        payment_status: "paid",
        metadata: { userId: "user_1", creditMicros: "5000000" },
      })
    );
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(executed).toHaveLength(1);
    const params = boundParams(executed[0]);
    expect(params).toContain("user_1");
    expect(params).toContain(5_000_000);
    expect(params).toContain("cs_test_1"); // session id — the idempotency key
    expect(markPaymentVerified).toHaveBeenCalledWith("user_1");
  });

  it("does not credit an unpaid session (async payment still pending)", async () => {
    constructEvent.mockReturnValue(
      checkoutEvent("checkout.session.completed", {
        mode: "payment",
        payment_status: "unpaid",
        metadata: { userId: "user_1", creditMicros: "5000000" },
      })
    );
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(executed).toHaveLength(0);
    expect(markPaymentVerified).not.toHaveBeenCalled();
  });

  it("credits when the async payment later succeeds", async () => {
    constructEvent.mockReturnValue(
      checkoutEvent("checkout.session.async_payment_succeeded", {
        metadata: { userId: "user_1", creditMicros: "2000000" },
      })
    );
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(boundParams(executed[0])).toContain(2_000_000);
  });

  it("rejects a paid session with missing or non-numeric metadata", async () => {
    for (const metadata of [
      {},
      { userId: "user_1" },
      { userId: "user_1", creditMicros: "not-a-number" },
    ]) {
      constructEvent.mockReturnValue(
        checkoutEvent("checkout.session.completed", {
          mode: "payment",
          payment_status: "paid",
          metadata: metadata as Stripe.Metadata,
        })
      );
      const res = await POST(webhookRequest());
      expect(res.status).toBe(400);
    }
    expect(executed).toHaveLength(0);
  });

  it("marks the card verified without crediting on a setup-mode session", async () => {
    constructEvent.mockReturnValue(
      checkoutEvent("checkout.session.completed", {
        mode: "setup",
        metadata: { userId: "user_1" },
      })
    );
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(markPaymentVerified).toHaveBeenCalledWith("user_1");
    expect(executed).toHaveLength(0);
  });

  it("acks unrelated event types without side effects", async () => {
    constructEvent.mockReturnValue({ type: "invoice.paid", data: { object: {} } });
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(executed).toHaveLength(0);
    expect(markPaymentVerified).not.toHaveBeenCalled();
  });
});
