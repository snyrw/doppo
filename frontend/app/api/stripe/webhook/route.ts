export const runtime = "nodejs";

import Stripe from "stripe";
import { db } from "@/app/db";
import { sql } from "drizzle-orm";
import { getStripe } from "@/app/lib/stripe";
import { markPaymentVerified } from "@/app/lib/credits";

// neon-http has no interactive transactions, so ledger insert + balance upsert
// run as one atomic statement: the CTE inserts the ledger row (no-op on a
// replayed session id), and the balance is only bumped when that insert landed.
async function creditUser(sessionId: string, userId: string, creditMicros: number) {
  await db.execute(sql`
    with ins as (
      insert into credit_ledger (id, user_id, type, amount_micros, stripe_checkout_session_id)
      values (${crypto.randomUUID()}, ${userId}, 'purchase', ${creditMicros}, ${sessionId})
      on conflict (stripe_checkout_session_id) do nothing
      returning id
    )
    insert into user_credits (user_id, balance_micros)
    select ${userId}, ${creditMicros} from ins
    on conflict (user_id) do update
      set balance_micros = user_credits.balance_micros + excluded.balance_micros
  `);
}

/** Credit a paid purchase session and mark the buyer's card verified. */
async function handlePurchase(session: Stripe.Checkout.Session): Promise<Response> {
  const userId = session.metadata?.userId;
  const creditMicrosRaw = session.metadata?.creditMicros;
  if (!userId || !creditMicrosRaw || !Number.isFinite(Number(creditMicrosRaw))) {
    return new Response("Invalid metadata", { status: 400 });
  }
  const creditMicros = Number(creditMicrosRaw);
  await creditUser(session.id, userId, creditMicros);
  // Buyers have a real card on file → they satisfy the gate too (short-circuit).
  await markPaymentVerified(userId);
  return new Response("OK");
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Payments not yet configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Setup-mode session: a card was saved, no payment. Mark verified.
    if (session.mode === "setup") {
      const userId = session.metadata?.userId;
      if (!userId) return new Response("Invalid metadata", { status: 400 });
      await markPaymentVerified(userId);
      return new Response("OK");
    }

    // Payment-mode session: only act once actually paid.
    if (session.payment_status !== "paid") return new Response("OK");
    return handlePurchase(session);
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    return handlePurchase(event.data.object as Stripe.Checkout.Session);
  }

  return new Response("OK");
}
