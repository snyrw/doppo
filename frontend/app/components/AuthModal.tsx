"use client";

import { useState } from "react";
import { signIn, signUp, signOut, useSession } from "../lib/auth-client";

type Mode = "signin" | "signup";

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

  if (session?.user) {
    return (
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-600">{session.user.email}</span>
        <button
          onClick={() => signOut()}
          className="bg-white text-sm font-light text-blue-400 px-2.5 py-0.5 rounded border border-blue-300 hover:bg-blue-50 transition-colors"
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
        className="bg-white text-sm font-light text-blue-400 px-2.5 py-0.5 rounded border border-blue-300 hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        Log In
      </button>
      <button
        onClick={() => openModal("signup")}
        className="bg-white text-sm font-light text-blue-400 px-2.5 py-0.5 rounded border border-blue-300 hover:bg-blue-50 disabled:opacity-50 transition-colors"
      >
        Sign Up
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              {mode === "signin" ? "Log In" : "Sign Up"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <input
                  type="text"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded p-2 text-sm"
                />
              )}
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
              >
                {loading ? "..." : mode === "signin" ? "Log In" : "Create Account"}
              </button>
            </form>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-2 text-xs text-gray-400">or continue with</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              type="button"
              disabled={!!socialLoading || loading}
              onClick={() => handleSocialSignIn("google")}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              {socialLoading === "google" ? "Connecting..." : "Google"}
            </button>

            <button
              type="button"
              disabled={!!socialLoading || loading}
              onClick={() => handleSocialSignIn("github")}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors mt-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
              {socialLoading === "github" ? "Connecting..." : "GitHub"}
            </button>

            <p className="text-center text-sm text-gray-500 mt-3">
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Have an account?{" "}
                  <button
                    className="text-blue-500 underline"
                    onClick={() => setMode("signin")}
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
