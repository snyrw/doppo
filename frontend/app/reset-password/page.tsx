"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "../lib/auth-client";

const inputCls = "box-border w-full rounded-md border border-card-border bg-background px-2.5 py-1.5 font-[inherit] text-[13px] text-foreground outline-none";
const submitBtnCls = "w-full cursor-pointer rounded-md border-none bg-accent py-2 text-[13px] font-semibold text-accent-fg transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const linkBtnCls = "cursor-pointer border-none bg-transparent p-0 text-[13px] text-accent underline";

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
      <p className="m-0 text-[13px] text-muted">
        This link is invalid or has expired.{" "}
        <button
          className={linkBtnCls}
          onClick={() => { router.push("/"); openAuthModal("forgot"); }}
        >
          Request a new link
        </button>
      </p>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-[13px] text-muted">
          Password updated.
        </p>
        <button
          className={submitBtnCls}
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className={inputCls}
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        className={inputCls}
      />
      {error && <p className="m-0 text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className={submitBtnCls}
      >
        {loading ? "..." : "Reset Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-96 rounded-lg bg-card p-6 shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        <h2 className="mb-4 mt-0 text-lg font-semibold text-foreground">
          Reset password
        </h2>
        <Suspense fallback={<p className="m-0 text-[13px] text-muted">Loading...</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
