"use server";

import { createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { heatmapCache } from "./schema";

export async function runLensWithCache(prompt: string, modelName: string) {
  const cached = await db
    .select({ heatmapData: heatmapCache.heatmapData })
    .from(heatmapCache)
    .where(and(eq(heatmapCache.prompt, prompt), eq(heatmapCache.modelName, modelName)))
    .limit(1);

  if (cached.length > 0) {
    return cached[0].heatmapData;
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
  await db
    .insert(heatmapCache)
    .values({ id, prompt, modelName, heatmapData: data })
    .onConflictDoNothing();

  return data;
}
