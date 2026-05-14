"use client";

import { useEffect, useRef, useState } from "react";
import AuthButtons from "./AuthModal";
import Link from "next/link";
import Image from "next/image";
import lightLogo from "../lightlogo.png";
import darkLogo from "../darklogo.png";
import { PALETTE_META, PALETTE_ORDER, type PaletteName } from "../lib/palette";

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
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<PaletteName>("warm-mono");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const currentTheme = document.documentElement.getAttribute("data-theme");
    setIsDark(currentTheme === "dark");
    const storedPalette = localStorage.getItem("heatmap-palette") as PaletteName | null;
    if (storedPalette) setPalette(storedPalette);
  }, []);

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
    setPalette(p);
    setPaletteOpen(false);
    try { localStorage.setItem("heatmap-palette", p); } catch {}
    window.dispatchEvent(new CustomEvent("palettechange", { detail: p }));
  };

  return (
    <header
      style={{
        background: "var(--color-bg)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        height: 50,
        borderBottom: "1px solid var(--color-surface-border)",
        flexShrink: 0,
        zIndex: 40,
        position: "relative",
      }}
    >
      <Link
        href="/"
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Image
          src={mounted && isDark ? darkLogo : lightLogo}
          alt="logitlensviz logo"
          height={24}
          suppressHydrationWarning
        />
        <span
          style={{
            fontFamily: "var(--font-azeret-mono), monospace",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-accent)",
            letterSpacing: "-0.01em",
          }}
        >
          Doppo
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {actions}
        <AuthButtons />
        <div style={{ width: 1, height: 16, background: "var(--color-surface-border)" }} />

        {/* Palette picker */}
        <div ref={paletteRef} style={{ position: "relative" }}>
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
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: 8,
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                width: 224,
                overflow: "hidden",
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: "8px 12px 7px",
                  borderBottom: "1px solid var(--color-surface-border)",
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  fontFamily: "var(--font-azeret-mono), monospace",
                }}
              >
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
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      width: "100%",
                      padding: "10px 12px",
                      background: isSelected ? "var(--color-surface-border)" : "var(--color-card)",
                      border: "none",
                      borderBottom: isLast ? "none" : "1px solid var(--color-surface-border)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 100ms",
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-border)";
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)";
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 700 : 500,
                          color: "var(--color-text)",
                          fontFamily: "var(--font-azeret-mono), monospace",
                        }}
                      >
                        {meta.label}
                      </span>
                      {isSelected && (
                        <span style={{ color: "var(--color-accent)" }}>
                          <CheckIcon />
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 3,
                        background: meta.swatchCss,
                        border: "1px solid var(--color-surface-border)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--color-text-muted)",
                        fontFamily: "var(--font-azeret-mono), monospace",
                      }}
                    >
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
