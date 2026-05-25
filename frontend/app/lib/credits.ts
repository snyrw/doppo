import { db } from "@/app/db";
import { userCredits, creditLedger } from "@/app/schema";
import { eq, sql } from "drizzle-orm";
import { TIER_RATES_MICROS_PER_SEC, FREE_MONTHLY_GRANT_MICROS } from "./rates";

export const MINIMUM_JOB_COST_MICROS: Record<string, number> = {
  tl_small:  Math.ceil( 90 * TIER_RATES_MICROS_PER_SEC.tl_small),
  tl_medium: Math.ceil(150 * TIER_RATES_MICROS_PER_SEC.tl_medium),
  tl_large:  Math.ceil(200 * TIER_RATES_MICROS_PER_SEC.tl_large),
  tl_xlarge: Math.ceil(300 * TIER_RATES_MICROS_PER_SEC.tl_xlarge),
};

export async function ensureGrantAndGetBalance(userId: string): Promise<number> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  await db.insert(userCredits).values({ userId, balanceMicros: 0 }).onConflictDoNothing();

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
  return row?.b ?? 0;
}

export async function checkBalance(
  userId: string,
  tier: string
): Promise<{ allowed: boolean; balanceMicros: number }> {
  const balanceMicros = await ensureGrantAndGetBalance(userId);
  const floor = MINIMUM_JOB_COST_MICROS[tier];
  if (floor === undefined) throw new Error(`Unknown GPU tier: ${tier}`);
  return { allowed: balanceMicros >= floor, balanceMicros };
}

export async function deductJobCost(
  userId: string,
  tier: string,
  executionTimeMs: number
): Promise<number> {
  const rate = TIER_RATES_MICROS_PER_SEC[tier];
  if (rate === undefined) throw new Error(`Unknown GPU tier: ${tier}`);
  const costMicros = Math.ceil((executionTimeMs * rate) / 1000);
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
