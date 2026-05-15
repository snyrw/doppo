import { sql } from "drizzle-orm";
import { db } from "@/app/db";
import { userCallQuota } from "@/app/schema";

// Daily inference call limit per authenticated user (applies to tl_medium and above).
// Generous enough for intensive research sessions; mainly guards against runaway automation.
export const DAILY_CALL_LIMIT = 50;

/**
 * Atomically increments the user's call count for today and returns whether
 * the call is allowed. Cache hits skip this check entirely — only live Modal
 * invocations should call this.
 *
 * Returns { allowed: false } when the user has already consumed their daily budget.
 * The count is still incremented on rejection so retry loops don't circumvent the limit.
 */
export async function checkAndIncrementQuota(
  userId: string
): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const result = await db
    .insert(userCallQuota)
    .values({ userId, date: today, callCount: 1 })
    .onConflictDoUpdate({
      target: [userCallQuota.userId, userCallQuota.date],
      set: { callCount: sql`${userCallQuota.callCount} + 1` },
    })
    .returning({ callCount: userCallQuota.callCount });
  const count = result[0].callCount;
  return { allowed: count <= DAILY_CALL_LIMIT, count };
}
