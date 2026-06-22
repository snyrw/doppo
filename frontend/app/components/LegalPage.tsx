import Link from "next/link";
import Navbar from "./Navbar";

// Shared chrome + prose styling for the static legal pages (/privacy, /terms).
// Pages pass plain `<h2>`, `<p>`, `<ul><li>`, `<table>` — the descendant
// utilities on the prose container style them, so the page bodies stay easy
// to edit without touching className soup.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        <Link href="/" className="text-sm text-muted no-underline hover:text-foreground">
          ← Back to Doppo
        </Link>

        <h1 className="mt-6 mb-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="m-0 text-sm text-muted">Last updated {updated}</p>

        <div
          className="mt-8 text-[15px] leading-7 text-foreground
            [&_a]:text-accent [&_a]:underline
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground
            [&_p]:mb-4
            [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc
            [&_li]:mb-1.5
            [&_strong]:font-semibold
            [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse
            [&_th]:border-b [&_th]:border-surface-border [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold
            [&_td]:border-b [&_td]:border-surface-border [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td]:text-sm [&_td]:text-muted"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
