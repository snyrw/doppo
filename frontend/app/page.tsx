import Link from "next/link";
import Navbar from "./components/Navbar";
import Deck from "./components/deck/Deck";
import LandingFlow from "./components/flow/LandingFlow";

const REPO_URL = "https://github.com/snyrw/doppo";

// GitHub mark, sized to sit on the 11px footer baseline. Inherits currentColor
// so it picks up the footer's muted → foreground hover with no extra rules.
function GitHubMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

// Both landing modes are SSR-rendered and CSS-gated (`.deck-only` /
// `.flow-only` in globals.css, twin of DECK_QUERY in deck-logic.ts): desktop
// landscape gets the full-viewport slide deck, everything else gets the
// scrolling flow. `.landing-root` re-locks height/overflow in deck mode only;
// the flow scrolls the document naturally with the footer at the end.
export default function Home() {
  return (
    <div className="landing-root flex min-h-[100svh] flex-col" style={{ background: "var(--bg)" }}>
      <Navbar />
      <div className="deck-only flex min-h-0 flex-1 flex-col">
        <Deck />
      </div>
      <div className="flow-only flex-1">
        <LandingFlow />
      </div>
      <footer className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-surface-border bg-background px-5 py-1 text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Doppo on GitHub"
            title="Doppo on GitHub"
            className="flex items-center text-muted no-underline transition-colors hover:text-foreground"
          >
            <GitHubMark />
          </a>
          <span>
            {new Date().getFullYear()} Doppo
            <span className="mx-2 text-surface-border">|</span>
            Open Beta
          </span>
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/docs" className="no-underline hover:text-foreground">Docs (WIP)</Link>
          <Link href="/privacy" className="no-underline hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-foreground">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
