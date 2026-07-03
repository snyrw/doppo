"use client";

import { useState } from "react";
import { PALETTE_META, SEQUENTIAL_PALETTE_ORDER, DIVERGING_PALETTE_ORDER } from "../../lib/palette";
import { useSequentialPalette, useDivergingPalette } from "../../hooks/usePalette";
import { cn } from "../../lib/cn";

export default function AppearanceSection() {
  const sequentialPalette = useSequentialPalette();
  const divergingPalette = useDivergingPalette();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
  );

  const setTheme = (dark: boolean) => {
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  };

  const setPalette = (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch {}
    window.dispatchEvent(new CustomEvent("palettechange", { detail: value }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-muted">Theme</div>
        <div className="flex gap-2">
          {[{ k: false, label: "Light" }, { k: true, label: "Dark" }].map(({ k, label }) => (
            <button key={label} onClick={() => setTheme(k)}
              className={cn("cursor-pointer rounded-md border px-3 py-1.5 text-xs", isDark === k ? "border-accent bg-surface-border font-semibold text-foreground" : "border-card-border bg-card text-muted")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-muted">Sequential palette</div>
        <div className="flex flex-col gap-1.5">
          {SEQUENTIAL_PALETTE_ORDER.map((name) => (
            <button key={name} onClick={() => setPalette("heatmap-palette", name)}
              className={cn("flex cursor-pointer flex-col gap-1.5 rounded-md border px-3 py-2 text-left", sequentialPalette === name ? "border-accent bg-surface-border" : "border-card-border bg-card hover:bg-surface-border")}>
              <span className="text-xs font-medium text-foreground">{PALETTE_META[name].label}</span>
              <span className="h-2 rounded-[3px] border border-surface-border" style={{ background: PALETTE_META[name].swatchCss }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[10px] uppercase tracking-[0.08em] text-muted">Diverging palette</div>
        <div className="flex flex-col gap-1.5">
          {DIVERGING_PALETTE_ORDER.map((name) => (
            <button key={name} onClick={() => setPalette("diverging-palette", name)}
              className={cn("flex cursor-pointer flex-col gap-1.5 rounded-md border px-3 py-2 text-left", divergingPalette === name ? "border-accent bg-surface-border" : "border-card-border bg-card hover:bg-surface-border")}>
              <span className="text-xs font-medium text-foreground">{PALETTE_META[name].label}</span>
              <span className="h-2 rounded-[3px] border border-surface-border" style={{ background: PALETTE_META[name].swatchCss }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
