import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/app/db";
import { anonIpQuota } from "@/app/schema";

export const DAILY_ANON_CALL_LIMIT = 20;

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex");
}

/**
 * Atomically increments the IP's call count for today and returns whether
 * the call is allowed. Cache hits skip this check entirely — only live Modal
 * invocations should call this.
 *
 * Returns { allowed: false } when the IP has already consumed their daily budget.
 * The count is still incremented on rejection so retry loops don't circumvent the limit.
 */
export async function checkAndIncrementAnonQuota(
  ipHash: string
): Promise<{ allowed: boolean; count: number }> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const result = await db
    .insert(anonIpQuota)
    .values({ ipHash, date: today, callCount: 1 })
    .onConflictDoUpdate({
      target: [anonIpQuota.ipHash, anonIpQuota.date],
      set: { callCount: sql`${anonIpQuota.callCount} + 1` },
    })
    .returning({ callCount: anonIpQuota.callCount });
  const count = result[0].callCount;
  return { allowed: count <= DAILY_ANON_CALL_LIMIT, count };
}
