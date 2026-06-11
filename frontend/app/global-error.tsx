"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "40px", textAlign: "center" }}>
        <h2>Something went wrong</h2>
        <p style={{ color: "#666" }}>The error has been reported. Try reloading the page.</p>
        <button
          onClick={() => reset()}
          style={{ padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
