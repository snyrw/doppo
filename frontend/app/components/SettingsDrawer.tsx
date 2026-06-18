"use client";

import { useEffect, useState } from "react";
import { useSession } from "../lib/auth-client";
import { cn } from "../lib/cn";

type Section = "appearance" | "account" | "billing" | "privacy";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing" },
  { id: "privacy", label: "Privacy & data" },
];

export default function SettingsDrawer() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const s = new URLSearchParams(window.location.search).get("settings");
    return s != null && SECTIONS.some((x) => x.id === s);
  });
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "appearance";
    const s = new URLSearchParams(window.location.search).get("settings");
    return s && SECTIONS.some((x) => x.id === s) ? (s as Section) : "appearance";
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: Section }>).detail;
      if (detail?.section) setSection(detail.section);
      setOpen(true);
    };
    window.addEventListener("open-settings", handler);
    return () => window.removeEventListener("open-settings", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !session?.user) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <div className="relative flex h-full w-[420px] max-w-full flex-col border-l border-card-border bg-panel shadow-[0_0_40px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3">
          <span className="text-sm font-semibold text-foreground">Settings</span>
          <button onClick={() => setOpen(false)} aria-label="Close settings" className="cursor-pointer border-none bg-transparent text-muted hover:text-foreground">✕</button>
        </div>
        <nav className="flex gap-1 border-b border-surface-border px-3 py-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "cursor-pointer rounded-md border-none px-2.5 py-1.5 text-xs",
                section === s.id ? "bg-surface-border font-semibold text-foreground" : "bg-transparent text-muted hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-auto p-5" style={{ background: "var(--color-card)" }}>
          {/* Sections wired in later tasks */}
          {section === "appearance" && <div data-section="appearance" />}
          {section === "account" && <div data-section="account" />}
          {section === "billing" && <div data-section="billing" />}
          {section === "privacy" && <div data-section="privacy" />}
        </div>
      </div>
    </div>
  );
}
