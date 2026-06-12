"use client";

import { useState, useEffect, useRef } from "react";
import { listProjects } from "../actions";
import type { ProjectSummary } from "../actions";

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
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.52)",
          zIndex: 50,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "all" : "none",
          transition: "opacity 160ms ease",
        }}
      />

      {/* Palette */}
      <div
        onKeyDown={handleKeyDown}
        style={{
          position: "fixed",
          top: "18%",
          left: "50%",
          transform: `translateX(-50%) scale(${isOpen ? 1 : 0.97})`,
          width: 580,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--color-card)",
          borderRadius: 10,
          boxShadow:
            "0 0 0 1px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.1), 0 32px 64px rgba(15,23,42,0.14)",
          zIndex: 51,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "all" : "none",
          transition: "opacity 160ms ease, transform 160ms ease",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Input row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            height: 56,
            borderBottom: "1px solid var(--color-surface-border)",
            flexShrink: 0,
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search projects…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "var(--color-text)",
              background: "transparent",
              caretColor: "var(--color-accent)",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSelectedIndex(0); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-muted)",
                fontSize: 18,
                lineHeight: 1,
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", maxHeight: 420 }}>
          {loading && (
            <div style={{ padding: "36px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              Loading…
            </div>
          )}

          {!loading && fetchError === "unauthorized" && (
            <div style={{ padding: "36px 16px", textAlign: "center" }}>
              <div style={{ color: "var(--color-text)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                Sign in to search projects
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
                Your saved projects will appear here.
              </div>
            </div>
          )}

          {!loading && fetchError === "failed" && (
            <div style={{ padding: "36px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              Could not load projects. Try again.
            </div>
          )}

          {!loading && !fetchError && filtered.length === 0 && (
            <div style={{ padding: "36px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
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
        <div
          style={{
            borderTop: "1px solid var(--color-surface-border)",
            padding: "7px 16px",
            display: "flex",
            gap: 16,
            flexShrink: 0,
          }}
        >
          {(
            [
              ["↑↓", "navigate"],
              ["↵", "open"],
              ["esc", "dismiss"],
            ] as [string, string][]
          ).map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <kbd
                style={{
                  background: "var(--color-surface-border)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: 4,
                  padding: "1px 5px",
                  fontSize: 11,
                  fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                  color: "var(--color-text-muted)",
                  lineHeight: "16px",
                }}
              >
                {key}
              </kbd>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{label}</span>
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
      <div
        style={{
          padding: "8px 16px 3px",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--color-text-muted)",
          letterSpacing: "0.09em",
          textTransform: "uppercase",
        }}
      >
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
  const [hovered, setHovered] = useState(false);

  const bg = isSelected || hovered ? "var(--color-surface-border)" : isCurrent ? "var(--color-panel)" : "var(--color-card)";
  const leftBorder = isCurrent
    ? "3px solid var(--color-accent)"
    : isSelected || hovered
    ? "3px solid var(--color-card-border)"
    : "3px solid transparent";

  return (
    <div
      data-index={flatIndex}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "8px 16px 8px 13px",
        cursor: "pointer",
        background: bg,
        borderLeft: leftBorder,
        transition: "background 80ms, border-color 80ms",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Top line: name + chips + metadata */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {project.name}
          </span>
          {project.models.slice(0, 3).map(m => (
            <span
              key={m}
              style={{
                fontSize: 10,
                fontFamily: "var(--font-ibm-plex-sans), sans-serif",
                background: "var(--color-surface-border)",
                color: "var(--color-accent)",
                padding: "1px 5px",
                borderRadius: 3,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {shortModelName(m)}
            </span>
          ))}
          {project.models.length > 3 && (
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", flexShrink: 0 }}>
              +{project.models.length - 3}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {project.cardCount > 0 && (
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              {project.cardCount} {project.cardCount === 1 ? "card" : "cards"}
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {relativeTime(project.updatedAt)}
          </span>
        </div>
      </div>

      {/* Second line: first prompt */}
      {project.firstPrompt && (
        <div
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {project.firstPrompt}
        </div>
      )}
    </div>
  );
}
