"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, deleteUser } from "../../lib/auth-client";
import { exportMyData } from "../../actions";

export default function PrivacySection() {
  const { data: session } = useSession();
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const email = session?.user.email ?? "";

  const download = async () => {
    const data = await exportMyData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "doppo-data-export.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const del = async () => {
    setErr("");
    const { error } = await deleteUser();
    if (error) {
      const isStaleSession =
        (error as { code?: string }).code === "SESSION_EXPIRED" ||
        error.message?.toLowerCase().includes("session expired") ||
        error.message?.toLowerCase().includes("fresh");
      setErr(isStaleSession ? "For security, please sign out and back in, then retry." : error.message ?? "Something went wrong.");
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted">Legal</div>
        <div className="flex gap-3 text-[13px]">
          <Link href="/privacy" className="text-accent underline">Privacy Policy</Link>
          <Link href="/terms" className="text-accent underline">Terms of Service</Link>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted">Your data</div>
        <button className="cursor-pointer self-start rounded-md border border-card-border bg-card px-3 py-1.5 text-[13px] text-foreground hover:bg-surface-border" onClick={download}>
          Download my data
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-red-600/40 p-3">
        <div className="text-[10px] uppercase tracking-[0.08em] text-red-600">Danger zone</div>
        <p className="m-0 text-xs text-muted">Deleting your account permanently removes your projects, cached results, billing records, and saved payment method. This cannot be undone.</p>
        <input
          className="box-border w-full rounded-md border border-card-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none"
          placeholder={`Type ${email} to confirm`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {err && <p className="m-0 text-xs text-red-600">{err}</p>}
        <button
          className="cursor-pointer self-start rounded-md border-none bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
          disabled={!email || confirm !== email}
          onClick={del}
        >
          Delete my account
        </button>
      </div>
    </div>
  );
}
