import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/app/db";
import { steeringPairSets } from "@/app/schema";
import { MAX_PROMPT_CHARS, MAX_EXTRA_PAIRS } from "@/app/lib/api-helpers";

export type ExtraPair = { clean: string; corrupted: string };

export type SteeringPairSetSummary = {
  id: string;
  name: string;
  pairCount: number;
  createdAt: Date;
};

export type SteeringPairSetDetail = {
  cleanPrompt: string;
  corruptedPrompt: string;
  extraPairs: ExtraPair[];
};

const MAX_NAME_CHARS = 200;
const MAX_SAVED_SETS = 20;

function validatePairSetInput(
  name: string,
  cleanPrompt: string,
  corruptedPrompt: string,
  extraPairs: ExtraPair[]
): void {
  if (name.length > MAX_NAME_CHARS) {
    throw new Error(`Name must be ${MAX_NAME_CHARS} characters or fewer.`);
  }
  if (cleanPrompt.length > MAX_PROMPT_CHARS || corruptedPrompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`Prompts must be ${MAX_PROMPT_CHARS} characters or fewer.`);
  }
  if (extraPairs.length > MAX_EXTRA_PAIRS) {
    throw new Error(`extraPairs must contain at most ${MAX_EXTRA_PAIRS} pairs.`);
  }
  for (const pair of extraPairs) {
    if (typeof pair.clean !== "string" || typeof pair.corrupted !== "string") {
      throw new Error("Each pair must have clean and corrupted string fields.");
    }
    if (pair.clean.length > MAX_PROMPT_CHARS || pair.corrupted.length > MAX_PROMPT_CHARS) {
      throw new Error(`Pairs must be ${MAX_PROMPT_CHARS} characters or fewer.`);
    }
  }
}

export async function saveSteeringPairSetForUser(
  userId: string,
  name: string,
  cleanPrompt: string,
  corruptedPrompt: string,
  extraPairs: ExtraPair[]
): Promise<{ id: string }> {
  validatePairSetInput(name, cleanPrompt, corruptedPrompt, extraPairs);

  const [row] = await db
    .select({ c: count() })
    .from(steeringPairSets)
    .where(eq(steeringPairSets.userId, userId));
  if ((row?.c ?? 0) >= MAX_SAVED_SETS) {
    throw new Error(`Saved set limit reached (${MAX_SAVED_SETS}) — delete one to save another.`);
  }

  const id = crypto.randomUUID();
  await db.insert(steeringPairSets).values({
    id,
    userId,
    name,
    cleanPrompt,
    corruptedPrompt,
    extraPairs,
  });
  return { id };
}

export async function listSteeringPairSetSummariesForUser(
  userId: string
): Promise<SteeringPairSetSummary[]> {
  const rows = await db
    .select({
      id: steeringPairSets.id,
      name: steeringPairSets.name,
      pairCount: sql<number>`1 + jsonb_array_length(${steeringPairSets.extraPairs})`,
      createdAt: steeringPairSets.createdAt,
    })
    .from(steeringPairSets)
    .where(eq(steeringPairSets.userId, userId))
    .orderBy(desc(steeringPairSets.createdAt));
  return rows as SteeringPairSetSummary[];
}

export async function loadSteeringPairSetForUser(
  userId: string,
  id: string
): Promise<SteeringPairSetDetail> {
  const rows = await db
    .select({
      cleanPrompt: steeringPairSets.cleanPrompt,
      corruptedPrompt: steeringPairSets.corruptedPrompt,
      extraPairs: steeringPairSets.extraPairs,
    })
    .from(steeringPairSets)
    .where(and(eq(steeringPairSets.id, id), eq(steeringPairSets.userId, userId)))
    .limit(1);
  if (rows.length === 0) throw new Error("Saved pair set not found.");
  const row = rows[0];
  return {
    cleanPrompt: row.cleanPrompt,
    corruptedPrompt: row.corruptedPrompt,
    extraPairs: row.extraPairs as ExtraPair[],
  };
}

export async function deleteSteeringPairSetForUser(userId: string, id: string): Promise<void> {
  await db
    .delete(steeringPairSets)
    .where(and(eq(steeringPairSets.id, id), eq(steeringPairSets.userId, userId)));
}
