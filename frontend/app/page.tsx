import Link from "next/link";
import Navbar from "./components/Navbar";
import Deck from "./components/deck/Deck";
import LandingFlow from "./components/flow/LandingFlow";

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
        <span>
          Doppo
          <span className="mx-2 text-surface-border">|</span>
          We&apos;re in open beta. Have issues or want to give feedback? Email{" "}
          <a href="mailto:help@doppo.tools" className="no-underline hover:text-foreground">help@doppo.tools</a>
          .
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/docs" className="no-underline hover:text-foreground">Docs</Link>
          <Link href="/privacy" className="no-underline hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-foreground">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
