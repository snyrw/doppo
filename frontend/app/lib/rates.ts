// Modal's exact list prices (https://modal.com/pricing, June 2026). Billing is
// a straight pass-through of our Modal cost — no margin. Re-check these if
// Modal reprices. GPU is billed on wall time; CPU and memory are billed on
// usage metered by the backend (cpu_core_s / mem_gib_s in the job result).
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

export const LOW_BALANCE_THRESHOLD_MICROS = 50_000; // $0.05

export const CREDIT_PACKS = [
  { label: "$2",  creditMicros:  2_000_000, chargeCents:  237 },
  { label: "$5",  creditMicros:  5_000_000, chargeCents:  546 },
  { label: "$10", creditMicros: 10_000_000, chargeCents: 1061 },
  { label: "$25", creditMicros: 25_000_000, chargeCents: 2606 },
] as const;
