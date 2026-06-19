import { eq } from "drizzle-orm";
import { db } from "@/app/db";
import { getStripe } from "@/app/lib/stripe";
import { deleteHeatmaps } from "@/app/lib/r2";
import {
  userCredits, activeJobs,
  heatmapCache, dlaCache, attributionCache, steeringCache, activationPatchCache, attnCache,
} from "@/app/schema";

const CACHE_TABLES = [heatmapCache, dlaCache, attributionCache, steeringCache, activationPatchCache, attnCache];

/**
 * Full teardown of a user's data ahead of BetterAuth's row cascade.
 * Order: Stripe customer → per cache table (R2 objects then rows) → active jobs.
 * Stripe failures are logged but non-fatal so a Stripe hiccup can't strand deletion.
 */
export async function deleteUserData(userId: string): Promise<void> {
  const stripe = getStripe();
  if (stripe) {
    const [row] = await db.select({ c: userCredits.stripeCustomerId }).from(userCredits).where(eq(userCredits.userId, userId));
    if (row?.c) {
      try { await stripe.customers.del(row.c); }
      catch (e) { console.error("stripe customer delete failed", e); }
    }
  }

  for (const table of CACHE_TABLES) {
    const rows = await db.select({ id: table.id }).from(table).where(eq(table.userId, userId));
    const keys = rows.map((r) => r.id);
    if (keys.length) await deleteHeatmaps(keys);
    await db.delete(table).where(eq(table.userId, userId));
  }

  await db.delete(activeJobs).where(eq(activeJobs.userId, userId));
}
