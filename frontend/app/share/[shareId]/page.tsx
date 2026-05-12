import { notFound } from "next/navigation";
import { loadPublicProject } from "../../actions";
import Navbar from "../../components/Navbar";
import ShareCanvas from "./ShareCanvas";
import type { LensCardData } from "../../components/LensCard";
import type { DlaCardData } from "../../components/DlaCard";
import type { AttributionCardData } from "../../components/AttributionCard";
import type { ActivationCardData } from "../../components/ActivationCard";
import type { AnyCard } from "../../components/SandboxCanvas";

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const project = await loadPublicProject(shareId);
  if (!project) notFound();

  const cards: AnyCard[] = project.cards.map(c => {
    if (c.cardType === "dla") {
      return { ...c, cardType: "dla" as const, status: "result" as const, error: null } as DlaCardData;
    }
    if (c.cardType === "attribution") {
      return {
        ...c, cardType: "attribution" as const, status: "result" as const, error: null,
        cleanPrompt: c.prompt, corruptedPrompt: c.corruptedPrompt ?? "",
        targetPosition: c.targetPosition ?? "last", targetToken: c.targetToken ?? null,
        verifyStatus: "idle" as const,
      } as unknown as AttributionCardData;
    }
    if (c.cardType === "activation") {
      return {
        ...c, cardType: "activation" as const, status: "result" as const, error: null,
        cleanPrompt: c.prompt, k: 10, parentAttributionId: c.parentAttributionId ?? "",
      } as unknown as ActivationCardData;
    }
    return { ...c, cardType: "logit-lens" as const, status: "result" as const, error: null } as LensCardData;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <Navbar />
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 16px",
        height: 40,
        borderBottom: "1px solid var(--color-surface-border)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
          {project.name}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: "var(--color-text-muted)",
          background: "var(--color-surface-border)",
          border: "1px solid var(--color-card-border)",
          borderRadius: 3,
          padding: "1px 6px",
        }}>
          read-only
        </span>
        <a
          href="/projects"
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "var(--color-text-muted)",
            textDecoration: "none",
          }}
        >
          Open in app →
        </a>
      </div>
      <ShareCanvas cards={cards} canvas={project.canvas} />
    </div>
  );
}
