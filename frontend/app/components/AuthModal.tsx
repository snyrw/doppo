"use client";

import { useState, useEffect } from "react";
import { signIn, signUp, signOut, useSession } from "../lib/auth-client";

type Mode = "signin" | "signup" | "verify";

export default function AuthButtons() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"github" | null>(null);

  const openModal = (m: Mode) => {
    setMode(m);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setOpen(true);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const mode = (e as CustomEvent<{ mode: Mode }>).detail?.mode ?? "signup";
      openModal(mode);
    };
    window.addEventListener("doppo:open-auth", handler);
    return () => window.removeEventListener("doppo:open-auth", handler);
  }, []);

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const { error: err } = await signUp.email({ email, password, name });
        if (err) throw new Error(err.message);
        setMode("verify");
        return;
      } else {
        const { error: err } = await signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: "github") => {
    setSocialLoading(provider);
    setError("");
    try {
      await signIn.social({ provider, callbackURL: "/" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSocialLoading(null);
    }
  };

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

  if (session?.user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="nav-btn-ghost" style={{ cursor: "default" }}>
          {session.user.email}
        </span>
        <button onClick={() => signOut()} className="nav-btn-outline">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <button onClick={() => openModal("signin")} className="nav-btn-ghost">
        Log In
      </button>
      <button onClick={() => openModal("signup")} className="nav-btn-outline">
        Sign Up
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50"
          style={{ background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setOpen(false)}
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
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, marginTop: 0, color: "var(--color-text)" }}>
              {mode === "signin" ? "Log In" : mode === "signup" ? "Sign Up" : "Check your email"}
            </h2>
            {mode === "verify" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
                  We sent a verification link to <strong style={{ color: "var(--color-text)" }}>{email}</strong>. Click it to activate your account.
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>
                  (In local dev, the link is printed to the server console instead.)
                </p>
                <button
                  className="btn-accent"
                  style={{ borderRadius: 6, padding: "8px 0", fontSize: 13, border: "none", cursor: "pointer", width: "100%" }}
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            )}
            {mode !== "verify" && (
              <>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mode === "signup" && (
                    <input
                      type="text"
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    {loading ? "..." : mode === "signin" ? "Log In" : "Create Account"}
                  </button>
                </form>

                <div style={{ display: "flex", alignItems: "center", margin: "12px 0", gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>or continue with</span>
                  <div style={{ flex: 1, height: 1, background: "var(--color-surface-border)" }} />
                </div>

                <button
                  type="button"
                  disabled={!!socialLoading || loading}
                  onClick={() => handleSocialSignIn("github")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    border: "1px solid var(--color-card-border)",
                    borderRadius: 6,
                    padding: "8px 0",
                    fontSize: 13,
                    background: "var(--color-bg)",
                    color: "var(--color-text-muted)",
                    cursor: (!!socialLoading || loading) ? "not-allowed" : "pointer",
                    opacity: (!!socialLoading || loading) ? 0.5 : 1,
                    transition: "background 120ms",
                  }}
                  onMouseEnter={e => { if (!socialLoading && !loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-bg)"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
                  </svg>
                  {socialLoading === "github" ? "Connecting..." : "GitHub"}
                </button>

                <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", marginTop: 12, marginBottom: 0 }}>
                  {mode === "signin" ? (
                    <>
                      No account?{" "}
                      <button
                        style={{ color: "var(--color-accent)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
                        onClick={() => setMode("signup")}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Have an account?{" "}
                      <button
                        style={{ color: "var(--color-accent)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}
                        onClick={() => setMode("signin")}
                      >
                        Log in
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
