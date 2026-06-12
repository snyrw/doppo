"use client";

import { useState } from "react";
import { CREDIT_PACKS } from "@/app/lib/rates";

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 12,
          padding: "24px",
          width: 340,
          maxWidth: "90vw",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              color: "var(--color-text)",
            }}
          >
            Add credits
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--color-text-muted)",
            fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Credits are charged at Modal serverless cost with Stripe fees included.
          Free tier: $1.00/month.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.label}
              onClick={() => handlePack(pack)}
              disabled={loading !== null}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "var(--color-bg)",
                border: "1px solid var(--color-card-border)",
                borderRadius: 8,
                cursor: loading !== null ? "not-allowed" : "pointer",
                opacity: loading !== null && loading !== pack.label ? 0.5 : 1,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
                  {pack.label} credit
                </div>
                <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                  ${(pack.chargeCents / 100).toFixed(2)} charged to card
                </div>
              </div>
              {loading === pack.label && (
                <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                  Redirecting…
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 11,
              color: "#dc2626",
              fontFamily: "var(--font-ibm-plex-sans), sans-serif",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
