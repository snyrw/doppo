"use server";

import { eq, and, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "./db";
import { project, creditLedger, user as userTable } from "./schema";
import { auth } from "./lib/auth";
import { buildDataExport, type DataExport } from "./lib/data-export";

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
  // entropy cards
  parentLensId?: string;
  entropyData?: number[][];
  xLabels?: string[];
  yLabels?: string[];
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
  const projects = await db.select({ id: project.id, name: project.name, cards: project.cards, canvas: project.canvas, createdAt: project.createdAt, updatedAt: project.updatedAt }).from(project).where(eq(project.userId, uid));
  const ledger = await getCreditLedger();

  return buildDataExport(u, projects as DataExport["projects"], ledger);
}
