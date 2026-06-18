import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { userCredits } from "@/app/schema";

// Pin the API version so a future `stripe` package bump can't silently shift
// response shapes / webhook payloads under us. Matches stripe@22.x default.
const API_VERSION = "2026-04-22.dahlia";

let _stripe: Stripe | null = null;

/** Singleton Stripe client, or null when payments aren't configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key, { apiVersion: API_VERSION });
  return _stripe;
}

/**
 * Return the user's Stripe Customer id, creating + persisting one on first use.
 * The card saved during verification (and any future off-session charge) lives
 * under this Customer; the idempotency key prevents duplicates on retry.
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string | null
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");

  const [row] = await db
    .select({ c: userCredits.stripeCustomerId })
    .from(userCredits)
    .where(eq(userCredits.userId, userId));
  if (row?.c) return row.c;

  const customer = await stripe.customers.create(
    { email: email ?? undefined, metadata: { userId } },
    { idempotencyKey: `customer_${userId}` }
  );

  await db
    .insert(userCredits)
    .values({ userId, balanceMicros: 0, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: userCredits.userId,
      set: { stripeCustomerId: customer.id },
    });

  return customer.id;
}
