export const TIER_RATES_MICROS_PER_SEC: Record<string, number> = {
  tl_small:   190,
  tl_medium:  530,
  tl_large:   760,
  tl_xlarge:  1550,
  tl_xxlarge: 1736,
};

export const FREE_MONTHLY_GRANT_MICROS = 1_000_000; // $1.00

export const LOW_BALANCE_THRESHOLD_MICROS = 50_000; // $0.05

export const CREDIT_PACKS = [
  { label: "$2",  creditMicros:  2_000_000, chargeCents:  237 },
  { label: "$5",  creditMicros:  5_000_000, chargeCents:  546 },
  { label: "$10", creditMicros: 10_000_000, chargeCents: 1061 },
  { label: "$25", creditMicros: 25_000_000, chargeCents: 2606 },
] as const;
