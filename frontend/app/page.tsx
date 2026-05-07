import Navbar from "./components/Navbar";
import Link from "next/link";

const COLS = 28;
const ROWS = 16;
const TOTAL = COLS * ROWS;

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0d1117",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Navbar />

      {/* Animated heatmap background */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          top: 50,
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const duration = (2.5 + (i * 0.17) % 3.5).toFixed(2);
          const delay = ((i * 0.23) % 5).toFixed(2);
          return (
            <div
              key={i}
              style={{
                backgroundColor: "rgba(88, 166, 255, 0.35)",
                animation: `heatPulse ${duration}s ${delay}s ease-in-out infinite`,
                borderRight: "1px solid rgba(33, 38, 45, 0.5)",
                borderBottom: "1px solid rgba(33, 38, 45, 0.5)",
              }}
            />
          );
        })}
      </div>

      {/* Radial vignette — keeps the center slightly transparent, edges opaque */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          top: 50,
          background:
            "radial-gradient(ellipse 85% 75% at 50% 50%, rgba(13,17,23,0.1) 0%, rgba(13,17,23,0.94) 78%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          position: "relative",
          zIndex: 2,
          padding: "0 24px",
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "#484f58",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Mechanistic Interpretability
        </span>

        <h1
          style={{
            fontSize: "clamp(44px, 8vw, 80px)",
            fontWeight: 700,
            color: "#e6edf3",
            margin: 0,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          logitlensviz
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#7d8590",
            margin: 0,
            textAlign: "center",
            maxWidth: 400,
            lineHeight: 1.65,
          }}
        >
          open source logit lens visualization
          <br />
          for language model internals
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            disabled
            style={{
              padding: "9px 22px",
              borderRadius: 6,
              border: "1px solid #21262d",
              background: "transparent",
              color: "#484f58",
              fontSize: 13,
              fontWeight: 500,
              cursor: "not-allowed",
              letterSpacing: "0.03em",
              fontFamily: "inherit",
            }}
          >
            Tutorial
          </button>
          <Link
            href="/projects"
            style={{
              padding: "9px 22px",
              borderRadius: 6,
              border: "none",
              background: "#58a6ff",
              color: "#0d1117",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              letterSpacing: "0.03em",
              display: "inline-block",
            }}
          >
            Open Projects →
          </Link>
        </div>
      </main>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: 20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 0,
          fontSize: 10,
          color: "#484f58",
          letterSpacing: "0.12em",
          pointerEvents: "none",
          zIndex: 2,
        }}
      >
        <span>TransformerLens 3.0</span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>·</span>
        <span>~9,000 models</span>
        <span style={{ margin: "0 12px", opacity: 0.4 }}>·</span>
        <span>no-code</span>
      </div>
    </div>
  );
}
