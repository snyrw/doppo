"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { LOW_BALANCE_THRESHOLD_MICROS } from "@/app/lib/rates";
import { useUsageBalance } from "@/app/hooks/useUsageBalance";
import { cn } from "../lib/cn";
import { BuyCreditsModal } from "./BuyCreditsModal";
import { IconTile } from "./ui/IconTile";

function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function CreditsButtonInner() {
  const { balanceMicros } = useUsageBalance();
  const [open, setOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => { setBuyOpen(true); setOpen(false); };
    window.addEventListener("open-buy-credits", handler);
    return () => window.removeEventListener("open-buy-credits", handler);
  }, []);

  // No "open-verify-card" listener: nothing dispatches it while the
  // verification gate is disabled (see spawn-route.ts). The
  // /api/credits/verify-card route itself is untouched.

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
        aria-label="Usage balance"
        title="Usage balance"
        innerClassName={cn("text-[13px] font-bold", glyphColorCls)}
      >
        U
      </IconTile>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[220px] overflow-hidden rounded-lg border border-card-border bg-card">

          {balanceMicros !== null && (
            <div className="flex items-center justify-between border-b border-surface-border px-3 pb-2 pt-2.5">
              <span className="text-[11px] text-muted">
                Usage
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
              Add balance
            </button>
            <span className="pl-0.5 text-[10px] text-muted opacity-70">
              Free tier: $1.00/month included
            </span>
            <Link
              href="/docs#usage-and-pricing"
              onClick={() => setOpen(false)}
              className="pl-0.5 text-[10px] text-indigo-300 underline decoration-surface-border underline-offset-5 hover:text-foreground"
            >
              What we charge, and why
            </Link>
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
