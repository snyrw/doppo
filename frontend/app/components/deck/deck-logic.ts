export type StepDir = -1 | 1;
export type NavIntent = "next" | "prev" | "first" | "last";

export function clampIndex(i: number, count: number): number {
  if (i < 0) return 0;
  if (i > count - 1) return count - 1;
  return i;
}

export function nextIndex(active: number, dir: StepDir, count: number): number {
  return clampIndex(active + dir, count);
}

export function intentToIndex(intent: NavIntent, active: number, count: number): number {
  switch (intent) {
    case "next": return clampIndex(active + 1, count);
    case "prev": return clampIndex(active - 1, count);
    case "first": return 0;
    case "last": return count - 1;
  }
}

export function indexToId(i: number, sections: readonly { id: string }[]): string {
  return sections[i]?.id ?? sections[0].id;
}

export function idToIndex(hashOrId: string, sections: readonly { id: string }[]): number {
  const id = hashOrId.startsWith("#") ? hashOrId.slice(1) : hashOrId;
  if (!id) return -1;
  return sections.findIndex((s) => s.id === id);
}

export function keyToIntent(key: string): NavIntent | null {
  switch (key) {
    case "ArrowDown":
    case "PageDown": return "next";
    case "ArrowUp":
    case "PageUp": return "prev";
    case "Home": return "first";
    case "End": return "last";
    default: return null;
  }
}

export function isTypingTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
