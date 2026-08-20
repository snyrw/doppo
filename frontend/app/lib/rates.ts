import { TIER_LABELS } from "./tiers";

// Modal's list prices (https://modal.com/pricing, June 2026). Billing is
// just Modal costs, though these should be checked if
// they price-change or something.
export const TIER_RATES_MICROS_PER_SEC: Record<string, number> = {
  tl_small:   222,   // L4
  tl_medium:  542,   // L40S
  tl_large:   694,   // A100-80GB
  tl_xlarge:  1261,  // H200
  tl_xxlarge: 1736,  // B200
};

export const CPU_RATE_MICROS_PER_CORE_SEC = 13.1;
export const MEM_RATE_MICROS_PER_GIB_SEC = 2.22;

export const FREE_MONTHLY_GRANT_MICROS = 1_000_000; // $1.00

// Floor cost of the cheapest plausible job on each tier.
export const MINIMUM_JOB_COST_MICROS: Record<string, number> = {
  tl_small:   Math.ceil( 90 * TIER_RATES_MICROS_PER_SEC.tl_small),
  tl_medium:  Math.ceil(150 * TIER_RATES_MICROS_PER_SEC.tl_medium),
  tl_large:   Math.ceil(200 * TIER_RATES_MICROS_PER_SEC.tl_large),
  tl_xlarge:  Math.ceil(300 * TIER_RATES_MICROS_PER_SEC.tl_xlarge),
  tl_xxlarge: Math.ceil(400 * TIER_RATES_MICROS_PER_SEC.tl_xxlarge),
};

export const LOW_BALANCE_THRESHOLD_MICROS = 50_000; // $0.05

// Real per-card cost from my own (snyrw) completed jobs (credit_ledger, type='usage', queried
// 2026-08-17).
export const TYPICAL_CARD_COST_MICROS: Record<string, number> = {
  tl_small:   3_443,
  tl_medium:  8_602,
  tl_large:   34_946,
  tl_xlarge:  94_766,
  tl_xxlarge: 198_971,
};
export const TYPICAL_STEERING_COST_MICROS: Record<string, number> = {
  tl_small:   14_642,
  tl_medium:  55_314,
  tl_large:   97_196,
  tl_xlarge:  132_024,
  tl_xxlarge: 300_450,
};

export const CREDIT_PACKS = [
  { label: "$2",  creditMicros:  2_000_000, chargeCents:  237 },
  { label: "$5",  creditMicros:  5_000_000, chargeCents:  546 },
  { label: "$10", creditMicros: 10_000_000, chargeCents: 1061 },
  { label: "$25", creditMicros: 25_000_000, chargeCents: 2606 },
] as const;

/** "L40S · 3.3¢/min" from a resolved GPU tier. Null until a tier is known. */
export function formatTierRate(tier: string | undefined): string | null {
  if (!tier) return null;
  const microsPerSec = TIER_RATES_MICROS_PER_SEC[tier];
  if (microsPerSec === undefined) return null;
  const centsPerMin = (microsPerSec * 60) / 10_000;
  return `${TIER_LABELS[tier] ?? tier} · ${centsPerMin.toFixed(1)}¢/min`;
}
