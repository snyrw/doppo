import fs from "fs";
import path from "path";
import matter from "gray-matter";

// Interim docs (/docs) content loader. Content lives in app/docs/content/ as
// numbered markdown files; each needs `title` frontmatter. Anchor ids for the
// section titles and every `##` heading come from slugify(), and the same
// function runs at render time in app/docs/page.tsx — keep them in sync by
// only ever slugging through this export.
const CONTENT_DIR = path.join(process.cwd(), "app/docs/content");

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type DocHeading = { text: string; id: string };

export type DocSection = {
  slug: string;
  title: string;
  body: string;
  headings: DocHeading[];
};

export function extractHeadings(body: string): DocHeading[] {
  const out: DocHeading[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^## (.+)$/);
    if (m) out.push({ text: m[1].trim(), id: slugify(m[1]) });
  }
  return out;
}

export function loadDocSections(dir: string = CONTENT_DIR): DocSection[] {
  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith(".md"))
    .sort();

  const sections = files.map(filename => {
    const raw = fs.readFileSync(path.join(dir, filename), "utf8");
    const { data, content } = matter(raw);
    const title = data.title as string | undefined;
    if (!title) throw new Error(`docs content ${filename}: missing title frontmatter`);
    const body = content.trim();
    return { slug: slugify(title), title, body, headings: extractHeadings(body) };
  });

  // Anchor ids must be unique across the whole page or deep links break
  // silently. Failing the build is the cheapest guard.
  const seen = new Set<string>();
  for (const s of sections) {
    for (const id of [s.slug, ...s.headings.map(h => h.id)]) {
      if (seen.has(id)) throw new Error(`docs content: duplicate anchor id "${id}"`);
      seen.add(id);
    }
  }
  return sections;
}
