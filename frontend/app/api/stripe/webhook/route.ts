export const runtime = "nodejs";

import Stripe from "stripe";
import { db } from "@/app/db";
import { userCredits, creditLedger } from "@/app/schema";
import { sql } from "drizzle-orm";
import { getStripe } from "@/app/lib/stripe";
import { markPaymentVerified } from "@/app/lib/credits";

async function creditUser(
  sessionId: string,
  userId: string,
  creditMicros: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
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

  if (inserted.length === 0) return;

  await tx
    .insert(userCredits)
    .values({ userId, balanceMicros: creditMicros })
    .onConflictDoUpdate({
      target: userCredits.userId,
      set: { balanceMicros: sql`${userCredits.balanceMicros} + ${creditMicros}` },
    });
}

/** Credit a paid purchase session and mark the buyer's card verified. */
async function handlePurchase(session: Stripe.Checkout.Session): Promise<Response> {
  const userId = session.metadata?.userId;
  const creditMicrosRaw = session.metadata?.creditMicros;
  if (!userId || !creditMicrosRaw || !Number.isFinite(Number(creditMicrosRaw))) {
    return new Response("Invalid metadata", { status: 400 });
  }
  const creditMicros = Number(creditMicrosRaw);
  await db.transaction((tx) => creditUser(session.id, userId, creditMicros, tx));
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
