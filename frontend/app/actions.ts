"use server";

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { heatmapCache } from "./schema";
import { putHeatmap, getHeatmap } from "./lib/r2";

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
