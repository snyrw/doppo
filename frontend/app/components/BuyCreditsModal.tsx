"use client";

import { Fragment, useState } from "react";
import { CREDIT_PACKS, TYPICAL_CARD_COST_MICROS, TYPICAL_STEERING_COST_MICROS } from "@/app/lib/rates";
import { TIER_LABELS } from "@/app/lib/tiers";
import { BLOCK_GAP, TIGHT_GAP } from "./configledger/ledger-geometry";
import { cn } from "../lib/cn";
import { Modal } from "./ui/Modal";
import SectionStrip from "./configledger/SectionStrip";

type PackLabel = (typeof CREDIT_PACKS)[number]["label"];

const USAGE_TIERS = Object.keys(TYPICAL_CARD_COST_MICROS);
const PACK_SECTIONS = CREDIT_PACKS.map(p => ({ id: p.label, label: p.label }));

/** Rounds to a step that scales with magnitude, so estimated usage reads as
 * a ballpark. */
function roundClean(n: number): number {
  const step = n < 100 ? 10 : n < 1000 ? 50 : 100;
  return Math.round(n / step) * step;
}

export function BuyCreditsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewPack, setPreviewPack] = useState<PackLabel>("$10");

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

  const previewCreditMicros = CREDIT_PACKS.find(p => p.label === previewPack)!.creditMicros;

  return (
    <Modal onClose={onClose} className="w-[560px] max-w-[92vw]">
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
        </p>

        <div className="flex items-start" style={{ paddingBlock: BLOCK_GAP }}>
          <div className="flex min-w-0 flex-[3] flex-col gap-2 border-r border-card-border pr-5">
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

          <div className="min-w-0 flex-[2] pl-5">
            <div className="flex justify-center">
              <SectionStrip
                sections={PACK_SECTIONS}
                activeId={previewPack}
                onChange={id => setPreviewPack(id as PackLabel)}
              />
            </div>
            <div
              className="text-[11px] tabular-nums"
              style={{ marginTop: TIGHT_GAP, display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 6, columnGap: 8 }}
            >
              <span className="text-[10px] text-muted">Model</span>
              <span className="text-right text-[10px] text-muted">Cards generated</span>
              {USAGE_TIERS.map((tier) => {
                const cards = previewCreditMicros / TYPICAL_CARD_COST_MICROS[tier];
                const steering = previewCreditMicros / TYPICAL_STEERING_COST_MICROS[tier];
                const low = roundClean(steering);
                const high = roundClean(cards);
                return (
                  <Fragment key={tier}>
                    <span className="text-foreground">
                      {TIER_LABELS[tier] ?? tier}
                    </span>
                    <span className="text-right text-foreground">
                      {low === high ? `~${low.toLocaleString()}` : `${low.toLocaleString()} – ${high.toLocaleString()}`}
                    </span>
                  </Fragment>
                );
              })}
            </div>
            <p className="text-[10px] leading-normal text-muted" style={{ marginTop: TIGHT_GAP }}>
              Note: This is a somewhat loose range that expects a runtime of 1-2 minutes. It can go lower if the model you're running is cached on Modal, or higher
              if you're running an intensive card (steering).
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-red-600">
            {error}
          </p>
        )}
    </Modal>
  );
}
