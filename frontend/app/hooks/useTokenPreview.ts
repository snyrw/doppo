"use client";
import { useState, useEffect, useRef } from "react";

export type Token = { text: string; special: boolean };

export type TokenPreviewState = {
  tokens: Token[] | null;
  loading: boolean;
};

export function useTokenPreview(modelId: string, text: string): TokenPreviewState {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!modelId || !text.trim()) {
      setTokens(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      try {
        const res = await fetch("/api/tokenize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_name: modelId, text }),
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error();
        const json = await res.json() as { tokens: Array<Token | string> };
        const normalized: Token[] = json.tokens.map(t =>
          typeof t === "string" ? { text: t, special: false } : t
        );
        setTokens(normalized);
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") setTokens(null);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [modelId, text]);

  return { tokens, loading };
}
