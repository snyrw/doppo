"use client";

import { useState } from "react";
import { CREDIT_PACKS } from "@/app/lib/rates";
import { cn } from "../lib/cn";
import { Modal } from "./ui/Modal";

export function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePack = async (pack: (typeof CREDIT_PACKS)[number]) => {
    setLoading(pack.label);
    setError(null);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packLabel: pack.label }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) {
        setLoading(null);
        setError(json.error ?? "Checkout failed");
        return;
      }
      window.location.assign(json.url);
    } catch {
      setLoading(null);
      setError("Network error — please try again.");
    }
  };

  return (
    <Modal onClose={onClose} className="w-[340px] max-w-[90vw]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 text-sm text-foreground">
            Add usage balance
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent text-lg leading-none text-muted"
          >
            &times;
          </button>
        </div>

        <p className="mb-4 text-[11px] leading-normal text-muted">
          Usage is billed at Modal serverless cost with Stripe fees included.
          Free tier: $1.00/month.
        </p>

        <div className="flex flex-col gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.label}
              onClick={() => handlePack(pack)}
              disabled={loading !== null}
              className={cn(
                "flex items-center justify-between rounded-lg border border-card-border bg-background px-3.5 py-2.5 disabled:cursor-not-allowed",
                loading === null ? "cursor-pointer" : "cursor-not-allowed",
                loading !== null && loading !== pack.label && "opacity-50",
              )}
            >
              <div className="text-left">
                <div className="text-[13px] font-semibold text-foreground">
                  {pack.label} balance
                </div>
                <div className="text-[10px] text-muted">
                  ${(pack.chargeCents / 100).toFixed(2)} charged to card
                </div>
              </div>
              {loading === pack.label && (
                <span className="text-[11px] text-muted">
                  Redirecting…
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-red-600">
            {error}
          </p>
        )}
    </Modal>
  );
}
