"use client";

import { useState } from "react";
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
  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  const openModal = (m: Mode) => {
    setMode(m);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setOpen(true);
  };

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

  const handleSocialSignIn = async (provider: "google" | "github") => {
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
    width: "100%",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
    color: "#e6edf3",
    background: "#0d1117",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 120ms",
  };

  if (session?.user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, color: "#7d8590" }}>{session.user.email}</span>
        <button
          onClick={() => signOut()}
          style={{
            background: "transparent",
            fontSize: 12,
            fontWeight: 400,
            color: "#7d8590",
            padding: "3px 10px",
            borderRadius: 5,
            border: "1px solid #30363d",
            cursor: "pointer",
            transition: "background 120ms, color 120ms",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "#1c2128";
            (e.currentTarget as HTMLButtonElement).style.color = "#e6edf3";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#7d8590";
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => openModal("signin")}
        style={{
          background: "transparent",
          fontSize: 12,
          fontWeight: 400,
          color: "#7d8590",
          padding: "4px 12px",
          borderRadius: 6,
          border: "1px solid #30363d",
          cursor: "pointer",
          transition: "background 120ms, color 120ms, border-color 120ms",
          fontFamily: "inherit",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "#1c2128";
          (e.currentTarget as HTMLButtonElement).style.color = "#e6edf3";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#58a6ff";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "#7d8590";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363d";
        }}
      >
        Log In
      </button>
      <button
        onClick={() => openModal("signup")}
        style={{
          background: "#58a6ff",
          fontSize: 12,
          fontWeight: 600,
          color: "#0d1117",
          padding: "4px 12px",
          borderRadius: 6,
          border: "none",
          cursor: "pointer",
          letterSpacing: "0.02em",
          fontFamily: "inherit",
        }}
      >
        Sign Up
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "#161b22",
              borderRadius: 10,
              border: "1px solid #30363d",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(88,166,255,0.06)",
              padding: 28,
              width: "100%",
              maxWidth: 400,
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 18px", color: "#e6edf3" }}>
              {mode === "signin" ? "Log In" : mode === "signup" ? "Sign Up" : "Check your email"}
            </h2>

            {mode === "verify" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 13, color: "#7d8590", margin: 0 }}>
                  We sent a verification link to{" "}
                  <strong style={{ color: "#e6edf3" }}>{email}</strong>. Click it to activate your account.
                </p>
                <p style={{ fontSize: 11, color: "#484f58", margin: 0 }}>
                  (In local dev, the link is printed to the server console instead.)
                </p>
                <button
                  style={{
                    width: "100%",
                    background: "#58a6ff",
                    color: "#0d1117",
                    padding: "10px 0",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    marginTop: 4,
                  }}
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
                      onChange={e => setName(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                  />
                  {error && <p style={{ fontSize: 12, color: "#f85149", margin: "2px 0 0" }}>{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: "100%",
                      background: loading ? "#1c2128" : "#58a6ff",
                      color: loading ? "#484f58" : "#0d1117",
                      padding: "10px 0",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "background 120ms",
                      fontFamily: "inherit",
                      marginTop: 2,
                    }}
                  >
                    {loading ? "…" : mode === "signin" ? "Log In" : "Create Account"}
                  </button>
                </form>

                <div style={{ display: "flex", alignItems: "center", margin: "14px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "#21262d" }} />
                  <span style={{ padding: "0 10px", fontSize: 11, color: "#484f58" }}>or continue with</span>
                  <div style={{ flex: 1, height: 1, background: "#21262d" }} />
                </div>

                <button
                  type="button"
                  disabled={!!socialLoading || loading}
                  onClick={() => handleSocialSignIn("google")}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "9px 0",
                    fontSize: 13,
                    color: "#e6edf3",
                    background: "#1c2128",
                    cursor: (socialLoading || loading) ? "not-allowed" : "pointer",
                    opacity: (socialLoading || loading) ? 0.5 : 1,
                    transition: "background 120ms",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => { if (!socialLoading && !loading) (e.currentTarget as HTMLButtonElement).style.background = "#21262d"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  {socialLoading === "google" ? "Connecting…" : "Google"}
                </button>

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
                    border: "1px solid #30363d",
                    borderRadius: 6,
                    padding: "9px 0",
                    fontSize: 13,
                    color: "#e6edf3",
                    background: "#1c2128",
                    cursor: (socialLoading || loading) ? "not-allowed" : "pointer",
                    opacity: (socialLoading || loading) ? 0.5 : 1,
                    transition: "background 120ms",
                    fontFamily: "inherit",
                    marginTop: 8,
                  }}
                  onMouseEnter={e => { if (!socialLoading && !loading) (e.currentTarget as HTMLButtonElement).style.background = "#21262d"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#1c2128"; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#e6edf3" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
                  </svg>
                  {socialLoading === "github" ? "Connecting…" : "GitHub"}
                </button>

                <p style={{ textAlign: "center", fontSize: 12, color: "#7d8590", margin: "14px 0 0" }}>
                  {mode === "signin" ? (
                    <>
                      No account?{" "}
                      <button
                        style={{
                          color: "#58a6ff",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          textDecoration: "underline",
                          fontSize: 12,
                          fontFamily: "inherit",
                          padding: 0,
                        }}
                        onClick={() => setMode("signup")}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Have an account?{" "}
                      <button
                        style={{
                          color: "#58a6ff",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          textDecoration: "underline",
                          fontSize: 12,
                          fontFamily: "inherit",
                          padding: 0,
                        }}
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
