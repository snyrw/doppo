import Link from "next/link";
import Navbar from "./components/Navbar";
import HeroContent from "./components/HeroContent";

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
      <HeroContent />
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-surface-border bg-background px-5 text-[11px] text-muted">
        <span>© {new Date().getFullYear()} Doppo</span>
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="no-underline hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="no-underline hover:text-foreground">Terms</Link>
        </nav>
      </footer>
    </div>
  );
}
