"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { LOW_BALANCE_THRESHOLD_MICROS } from "@/app/lib/rates";

function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function useCreditsBalance() {
  const [balanceMicros, setBalanceMicros] = useState<number | null>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/credits/balance");
      const { balanceMicros: b } = await res.json();
      if (b !== null) setBalanceMicros(b);
    } catch {}
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener("credits-updated", handler);
    return () => window.removeEventListener("credits-updated", handler);
  }, []);

  return { balanceMicros, refresh };
}

function CreditsDisplayInner({ onAddCredits }: { onAddCredits?: () => void }) {
  const { balanceMicros, refresh } = useCreditsBalance();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("credits") === "success") {
      refresh();
      router.replace(pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (balanceMicros === null) return null;

  const isLow = balanceMicros < LOW_BALANCE_THRESHOLD_MICROS;
  const isEmpty = balanceMicros === 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontFamily: "var(--font-ibm-plex-mono), monospace",
        color: isEmpty ? "#dc2626" : isLow ? "#ea580c" : "var(--color-text-muted)",
      }}
    >
      <span>{formatMicros(balanceMicros)}</span>
      {isEmpty && onAddCredits && (
        <button
          onClick={onAddCredits}
          style={{
            fontSize: 10,
            color: "#dc2626",
            background: "none",
            border: "1px solid #dc2626",
            borderRadius: 4,
            padding: "2px 6px",
            cursor: "pointer",
          }}
        >
          Add credits
        </button>
      )}
    </div>
  );
}

export function CreditsDisplay({ onAddCredits }: { onAddCredits?: () => void }) {
  return (
    <Suspense fallback={null}>
      <CreditsDisplayInner onAddCredits={onAddCredits} />
    </Suspense>
  );
}
