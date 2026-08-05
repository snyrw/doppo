"use server";

import { eq, and, desc, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "./db";
import { project, creditLedger, user as userTable, attnCache } from "./schema";
import { auth } from "./lib/auth";
import { buildDataExport, type DataExport } from "./lib/data-export";
import { getHeatmap } from "./lib/r2";
import {
  saveSteeringPairSetForUser,
  listSteeringPairSetSummariesForUser,
  loadSteeringPairSetForUser,
  deleteSteeringPairSetForUser,
  type ExtraPair,
  type SteeringPairSetSummary,
  type SteeringPairSetDetail,
} from "./lib/steering-presets";

type SerializedCard = {
  id: string;
  cardType?: string;
  modelName: string;
  prompt: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  gpuTier?: string;
  topK?: number;                  // logit-lens cards
  targetPosition?: number | "last";
  targetToken?: string | null;
  contrastiveToken?: string | null;
  corruptedPrompt?: string;       // attribution cards
  parentAttributionId?: string;   // activation cards
  // steering cards (head/injectionType are legacy fields still present on old rows)
  components?: Array<{ layer: number; head?: number | null; injectionType?: string }>;
  alpha?: number;
  temperature?: number;
  repetitionPenalty?: number;
  nTokens?: number;
  nPairs?: number;
  extraPairs?: Array<{ clean: string; corrupted: string }>;
  generationPrompt?: string;
  cacheKey?: string | null;       // attention-pattern cards: reference into attnCache, data omitted
};

type CanvasState = import("./components/SandboxCanvas").CanvasState;

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
  await db.delete(project).where(and(eq(project.id, projectId), eq(project.userId, userId)));
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

/** Rehydrates an attention card's pattern data from its cache reference. Owner-only. */
export async function getAttnCacheData(cacheKey: string): Promise<unknown | null> {
  const userId = await getAuthedUserId();
  const rows = await db
    .select({ r2Key: attnCache.r2Key, userId: attnCache.userId })
    .from(attnCache)
    .where(eq(attnCache.id, cacheKey))
    .limit(1);
  if (rows.length === 0 || rows[0].userId !== userId || !rows[0].r2Key) return null;
  return getHeatmap(rows[0].r2Key);
}

/** Same as `getAttnCacheData` but for public share views — no session, no ownership check. */
export async function getPublicAttnCacheData(cacheKey: string): Promise<unknown | null> {
  const rows = await db
    .select({ r2Key: attnCache.r2Key })
    .from(attnCache)
    .where(eq(attnCache.id, cacheKey))
    .limit(1);
  if (rows.length === 0 || !rows[0].r2Key) return null;
  return getHeatmap(rows[0].r2Key);
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
    await db.update(project).set({ isPublic: true, updatedAt: new Date() }).where(and(eq(project.id, projectId), eq(project.userId, userId)));
    return { shareId: rows[0].shareId };
  }
  const shareId = crypto.randomUUID();
  await db.update(project).set({ isPublic: true, shareId, updatedAt: new Date() }).where(and(eq(project.id, projectId), eq(project.userId, userId)));
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

/**
 * Upserts a single card into a project's `cards` array by id, atomically.
 * Unlike `updateProject`, this doesn't overwrite the whole array from a
 * client-held snapshot: it's a single UPDATE whose SET expression reads and
 * rewrites `cards` in one statement, so concurrent calls (e.g. two cards
 * resolving close together) serialize on Postgres's row lock instead of
 * racing to overwrite each other's client snapshot.
 */
export async function upsertProjectCard(
  projectId: string,
  card: SerializedCard,
  canvas: CanvasState
): Promise<void> {
  const userId = await getAuthedUserId();
  const cardJson = JSON.stringify(card);
  await db.execute(sql`
    update project
    set
      cards = case
        when exists (select 1 from jsonb_array_elements(cards) e where e->>'id' = ${card.id})
        then (
          select jsonb_agg(case when e->>'id' = ${card.id} then ${cardJson}::jsonb else e end)
          from jsonb_array_elements(cards) e
        )
        else cards || jsonb_build_array(${cardJson}::jsonb)
      end,
      canvas = ${JSON.stringify(canvas)}::jsonb,
      updated_at = now()
    where id = ${projectId} and user_id = ${userId}
  `);
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

export async function getCreditLedger() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return db
    .select({
      type: creditLedger.type,
      amountMicros: creditLedger.amountMicros,
      jobTier: creditLedger.jobTier,
      jobDurationMs: creditLedger.jobDurationMs,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, session.user.id))
    .orderBy(desc(creditLedger.createdAt))
    .limit(100);
}

export async function exportMyData(): Promise<DataExport> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  const uid = session.user.id;

  const [u] = await db.select({ name: userTable.name, email: userTable.email, emailVerified: userTable.emailVerified, createdAt: userTable.createdAt }).from(userTable).where(eq(userTable.id, uid));
  if (!u) throw new Error("User not found");
  const projects = await db.select({ id: project.id, name: project.name, cards: project.cards, canvas: project.canvas, createdAt: project.createdAt, updatedAt: project.updatedAt }).from(project).where(eq(project.userId, uid));
  const ledger = await getCreditLedger();

  return buildDataExport(u, projects as DataExport["projects"], ledger);
}

export async function saveSteeringPairSet(
  name: string,
  cleanPrompt: string,
  corruptedPrompt: string,
  extraPairs: ExtraPair[]
): Promise<{ id: string }> {
  const userId = await getAuthedUserId();
  return saveSteeringPairSetForUser(userId, name, cleanPrompt, corruptedPrompt, extraPairs);
}

export async function listSteeringPairSetSummaries(): Promise<SteeringPairSetSummary[]> {
  const userId = await getAuthedUserId();
  return listSteeringPairSetSummariesForUser(userId);
}

export async function loadSteeringPairSet(id: string): Promise<SteeringPairSetDetail> {
  const userId = await getAuthedUserId();
  return loadSteeringPairSetForUser(userId, id);
}

export async function deleteSteeringPairSet(id: string): Promise<void> {
  const userId = await getAuthedUserId();
  return deleteSteeringPairSetForUser(userId, id);
}
