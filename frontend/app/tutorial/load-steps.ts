import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { TutorialStep, TutorialLink } from "./steps";

const CONTENT_DIR = path.join(process.cwd(), "app/tutorial/content");

type Paragraph = string | { type: "image"; src: string; alt: string };

function parseBody(body: string): {
  paragraphs: Paragraph[];
  whatToNotice?: string;
  caveat?: string;
} {
  const sections = body.split(/^## /m);

  const paraSection = sections[0].trim();
  let whatToNotice: string | undefined;
  let caveat: string | undefined;

  for (let i = 1; i < sections.length; i++) {
    const newlineIdx = sections[i].indexOf("\n");
    const heading = sections[i].slice(0, newlineIdx).trim().toLowerCase();
    const content = sections[i].slice(newlineIdx).trim();
    if (heading === "what to notice") whatToNotice = content;
    else if (heading === "caveat") caveat = content;
  }

  const paragraphs = paraSection
    .split(/\n\n+/)
    .map(p => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map((p): Paragraph => {
      const imgMatch = p.match(/^!\[(.+?)\]\((.+?)\)$/);
      if (imgMatch) return { type: "image", src: imgMatch[2], alt: imgMatch[1] };
      return p;
    });

  return { paragraphs, whatToNotice, caveat };
}

export function loadSteps(): TutorialStep[] {
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith(".md"))
    .sort();

  return files.map(filename => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf8");
    const { data, content } = matter(raw);
    const { paragraphs, whatToNotice, caveat } = parseBody(content);

    return {
      index: data.index as number,
      label: data.label as string,
      badge: data.badge as string | undefined,
      part: data.part as string | undefined,
      cardType: data.cardType as TutorialStep["cardType"],
      configType: data.configType as TutorialStep["configType"],
      heading: data.heading as string,
      paragraphs,
      whatToNotice,
      caveat,
      links: (data.links ?? []) as TutorialLink[],
    };
  });
}
