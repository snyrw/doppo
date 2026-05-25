export const runtime = "nodejs";

import Stripe from "stripe";
import { db } from "@/app/db";
import { userCredits, creditLedger } from "@/app/schema";
import { sql } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
    if (session.payment_status !== "paid") return new Response("OK");
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

  return new Response("OK");
}
