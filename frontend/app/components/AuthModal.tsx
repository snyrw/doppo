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

  const openModal = (m: Mode) => {
    setMode(m);
    setError("");
    setEmail("");
    setPassword("");
    setName("");
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
