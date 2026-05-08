import Navbar from "./components/Navbar";
import Link from "next/link";

// Hardcoded specimen data
// Prompt: "The Eiffel Tower is located in the city of"
// Heatmap shows P(correct next token) at each [layer][position]
const TOKENS = ["The", "Eiffel", "Tower", "is", "located", "in", "the", "city"];
const LAYERS = ["emb", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

const PROBS: number[][] = [
  [0.07, 0.58, 0.42, 0.31, 0.09, 0.14, 0.22, 0.11],
  [0.09, 0.69, 0.55, 0.38, 0.12, 0.18, 0.28, 0.15],
  [0.12, 0.77, 0.67, 0.46, 0.16, 0.23, 0.35, 0.20],
  [0.16, 0.83, 0.76, 0.55, 0.21, 0.30, 0.43, 0.27],
  [0.21, 0.88, 0.83, 0.63, 0.28, 0.38, 0.52, 0.35],
  [0.27, 0.91, 0.88, 0.70, 0.35, 0.47, 0.61, 0.44],
  [0.33, 0.93, 0.91, 0.76, 0.42, 0.56, 0.69, 0.54],
  [0.39, 0.95, 0.93, 0.81, 0.49, 0.64, 0.76, 0.63],
  [0.45, 0.96, 0.95, 0.85, 0.55, 0.71, 0.82, 0.71],
  [0.50, 0.97, 0.96, 0.88, 0.61, 0.77, 0.87, 0.78],
  [0.54, 0.97, 0.97, 0.90, 0.66, 0.82, 0.90, 0.84],
  [0.58, 0.98, 0.98, 0.92, 0.70, 0.86, 0.93, 0.89],
];

const CELL_W = 38;
const CELL_H = 20;
const LABEL_W = 34;
const CELL_GAP = 3;

function Specimen() {
  return (
    <div
      style={{
        background: "var(--color-bg)",
        border: "1.5px solid var(--color-card-border)",
        borderRadius: 12,
        padding: "22px 22px 14px",
        display: "inline-block",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: CELL_GAP }}>
        {/* X-axis token labels — 50px container accommodates 45° rotated text */}
        <div style={{ display: "flex", gap: CELL_GAP }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }} />
          {TOKENS.map((tok, i) => (
            <div
              key={i}
              style={{
                width: CELL_W,
                height: 50,
                flexShrink: 0,
                display: "flex",
                alignItems: "flex-end",
                overflow: "hidden",
                paddingLeft: 3,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-geist-mono), monospace",
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  transform: "rotate(-45deg)",
                  transformOrigin: "left bottom",
                  display: "block",
                  lineHeight: 1,
                }}
              >
                {tok}
              </span>
            </div>
          ))}
        </div>

        {/* Heatmap rows */}
        {LAYERS.map((layer, yIdx) => (
          <div key={layer} style={{ display: "flex", alignItems: "center", gap: CELL_GAP }}>
            <div
              style={{
                width: LABEL_W,
                flexShrink: 0,
                fontSize: 9,
                fontFamily: "var(--font-geist-mono), monospace",
                paddingRight: 6,
                textAlign: "right",
                color: "var(--color-text-muted)",
                userSelect: "none",
              }}
            >
              {layer}
            </div>
            {PROBS[yIdx].map((prob, xIdx) => (
              <div
                key={xIdx}
                style={{
                  width: CELL_W,
                  height: CELL_H,
                  flexShrink: 0,
                  backgroundColor: `rgba(var(--heatmap-rgb), ${prob})`,
                  borderRadius: 3,
                  boxSizing: "border-box",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Caption */}
      <p
        style={{
          marginTop: 14,
          marginBottom: 0,
          fontSize: 10,
          fontFamily: "var(--font-geist-mono), monospace",
          color: "var(--color-text-muted)",
          opacity: 0.65,
          letterSpacing: "0.02em",
        }}
      >
        // GPT-2 Small · &ldquo;The Eiffel Tower is located in the city of&rdquo;
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      <Navbar />

      <main
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Center rule */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "12%",
            bottom: "12%",
            width: 1,
            background: "var(--color-surface-border)",
            pointerEvents: "none",
          }}
        />

        {/* Left: Text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 60px 0 80px",
            gap: 0,
          }}
        >
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--color-text-muted)",
              margin: "0 0 18px",
            }}
          >
            logit lens visualization
          </p>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "var(--font-fraunces), Georgia, serif",
              fontSize: "clamp(36px, 3.2vw, 50px)",
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "var(--color-text)",
              margin: "0 0 22px",
            }}
          >
            Watch token predictions form,<br /><em>layer by layer.</em>
          </h1>

          {/* Description */}
          <p
            style={{
              fontFamily: "var(--font-azeret-mono), monospace",
              fontSize: 13,
              lineHeight: 2.0,
              color: "var(--color-text-muted)",
              margin: "0 0 34px",
              maxWidth: 360,
            }}
          >
            Models from HuggingFace Hub,
            GPU-accelerated via Modal. Results in
            seconds. No code, no notebooks.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44 }}>
            <Link
              href="/projects"
              className="btn-accent"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 20px",
                borderRadius: 6,
                fontFamily: "var(--font-azeret-mono), monospace",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.02em",
                textDecoration: "none",
              }}
            >
              <span aria-hidden>→</span> Open Sandbox
            </Link>
          </div>

          {/* Feature tags */}
          <div
            style={{
              display: "flex",
              gap: 20,
              paddingTop: 20,
              borderTop: "1px solid var(--color-surface-border)",
              flexWrap: "wrap",
            }}
          >
            {["TransformerLens 3.0 models", "Every layer", "GPU-accelerated", "Saved projects"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontFamily: "var(--font-azeret-mono), monospace",
                  fontSize: 10,
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.04em",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Specimen */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 64px",
            backgroundImage: "radial-gradient(circle, var(--color-surface-border) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            borderLeft: "1px solid var(--color-surface-border)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
            {/* Fig. 1 label */}
            <div>
              <p
                style={{
                  fontFamily: "var(--font-azeret-mono), monospace",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  margin: "0 0 3px",
                  opacity: 0.5,
                }}
              >
                Fig. 1
              </p>
              <p
                style={{
                  fontFamily: "var(--font-azeret-mono), monospace",
                  fontSize: 10,
                  color: "var(--color-text-muted)",
                  margin: 0,
                  opacity: 0.75,
                }}
              >
                Token probability by layer — GPT-2 Small
              </p>
            </div>

            <Specimen />

            {/* Annotation */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingLeft: LABEL_W + 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 10,
                    background: "rgba(var(--heatmap-rgb), 0.92)",
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                  }}
                >
                  High confidence — model predicts next token
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 10,
                    background: "rgba(var(--heatmap-rgb), 0.1)",
                    borderRadius: 2,
                    border: "0.5px solid var(--color-surface-border)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-azeret-mono), monospace",
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                  }}
                >
                  Low confidence — representation still forming
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
