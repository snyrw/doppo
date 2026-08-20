import { useEffect, useState } from "react";

/**
 * Current usage balance in micros. Refetches on the global "credits-updated"
 * event (fired wherever a job settles) so every consumer stays in sync
 * without polling.
 */
export function useUsageBalance() {
  const [balanceMicros, setBalanceMicros] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch("/api/credits/balance")
        .then(res => res.json())
        .then(({ balanceMicros: b }) => {
          if (!cancelled && b !== null) setBalanceMicros(b);
        })
        .catch(() => {});
    };
    refresh();
    window.addEventListener("credits-updated", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("credits-updated", refresh);
    };
  }, []);

  return { balanceMicros };
}
