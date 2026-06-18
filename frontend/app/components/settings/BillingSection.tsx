"use client";

import { useEffect, useState } from "react";
import { getCreditLedger } from "../../actions";
import { TIER_LABELS } from "../../lib/tiers";

type Row = Awaited<ReturnType<typeof getCreditLedger>>[number];

function fmt(micros: number) { return `$${(micros / 1_000_000).toFixed(2)}`; }
function label(r: Row) {
  if (r.type === "usage") return `Usage — ${r.jobTier ? TIER_LABELS[r.jobTier] ?? r.jobTier : "job"}`;
  if (r.type === "purchase") return "Credit purchase";
  if (r.type === "free_grant") return "Monthly free grant";
  return r.type;
}

export default function BillingSection() {
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [portalErr, setPortalErr] = useState("");

  useEffect(() => {
    fetch("/api/credits/balance").then((r) => r.json()).then((d) => setBalance(d.balanceMicros)).catch(() => {});
    getCreditLedger().then(setRows).catch(() => {});
  }, []);

  const openPortal = async () => {
    const res = await fetch("/api/credits/portal", { method: "POST" });
    if (!res.ok) { setPortalErr(res.status === 503 ? "Payments aren't configured yet." : "Couldn't open the portal."); return; }
    const { url } = await res.json();
    window.location.href = url;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted">Balance</div>
          <div className="text-lg font-semibold text-foreground">{balance === null ? "…" : fmt(balance)}</div>
        </div>
        <button className="btn-accent cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-semibold"
          onClick={() => window.dispatchEvent(new CustomEvent("open-buy-credits"))}>
          Buy credits
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <button className="cursor-pointer self-start rounded-md border border-card-border bg-card px-3 py-1.5 text-[13px] text-foreground hover:bg-surface-border" onClick={openPortal}>
          Manage payment & receipts
        </button>
        {portalErr && <p className="m-0 text-xs text-muted">{portalErr}</p>}
      </div>

      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-muted">History</div>
        <div className="flex flex-col gap-1">
          {rows.length === 0 && <p className="m-0 text-xs text-muted">No activity yet.</p>}
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between border-b border-surface-border py-1.5 text-xs last:border-b-0">
              <span className="text-foreground">{label(r)}</span>
              <span className={r.amountMicros < 0 ? "text-muted" : "text-foreground"}>{fmt(r.amountMicros)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
