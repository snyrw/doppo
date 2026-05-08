import Navbar from "./components/Navbar";
import HeroSpecimen from "./components/HeroSpecimen";
import Link from "next/link";

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
          <HeroSpecimen />
        </div>
      </main>
    </div>
  );
}
