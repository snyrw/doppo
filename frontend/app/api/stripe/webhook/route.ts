export const runtime = "nodejs";

import Stripe from "stripe";
import { db } from "@/app/db";
import { userCredits, creditLedger } from "@/app/schema";
import { sql } from "drizzle-orm";

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

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Payments not yet configured", { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return new Response("Bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return new Response("OK");
    const userId = session.metadata?.userId;
    const creditMicrosRaw = session.metadata?.creditMicros;
    if (!userId || !creditMicrosRaw || !Number.isFinite(Number(creditMicrosRaw))) {
      return new Response("Invalid metadata", { status: 400 });
    }
    const creditMicros = Number(creditMicrosRaw);
    await db.transaction((tx) =>
      creditUser(session.id, userId, creditMicros, tx)
    );
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const creditMicrosRaw = session.metadata?.creditMicros;
    if (!userId || !creditMicrosRaw || !Number.isFinite(Number(creditMicrosRaw))) {
      return new Response("Invalid metadata", { status: 400 });
    }
    const creditMicros = Number(creditMicrosRaw);
    await db.transaction((tx) =>
      creditUser(session.id, userId, creditMicros, tx)
    );
  }

  return new Response("OK");
}
