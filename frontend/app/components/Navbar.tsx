"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import AuthButtons from "./AuthModal";
import Link from "next/link";
import Image from "next/image";
import lightLogo from "../lightlogo.png";
import darkLogo from "../darklogo.png";
import { PALETTE_META, PALETTE_ORDER, type PaletteName } from "../lib/palette";
import { usePalette } from "../hooks/usePalette";
import { CreditsButton } from "./CreditsDisplay";
import { cn } from "../lib/cn";

// Server snapshot is false, client snapshot is true: during hydration React uses
// the server value, then re-renders once mounted — same effect as the old
// setMounted(true)-in-useEffect pattern without setState in an effect.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Navbar({ actions }: { actions?: React.ReactNode }) {
  // All isDark/palette-dependent UI below is gated on `mounted`, which is false
  // during hydration, so reading client-only state in the initializer is safe.
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
  );
  const mounted = useMounted();
  const palette = usePalette();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [paletteOpen]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  const handlePaletteChange = (p: PaletteName) => {
    setPaletteOpen(false);
    try { localStorage.setItem("heatmap-palette", p); } catch {}
    // usePalette subscribes to this event and re-reads localStorage.
    window.dispatchEvent(new CustomEvent("palettechange", { detail: p }));
  };

  return (
    <header className="relative z-40 flex h-[50px] shrink-0 items-center justify-between border-b border-surface-border bg-background px-5">
      <Link href="/" className="flex items-center gap-2 no-underline">
        <Image
          src={mounted && isDark ? darkLogo : lightLogo}
          alt="Doppo logo"
          height={24}
          suppressHydrationWarning
        />
        <span className="text-sm font-medium tracking-[-0.01em] text-accent">
          Doppo
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {actions}
        <AuthButtons />
        <div className="h-4 w-px shrink-0 bg-surface-border" />

        <CreditsButton />

        {/* Palette picker */}
        <div ref={paletteRef} className="relative">
          <button
            className="theme-toggle"
            onClick={() => setPaletteOpen(o => !o)}
            aria-label="Heatmap palette"
            title="Heatmap palette"
            suppressHydrationWarning
          >
            <GearIcon />
          </button>

          {mounted && paletteOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-56 overflow-hidden rounded-lg border border-card-border bg-card shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
              <div className="border-b border-surface-border px-3 pb-[7px] pt-2 text-[9px] uppercase tracking-[0.08em] text-muted">
                Heatmap palette
              </div>

              {PALETTE_ORDER.map((name, i) => {
                const meta = PALETTE_META[name];
                const isSelected = palette === name;
                const isLast = i === PALETTE_ORDER.length - 1;
                return (
                  <button
                    key={name}
                    onClick={() => handlePaletteChange(name)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-1.5 border-x-0 border-t-0 px-3 py-2.5 text-left transition-colors",
                      isLast ? "border-b-0" : "border-b border-surface-border",
                      isSelected ? "bg-surface-border" : "bg-card hover:bg-surface-border",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs text-foreground", isSelected ? "font-bold" : "font-medium")}>
                        {meta.label}
                      </span>
                      {isSelected && (
                        <span className="text-accent">
                          <CheckIcon />
                        </span>
                      )}
                    </div>
                    <div
                      className="h-2 rounded-[3px] border border-surface-border"
                      style={{ background: meta.swatchCss }}
                    />
                    <span className="text-[9px] text-muted">
                      {meta.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
