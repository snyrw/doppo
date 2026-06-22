"use client";

import { useState, useSyncExternalStore } from "react";
import AuthButtons from "./AuthModal";
import Link from "next/link";
import Image from "next/image";
import lightLogo from "../lightlogo.png";
import darkLogo from "../darklogo.png";
import { CreditsButton } from "./CreditsDisplay";
import { IconTile } from "./ui/IconTile";
import { useSession } from "../lib/auth-client";
import SettingsDrawer from "./SettingsDrawer";

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

export default function Navbar({ actions }: { actions?: React.ReactNode }) {
  // All isDark-dependent UI below is gated on `mounted`, which is false
  // during hydration, so reading client-only state in the initializer is safe.
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
  );
  const mounted = useMounted();
  const { data: session } = useSession();

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  return (
    <>
    <header className="relative z-40 flex h-[50px] shrink-0 items-center justify-between border-b border-surface-border bg-background px-5">
      <Link href="/" className="flex items-center no-underline">
        <Image
          src={mounted && isDark ? darkLogo : lightLogo}
          alt="Doppo logo"
          height={24}
          suppressHydrationWarning
        />
      </Link>

      <div className="flex items-center gap-3">
        {actions}
        <AuthButtons />
        <div className="h-4 w-px shrink-0 bg-surface-border" />

        <CreditsButton />

        <IconTile
          onClick={toggleTheme}
          aria-label="Toggle theme"
          suppressHydrationWarning
        >
          {mounted ? (isDark ? <SunIcon /> : <MoonIcon />) : <MoonIcon />}
        </IconTile>

        {/* settings gear — only when signed in */}
        {session?.user && (
          <IconTile
            onClick={() => window.dispatchEvent(new CustomEvent("open-settings"))}
            aria-label="Settings"
            title="Settings"
          >
            <GearIcon />
          </IconTile>
        )}
      </div>
    </header>
    <SettingsDrawer />
  </>
  );
}
