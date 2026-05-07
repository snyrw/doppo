"use client";

type SnapGridProps = {
  isDragging: boolean;
};

export default function SnapGrid({ isDragging }: SnapGridProps) {
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: isDragging ? 0.5 : 0,
        transition: "opacity 150ms ease",
      }}
    >
      <defs>
        <pattern id="snap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="rgba(88, 166, 255, 0.35)"
            strokeWidth="0.5"
            strokeDasharray="2 6"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#snap-grid)" />
    </svg>
  );
}
