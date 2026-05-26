"use client";
import type { Token } from "../hooks/useTokenPreview";

type TokenPreviewProps = {
  tokens: Token[] | null;
  loading: boolean;
};

function TokenChip({ tok, index }: { tok: Token; index: number }) {
  const parts = tok.text.split(/( )/);

  return (
    <span
      title={`pos ${index}`}
      style={{
        display: "inline-block",
        fontFamily: "var(--font-azeret-mono), monospace",
        fontSize: 11,
        lineHeight: 1,
        border: tok.special
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-card-border)",
        borderRadius: 3,
        padding: "2px 4px",
        margin: "2px 2px",
        background: tok.special ? "rgba(175,118,32,0.14)" : "var(--color-bg)",
        color: tok.special ? "var(--color-accent)" : "var(--color-text)",
        fontWeight: tok.special ? 600 : 400,
        letterSpacing: 0,
        verticalAlign: "middle",
      }}
    >
      {parts.map((part, i) =>
        part === " " ? (
          <span
            key={i}
            style={{
              color: "var(--color-text-muted)",
              opacity: 0.7,
              fontSize: "0.9em",
              userSelect: "none",
            }}
          >
            ·
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
}

export default function TokenPreview({ tokens, loading }: TokenPreviewProps) {
  if (!tokens && !loading) return null;

  return (
    <div style={{ marginTop: 7 }}>
      {loading ? (
        <span
          style={{ fontSize: 10, color: "var(--color-text-muted)", fontStyle: "italic" }}
        >
          tokenizing…
        </span>
      ) : tokens ? (
        <>
          <div style={{ lineHeight: 1, wordBreak: "break-word" }}>
            {tokens.map((tok, i) => (
              <TokenChip key={i} tok={tok} index={i} />
            ))}
          </div>
          <span
            style={{
              fontSize: 10,
              color: "var(--color-text-muted)",
              display: "block",
              marginTop: 5,
            }}
          >
            {tokens.length} token{tokens.length !== 1 ? "s" : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}
