"use client";

import { useState, useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { signIn, signUp, signOut, useSession, requestPasswordReset } from "../lib/auth-client";
import { Modal } from "./ui/Modal";
import { TactileButton } from "./ui/TactileButton";

type Mode = "signin" | "signup" | "verify" | "forgot" | "forgot-sent";

// Compact face padding so the navbar auth buttons land at the same ~34px face
// height as the icon tiles next to them (text-xs line box 16px + 2*9px).
const NAV_BTN_PAD = { "--pad-x": "14px", "--pad-y": "9px" } as CSSProperties;

export default function AuthButtons() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"github" | null>(null);

  const openModal = (m: Mode) => {
    setMode(m);
    setError("");
    setEmail("");
    setPassword("");
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
        const { error: err } = await signUp.email({ email, password, name: email });
        if (err) throw new Error(err.message);
        setMode("verify");
        return;
      } else if (mode === "forgot") {
        const { error: err } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
        if (err) throw new Error(err.message);
        setMode("forgot-sent");
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
      const { error: err } = await signIn.social({ provider, callbackURL: "/" });
      if (err) throw new Error(err.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSocialLoading(null);
    }
  };

  const inputCls = "box-border w-full rounded-md border border-card-border bg-background px-2.5 py-1.5 font-[inherit] text-[13px] text-foreground outline-none";
  const submitBtnCls = "btn-accent w-full cursor-pointer py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  const linkBtnCls = "cursor-pointer border-none bg-transparent p-0 text-[13px] text-accent underline";
  const errorCls = "m-0 text-xs text-red-600";

  const modalTitle: Record<Mode, string> = {
    signin: "Log In",
    signup: "Sign Up",
    verify: "Check your email",
    forgot: "Forgot password",
    "forgot-sent": "Check your email",
  };

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {/* mb matches the tactile depth reserve so the email baseline lines up with the button faces */}
        <span className="nav-btn-ghost mb-[5px] cursor-default">
          {session.user.email}
        </span>
        <TactileButton
          variant="ghost"
          onClick={() => signOut()}
          style={NAV_BTN_PAD}
          faceClassName="font-mono text-xs font-light text-muted"
        >
          Sign Out
        </TactileButton>
      </div>
    );
  }

  return (
    <>
      <TactileButton
        variant="ghost"
        onClick={() => openModal("signin")}
        style={NAV_BTN_PAD}
        faceClassName="text-xs font-medium text-muted"
      >
        Log In
      </TactileButton>
      <TactileButton
        variant="ghost"
        onClick={() => openModal("signup")}
        style={NAV_BTN_PAD}
        faceClassName="text-xs font-medium text-muted"
      >
        Sign Up
      </TactileButton>

      {open && (
        <Modal onClose={() => setOpen(false)} className="w-full max-w-96">
            <h2 className="mb-4 mt-0 text-lg font-semibold text-foreground">
              {modalTitle[mode]}
            </h2>

            {/* Confirmation states */}
            {(mode === "verify" || mode === "forgot-sent") && (
              <div className="flex flex-col gap-2.5">
                <p className="m-0 text-[13px] text-muted">
                  {mode === "verify"
                    ? <>We sent a verification link to <strong className="text-foreground">{email}</strong>. Click it to activate your account.</>
                    : <>We sent a password reset link to <strong className="text-foreground">{email}</strong>. Check your inbox.</>}
                </p>
                {mode === "verify" && (
                  <p className="m-0 text-[11px] text-muted">
                    (In local dev, the link is printed to the server console instead.)
                  </p>
                )}
                <button
                  className="btn-accent w-full cursor-pointer rounded-md border-none py-2 text-[13px]"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            )}

            {/* Forgot password form */}
            {mode === "forgot" && (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                  {error && <p className={errorCls}>{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className={submitBtnCls}
                  >
                    {loading ? "..." : "Send reset link"}
                  </button>
                </form>
                <p className="mb-0 mt-3 text-center text-[13px] text-muted">
                  <button
                    className={linkBtnCls}
                    onClick={() => { setMode("signin"); setError(""); }}
                  >
                    Back to log in
                  </button>
                </p>
              </>
            )}

            {/* Sign in / Sign up forms */}
            {(mode === "signin" || mode === "signup") && (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputCls}
                  />
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="-mt-1 cursor-pointer self-end border-none bg-transparent p-0 text-xs text-muted"
                      onClick={() => { setMode("forgot"); setError(""); }}
                    >
                      Forgot password?
                    </button>
                  )}
                  {error && <p className={errorCls}>{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className={submitBtnCls}
                  >
                    {loading ? "..." : mode === "signin" ? "Log In" : "Create Account"}
                  </button>
                </form>

                <div className="my-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-surface-border" />
                  <span className="text-[11px] text-muted">or continue with</span>
                  <div className="h-px flex-1 bg-surface-border" />
                </div>

                <button
                  type="button"
                  disabled={!!socialLoading || loading}
                  onClick={() => handleSocialSignIn("github")}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-card-border bg-background py-2 text-[13px] text-muted transition-colors hover:enabled:bg-surface-border disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
                  </svg>
                  {socialLoading === "github" ? "Connecting..." : "GitHub"}
                </button>

                {mode === "signup" && (
                  <p className="mb-0 mt-3 text-center text-[11px] leading-5 text-muted">
                    By creating an account, you agree to our{" "}
                    <Link href="/terms" target="_blank" className="text-accent underline">Terms of Service</Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="text-accent underline">Privacy Policy</Link>.
                  </p>
                )}

                <p className="mb-0 mt-3 text-center text-[13px] text-muted">
                  {mode === "signin" ? (
                    <>
                      No account?{" "}
                      <button
                        className={linkBtnCls}
                        onClick={() => setMode("signup")}
                      >
                        Sign up
                      </button>
                    </>
                  ) : (
                    <>
                      Have an account?{" "}
                      <button
                        className={linkBtnCls}
                        onClick={() => setMode("signin")}
                      >
                        Log in
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
        </Modal>
      )}
    </>
  );
}
