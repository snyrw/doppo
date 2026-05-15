"use server";

import { createHash } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "./db";
import { heatmapCache, project } from "./schema";
import { putHeatmap, getHeatmap } from "./lib/r2";
import { auth } from "./lib/auth";

export async function runLensWithCache(prompt: string, modelName: string) {
  const cached = await db
    .select({ id: heatmapCache.id, r2Key: heatmapCache.r2Key })
    .from(heatmapCache)
    .where(and(eq(heatmapCache.prompt, prompt), eq(heatmapCache.modelName, modelName)))
    .limit(1);

  if (cached.length > 0 && cached[0].r2Key) {
    db.update(heatmapCache)
      .set({ lastAccessedAt: new Date() })
      .where(eq(heatmapCache.id, cached[0].id))
      .catch(console.error);
    return getHeatmap(cached[0].r2Key);
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/run-lens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model_name: modelName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { detail?: string }).detail ?? `Request failed with status ${response.status}`);
  }

  const data = await response.json();

  const id = createHash("sha256").update(`${modelName}:${prompt}`).digest("hex");
  try {
    await putHeatmap(id, data);
    await db
      .insert(heatmapCache)
      .values({ id, prompt, modelName, r2Key: id })
      .onConflictDoNothing();
  } catch (err) {
    console.error("Cache write failed:", err);
  }

  return data;
}

type HeatmapData = {
  x_labels: string[];
  y_labels: string[];
  heatmap_data: number[][];
  topk_tokens?: string[][][];
  topk_probs?: number[][][];
};

type SerializedCard = {
  id: string;
  cardType?: string;
  modelName: string;
  prompt: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  gpuTier?: string;
  targetPosition?: number | "last";
  targetToken?: string | null;
  contrastiveToken?: string | null;
  corruptedPrompt?: string;       // attribution cards
  parentAttributionId?: string;   // activation cards
  // steering cards
  components?: Array<{ layer: number; head: number | null; injectionType: string }>;
  alpha?: number;
  temperature?: number;
  repetitionPenalty?: number;
  nTokens?: number;
  nPairs?: number;
  extraPairs?: Array<{ clean: string; corrupted: string }>;
  parentCardId?: string;
  generationPrompt?: string;
};

type CanvasState = {
  panOffset: { x: number; y: number };
  zoom: number;
};

async function getAuthedUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createProject(
  cards: SerializedCard[],
  canvas: CanvasState
): Promise<{ id: string }> {
  const userId = await getAuthedUserId();
  const id = crypto.randomUUID();
  await db.insert(project).values({ id, userId, cards, canvas });
  return { id };
}

export async function duplicateProject(
  cards: SerializedCard[],
  canvas: CanvasState
): Promise<{ id: string }> {
  return createProject(cards, canvas);
}

export async function deleteProject(projectId: string): Promise<void> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Project not found");
  await db.delete(project).where(eq(project.id, projectId));
}

export async function loadProject(
  projectId: string
): Promise<{ name: string; cards: SerializedCard[]; canvas: CanvasState; shareId: string | null } | null> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({ name: project.name, cards: project.cards, canvas: project.canvas, shareId: project.shareId })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    name: rows[0].name,
    cards: rows[0].cards as SerializedCard[],
    canvas: rows[0].canvas as CanvasState,
    shareId: rows[0].shareId ?? null,
  };
}

export async function setProjectShare(projectId: string): Promise<{ shareId: string }> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({ shareId: project.shareId })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Project not found");
  if (rows[0].shareId) {
    await db.update(project).set({ isPublic: true, updatedAt: new Date() }).where(eq(project.id, projectId));
    return { shareId: rows[0].shareId };
  }
  const shareId = crypto.randomUUID();
  await db.update(project).set({ isPublic: true, shareId, updatedAt: new Date() }).where(eq(project.id, projectId));
  return { shareId };
}

export async function loadPublicProject(
  shareId: string
): Promise<{ name: string; cards: SerializedCard[]; canvas: CanvasState } | null> {
  const rows = await db
    .select({ name: project.name, cards: project.cards, canvas: project.canvas })
    .from(project)
    .where(and(eq(project.shareId, shareId), eq(project.isPublic, true)))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    name: rows[0].name,
    cards: rows[0].cards as SerializedCard[],
    canvas: rows[0].canvas as CanvasState,
  };
}

export async function updateProject(
  projectId: string,
  cards: SerializedCard[],
  canvas: CanvasState,
  name?: string
): Promise<void> {
  const userId = await getAuthedUserId();
  await db
    .update(project)
    .set({
      cards,
      canvas,
      updatedAt: new Date(),
      ...(name !== undefined ? { name } : {}),
    })
    .where(and(eq(project.id, projectId), eq(project.userId, userId)));
}

export type ProjectSummary = {
  id: string;
  name: string;
  updatedAt: Date;
  cardCount: number;
  models: string[];
  firstPrompt: string | null;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      cards: project.cards,
    })
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt));

  return rows.map(row => {
    const cards = (row.cards ?? []) as SerializedCard[];
    const models = [...new Set(cards.map(c => c.modelName))];
    return {
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      cardCount: cards.length,
      models,
      firstPrompt: cards[0]?.prompt ?? null,
    };
  });
}
