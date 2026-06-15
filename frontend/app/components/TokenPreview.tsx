"use client";
import { cn } from "../lib/cn";
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
      className={cn(
        "m-0.5 inline-block rounded-[3px] border px-1 py-0.5 align-middle text-[11px] leading-none tracking-normal",
        tok.special
          ? "border-accent bg-[rgba(175,118,32,0.14)] font-semibold text-accent"
          : "border-card-border bg-background font-normal text-foreground",
      )}
    >
      {parts.map((part, i) =>
        part === " " ? (
          <span key={i} className="select-none text-[0.9em] text-muted opacity-70">
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
    <div className="mt-[7px]">
      {loading ? (
        <span className="text-[10px] italic text-muted">
          tokenizing…
        </span>
      ) : tokens ? (
        <>
          <div className="break-words leading-none">
            {tokens.map((tok, i) => (
              <TokenChip key={i} tok={tok} index={i} />
            ))}
          </div>
          <span className="mt-[5px] block text-[10px] text-muted">
            {tokens.length} token{tokens.length !== 1 ? "s" : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}