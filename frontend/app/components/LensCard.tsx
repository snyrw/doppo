"use client";

import React from "react";

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
};

export type LensCardData = {
  id: string;
  status: "loading" | "result" | "error";
  modelName: string;
  prompt: string;
  data: HeatmapData | null;
  error: string | null;
  position: { x: number; y: number };
};

type LensCardProps = {
  card: LensCardData;
  ref?: React.Ref<HTMLDivElement>;
  onStartDrag: (e: React.PointerEvent<HTMLDivElement>, cardId: string, pos: { x: number; y: number }) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
};

function simplifyLayerLabel(raw: string): string {
  if (raw === "embedding") return "emb";
  const match = raw.match(/\.(\d+)\./);
  return match ? match[1] : raw;
}

export default function LensCard({
  card,
  ref,
  onStartDrag,
  onDragMove,
  onDragEnd,
  onRemove,
  onEdit,
}: LensCardProps) {
  const shortPrompt = card.prompt.length > 38 ? card.prompt.slice(0, 38) + "…" : card.prompt;

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: card.position.x,
        top: card.position.y,
        zIndex: 10,
        background: "#ffffff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        display: "flex",
        flexDirection: "column",
        // Fixed size while loading, auto-size when result renders
        ...(card.status === "loading" ? { width: 280, height: 200 } : {}),
        ...(card.status === "error" ? { width: 280 } : {}),
      }}
    >
      {/* Drag handle / header */}
      <div
        onPointerDown={e => onStartDrag(e, card.id, card.position)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        style={{
          padding: "7px 10px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "grab",
          userSelect: "none",
          flexShrink: 0,
          borderRadius: "8px 8px 0 0",
        }}
      >
        {/* Grip dots */}
        <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ opacity: 0.3, flexShrink: 0 }}>
          <circle cx="2" cy="2" r="1.2" fill="#374151" />
          <circle cx="6" cy="2" r="1.2" fill="#374151" />
          <circle cx="2" cy="6" r="1.2" fill="#374151" />
          <circle cx="6" cy="6" r="1.2" fill="#374151" />
          <circle cx="2" cy="10" r="1.2" fill="#374151" />
          <circle cx="6" cy="10" r="1.2" fill="#374151" />
        </svg>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.modelName}
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af", flex: "0 0 auto", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shortPrompt}
        </span>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onEdit(card.id)}
          style={{ fontSize: 10, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 3, flexShrink: 0 }}
        >
          Edit
        </button>
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onRemove(card.id)}
          style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      {card.status === "loading" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{
            width: 24, height: 24,
            border: "2px solid #dbeafe",
            borderTopColor: "#2563eb",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: 11, color: "#9ca3af" }}>Running model…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {card.status === "error" && (
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 11, color: "#dc2626" }}>✗ {card.error ?? "Unknown error"}</p>
        </div>
      )}

      {card.status === "result" && card.data && (
        <div style={{ overflow: "auto", padding: 6 }}>
          <div style={{ display: "inline-block" }}>
            {/* X-axis labels */}
            <div style={{ display: "flex" }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              {card.data.x_labels.map((token, i) => (
                <div
                  key={i}
                  style={{
                    width: 24, flexShrink: 0,
                    fontSize: 9, textAlign: "center",
                    fontFamily: "monospace", color: "#6b7280",
                    transform: "rotate(-45deg)",
                    transformOrigin: "bottom left",
                    paddingBottom: 6,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {token}
                </div>
              ))}
            </div>
            {/* Heatmap rows */}
            {card.data.y_labels.map((layerName, yIndex) => (
              <div key={layerName} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ width: 32, flexShrink: 0, fontSize: 9, color: "#9ca3af", fontFamily: "monospace", paddingRight: 4, textAlign: "right" }}>
                  {simplifyLayerLabel(layerName)}
                </div>
                {card.data!.heatmap_data[yIndex].map((prob, xIndex) => (
                  <div
                    key={`${yIndex}-${xIndex}`}
                    title={`Token: ${card.data!.x_labels[xIndex]}\nLayer: ${layerName}\nProb: ${(prob * 100).toFixed(2)}%`}
                    style={{
                      width: 24, height: 12, flexShrink: 0,
                      backgroundColor: `rgba(59, 130, 246, ${prob})`,
                      border: "0.5px solid rgba(229,231,235,0.5)",
                      position: "relative",
                      cursor: "pointer",
                    }}
                    className="group"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
