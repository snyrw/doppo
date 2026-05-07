"use server";

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
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
  modelName: string;
  prompt: string;
  data: HeatmapData;
  position: { x: number; y: number };
  gpuTier?: string;
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
): Promise<{ cards: SerializedCard[]; canvas: CanvasState } | null> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({ cards: project.cards, canvas: project.canvas })
    .from(project)
    .where(and(eq(project.id, projectId), eq(project.userId, userId)))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    cards: rows[0].cards as SerializedCard[],
    canvas: rows[0].canvas as CanvasState,
  };
}
