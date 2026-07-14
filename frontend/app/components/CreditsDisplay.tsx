"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { LOW_BALANCE_THRESHOLD_MICROS } from "@/app/lib/rates";
import { cn } from "../lib/cn";
import { BuyCreditsModal } from "./BuyCreditsModal";
import { IconTile } from "./ui/IconTile";

function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function useCreditsBalance() {
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

function CreditsButtonInner() {
  const { balanceMicros } = useCreditsBalance();
  const [open, setOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => { setBuyOpen(true); setOpen(false); };
    window.addEventListener("open-buy-credits", handler);
    return () => window.removeEventListener("open-buy-credits", handler);
  }, []);

  useEffect(() => {
    const handler = async () => {
      try {
        const res = await fetch("/api/credits/verify-card", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.url) window.location.assign(json.url);
      } catch {
        // network error — user can retry from the card
      }
    };
    window.addEventListener("open-verify-card", handler);
    return () => window.removeEventListener("open-verify-card", handler);
  }, []);

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
  const glyphColorCls =
    balanceMicros === null ? "text-muted"
    : isEmpty ? "text-red-600"
    : isLow ? "text-orange-600"
    : "text-muted";
  const balanceColorCls = isEmpty ? "text-red-600" : isLow ? "text-orange-600" : "text-foreground";

  return (
    <>
    <div ref={ref} className="relative">
      <IconTile
        onClick={() => setOpen(o => !o)}
        aria-label="Credits"
        title="Credits"
        innerClassName={cn("text-[13px] font-bold", glyphColorCls)}
      >
        $
      </IconTile>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[220px] overflow-hidden rounded-lg border border-card-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
          <div className="border-b border-surface-border px-3 pb-[7px] pt-2 text-[9px] uppercase tracking-[0.08em] text-muted">
            Credits
          </div>

          {balanceMicros !== null && (
            <div className="flex items-center justify-between border-b border-surface-border px-3 pb-2 pt-2.5">
              <span className="text-[11px] text-muted">
                Balance
              </span>
              <span className={cn("text-[13px] font-semibold", balanceColorCls)}>
                {formatMicros(balanceMicros)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 px-3 pb-2.5 pt-2">
            <button
              onClick={() => { setBuyOpen(true); setOpen(false); }}
              className="w-full cursor-pointer rounded-md border border-card-border bg-background px-2.5 py-[7px] text-left text-[11px] text-foreground"
            >
              Add credits →
            </button>
            <span className="pl-0.5 text-[10px] text-muted opacity-70">
              Free tier: $1.00/month included
            </span>
          </div>
        </div>
      )}
    </div>
      {buyOpen && <BuyCreditsModal onClose={() => setBuyOpen(false)} />}
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
