"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "../lib/auth-client";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--color-card-border)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  color: "var(--color-text)",
  background: "var(--color-bg)",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

function openAuthModal(mode: "signin" | "forgot") {
  window.dispatchEvent(new CustomEvent("doppo:open-auth", { detail: { mode } }));
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
        This link is invalid or has expired.{" "}
        <button
          style={{ color: "var(--color-accent)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
          onClick={() => { router.push("/"); openAuthModal("forgot"); }}
        >
          Request a new link
        </button>
      </p>
    );
  }

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          Password updated.
        </p>
        <button
          style={{
            borderRadius: 6,
            padding: "8px 0",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            width: "100%",
            background: "var(--color-accent)",
            color: "var(--color-accent-fg)",
          }}
          onClick={() => { router.push("/"); openAuthModal("signin"); }}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: err } = await resetPassword({ newPassword: password, token });
      if (err) throw new Error(err.message);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        style={inputStyle}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        style={inputStyle}
      />
      {error && <p style={{ margin: 0, color: "#dc2626", fontSize: 12 }}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{
          borderRadius: 6,
          padding: "8px 0",
          fontSize: 13,
          fontWeight: 600,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          width: "100%",
          background: "var(--color-accent)",
          color: "var(--color-accent-fg)",
          opacity: loading ? 0.5 : 1,
          transition: "background 150ms",
        }}
      >
        {loading ? "..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          background: "var(--color-card)",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: 24,
          width: "100%",
          maxWidth: 384,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, marginTop: 0, color: "var(--color-text)" }}>
          Reset password
        </h2>
        <Suspense fallback={<p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
