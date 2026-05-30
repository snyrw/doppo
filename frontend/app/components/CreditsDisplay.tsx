"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { BuyCreditsModal } from "./BuyCreditsModal";
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

function CreditsButtonInner() {
  const { balanceMicros, refresh } = useCreditsBalance();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchParams.get("credits") === "success") {
      refresh();
      router.replace(pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isLow = balanceMicros !== null && balanceMicros < LOW_BALANCE_THRESHOLD_MICROS;
  const isEmpty = balanceMicros === 0;
  const accentColor = isEmpty ? "#dc2626" : isLow ? "#ea580c" : "var(--color-text-muted)";

  return (
    <>
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Credits"
        title="Credits"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `1.5px solid ${balanceMicros !== null ? accentColor : "var(--color-surface-border)"}`,
          background: "none",
          color: balanceMicros !== null ? accentColor : "var(--color-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "var(--font-ibm-plex-sans), sans-serif",
          transition: "border-color 120ms ease, color 120ms ease, background 120ms ease",
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-panel)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "none";
        }}
      >
        $
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            background: "var(--color-card)",
            border: "1px solid var(--color-card-border)",
            borderRadius: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            width: 220,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "8px 12px 7px",
              borderBottom: "1px solid var(--color-surface-border)",
              fontSize: 9,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            }}
          >
            Credits
          </div>

          {balanceMicros !== null && (
            <div
              style={{
                padding: "10px 12px 8px",
                borderBottom: "1px solid var(--color-surface-border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                }}
              >
                Balance
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                  color: isEmpty ? "#dc2626" : isLow ? "#ea580c" : "var(--color-text)",
                }}
              >
                {formatMicros(balanceMicros)}
              </span>
            </div>
          )}

          <div style={{ padding: "8px" }}>
            <button
              onClick={() => { setOpen(false); setShowBuyModal(true); }}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--color-accent)",
                color: "var(--color-accent-fg)",
                border: "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                cursor: "pointer",
                transition: "opacity 120ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            >
              Add credits
            </button>
          </div>
        </div>
      )}
    </div>
    {showBuyModal && <BuyCreditsModal onClose={() => setShowBuyModal(false)} />}
    </>
  );
}

export function CreditsButton() {
  return (
    <Suspense fallback={null}>
      <CreditsButtonInner />
    </Suspense>
  );
}

// Keep for any existing consumers
export function CreditsDisplay({ onAddCredits }: { onAddCredits?: () => void }) {
  return (
    <Suspense fallback={null}>
      <CreditsButtonInner />
    </Suspense>
  );
}
