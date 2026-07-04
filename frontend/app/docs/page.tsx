import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Navbar from "../components/Navbar";
import { cn } from "../lib/cn";
import { PROSE_CLASSES } from "../components/prose";
import { loadDocSections, slugify, type DocSection } from "../lib/docs";

export const metadata: Metadata = {
  title: "Docs — Doppo",
  description: "Reference for Doppo: the techniques, model support, pricing, caching, and limits.",
};

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

// Body `##` headings render one level down (the section title from frontmatter
// is the page's h2), carrying the same slug id the ToC links to.
const mdComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h3 id={slugify(textOf(children))} className="scroll-mt-16">{children}</h3>
  ),
};

function Toc({ sections }: { sections: DocSection[] }) {
  return (
    <nav className="flex flex-col gap-1 text-[13px]">
      {sections.map(s => (
        <div key={s.slug}>
          <a href={`#${s.slug}`} className="text-muted no-underline hover:text-foreground">
            {s.title}
          </a>
          {s.headings.length > 0 && (
            <div className="ml-1 flex flex-col gap-0.5 border-l border-surface-border pl-3 pt-1 pb-1">
              {s.headings.map(h => (
                <a key={h.id} href={`#${h.id}`} className="text-muted no-underline hover:text-foreground">
                  {h.text}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

export default function DocsPage() {
  const sections = loadDocSections();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-12 px-6 py-12 sm:py-16">
        <aside className="sticky top-[66px] hidden h-fit w-52 shrink-0 self-start lg:block">
          <Toc sections={sections} />
        </aside>
        <main className="min-w-0 max-w-3xl flex-1">
          <Link href="/" className="text-sm text-muted no-underline hover:text-foreground">
            ← Back to Doppo
          </Link>
          <h1 className="mt-6 mb-1 font-display text-3xl font-semibold tracking-tight text-foreground">
            Docs
          </h1>
          <p className="m-0 text-sm text-muted">
            The interim reference while Doppo is in beta. Sections are linkable; send someone
            exactly the part they asked about.
          </p>
          <div className="mt-6 rounded-md border border-surface-border p-4 lg:hidden">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">On this page</p>
            <Toc sections={sections} />
          </div>
          <div className={cn("mt-4", PROSE_CLASSES)}>
            {sections.map(s => (
              <section key={s.slug}>
                <h2 id={s.slug} className="scroll-mt-16">{s.title}</h2>
                <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {s.body}
                </Markdown>
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
