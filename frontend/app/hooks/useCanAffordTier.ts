import { MINIMUM_JOB_COST_MICROS } from "@/app/lib/rates";
import { useUsageBalance } from "./useUsageBalance";

/**
 * Whether the current balance covers the floor cost of `tier`. Advisory only
 * — spawn-route.ts's checkBalance() is the real gate; this just lets a
 * config pane gray out Run before the user tries. Optimistic (true) while
 * balance is still loading or no tier is known yet, so Run isn't disabled by
 * a flash of missing data.
 */
export function useCanAffordTier(tier: string | undefined): { affordable: boolean; balanceMicros: number | null } {
  const { balanceMicros } = useUsageBalance();
  if (!tier || balanceMicros === null) return { affordable: true, balanceMicros };
  const floor = MINIMUM_JOB_COST_MICROS[tier];
  if (floor === undefined) return { affordable: true, balanceMicros };
  return { affordable: balanceMicros >= floor, balanceMicros };
}
