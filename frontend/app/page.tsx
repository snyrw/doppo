import Link from "next/link";
import Navbar from "./components/Navbar";
import Deck from "./components/deck/Deck";

export default function Home() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <Navbar />
      <Deck />
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-surface-border bg-background px-5 text-[11px] text-muted">
        <span>
          © {new Date().getFullYear()} Doppo
          <span className="mx-2 text-surface-border">|</span>
          We&apos;re in open beta. Have issues or want to give feedback? Email{" "}
          <a href="mailto:help@doppo.tools" className="no-underline hover:text-foreground">help@doppo.tools</a>
          .
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="no-underline hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-foreground">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
