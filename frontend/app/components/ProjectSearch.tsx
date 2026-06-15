"use client";

import { useState, useEffect, useRef } from "react";
import { listProjects } from "../actions";
import type { ProjectSummary } from "../actions";
import { cn } from "../lib/cn";

function shortModelName(model: string): string {
  const parts = model.split("/");
  return parts[parts.length - 1];
}

function relativeTime(date: Date | string): string {
  const d = new Date(date);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function matchesQuery(p: ProjectSummary, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(lower) ||
    p.models.some(m => m.toLowerCase().includes(lower)) ||
    (p.firstPrompt?.toLowerCase().includes(lower) ?? false)
  );
}

type Props = {
  isOpen: boolean;
  currentProjectId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function ProjectSearch({ isOpen, currentProjectId, onClose, onSelect }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<"unauthorized" | "failed" | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Adjust state when isOpen flips — render-time adjustment per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setFetchError(null);
      setLoading(true);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    listProjects()
      .then(rows => { setProjects(rows); })
      .catch(err => {
        const msg: string = err instanceof Error ? err.message : String(err);
        setFetchError(msg.includes("Unauthorized") ? "unauthorized" : "failed");
        setProjects([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 40);
  }, [isOpen]);

  const filtered = projects.filter(p => matchesQuery(p, query));
  const currentProject = filtered.find(p => p.id === currentProjectId) ?? null;
  const recents = filtered.filter(p => p.id !== currentProjectId).slice(0, 3);
  const rest = filtered.filter(p => p.id !== currentProjectId && !recents.find(r => r.id === p.id));

  // Flat ordered list for keyboard selection
  const flat: ProjectSummary[] = [
    ...(currentProject ? [currentProject] : []),
    ...recents,
    ...rest,
  ];

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const target = flat[selectedIndex];
      if (target) { onSelect(target.id); onClose(); }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 bg-[rgba(15,23,42,0.52)] transition-opacity duration-[160ms]",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Palette */}
      <div
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed left-1/2 top-[18%] z-[51] flex w-[580px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[10px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_8px_24px_rgba(15,23,42,0.1),0_32px_64px_rgba(15,23,42,0.14)] transition-[opacity,transform] duration-[160ms]",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ transform: `translateX(-50%) scale(${isOpen ? 1 : 0.97})` }}
      >
        {/* Input row */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-surface-border px-4">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search projects…"
            className="flex-1 border-none bg-transparent font-[inherit] text-[15px] text-foreground caret-[var(--accent)] outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSelectedIndex(0); }}
              className="flex cursor-pointer items-center border-none bg-transparent px-1 py-0.5 text-lg leading-none text-muted"
            >
              ×
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="py-9 text-center text-[13px] text-muted">
              Loading…
            </div>
          )}

          {!loading && fetchError === "unauthorized" && (
            <div className="px-4 py-9 text-center">
              <div className="mb-1 text-sm font-semibold text-foreground">
                Sign in to search projects
              </div>
              <div className="text-[13px] text-muted">
                Your saved projects will appear here.
              </div>
            </div>
          )}

          {!loading && fetchError === "failed" && (
            <div className="py-9 text-center text-[13px] text-muted">
              Could not load projects. Try again.
            </div>
          )}

          {!loading && !fetchError && filtered.length === 0 && (
            <div className="py-9 text-center text-[13px] text-muted">
              {query ? `No projects matching "${query}"` : "No saved projects yet."}
            </div>
          )}

          {!loading && !fetchError && filtered.length > 0 && (
            <>
              {currentProject && (
                <Section label="Current">
                  <Row
                    project={currentProject}
                    flatIndex={0}
                    isSelected={selectedIndex === 0}
                    isCurrent
                    onSelect={() => { onSelect(currentProject.id); onClose(); }}
                  />
                </Section>
              )}

              {recents.length > 0 && (
                <Section label="Recent">
                  {recents.map((p, i) => {
                    const idx = (currentProject ? 1 : 0) + i;
                    return (
                      <Row
                        key={p.id}
                        project={p}
                        flatIndex={idx}
                        isSelected={selectedIndex === idx}
                        onSelect={() => { onSelect(p.id); onClose(); }}
                      />
                    );
                  })}
                </Section>
              )}

              {rest.length > 0 && (
                <Section label={query ? "Results" : "All Projects"}>
                  {rest.map((p, i) => {
                    const idx = (currentProject ? 1 : 0) + recents.length + i;
                    return (
                      <Row
                        key={p.id}
                        project={p}
                        flatIndex={idx}
                        isSelected={selectedIndex === idx}
                        onSelect={() => { onSelect(p.id); onClose(); }}
                      />
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-4 border-t border-surface-border px-4 py-[7px]">
          {(
            [
              ["↑↓", "navigate"],
              ["↵", "open"],
              ["esc", "dismiss"],
            ] as [string, string][]
          ).map(([key, label]) => (
            <span key={key} className="flex items-center gap-[5px]">
              <kbd className="rounded border border-card-border bg-surface-border px-[5px] py-px text-[11px] leading-4 text-muted">
                {key}
              </kbd>
              <span className="text-[11px] text-muted">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 pb-[3px] pt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  project,
  flatIndex,
  isSelected,
  isCurrent,
  onSelect,
}: {
  project: ProjectSummary;
  flatIndex: number;
  isSelected: boolean;
  isCurrent?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      data-index={flatIndex}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer flex-col gap-[3px] border-l-[3px] py-2 pl-[13px] pr-4 transition-colors",
        isCurrent ? "border-l-accent" : isSelected ? "border-l-card-border" : "border-l-transparent hover:border-l-card-border",
        isSelected ? "bg-surface-border" : isCurrent ? "bg-panel hover:bg-surface-border" : "bg-card hover:bg-surface-border",
      )}
    >
      {/* Top line: name + chips + metadata */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {project.name}
          </span>
          {project.models.slice(0, 3).map(m => (
            <span
              key={m}
              className="shrink-0 whitespace-nowrap rounded-[3px] bg-surface-border px-[5px] py-px text-[10px] text-accent"
            >
              {shortModelName(m)}
            </span>
          ))}
          {project.models.length > 3 && (
            <span className="shrink-0 text-[10px] text-muted">
              +{project.models.length - 3}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {project.cardCount > 0 && (
            <span className="text-[11px] text-muted">
              {project.cardCount} {project.cardCount === 1 ? "card" : "cards"}
            </span>
          )}
          <span className="text-[11px] text-muted">
            {relativeTime(project.updatedAt)}
          </span>
        </div>
      </div>

      {/* Second line: first prompt */}
      {project.firstPrompt && (
        <div className="truncate text-xs text-muted">
          {project.firstPrompt}
        </div>
      )}
    </div>
  );
}
