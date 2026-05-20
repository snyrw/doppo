import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers";
import { validateGpuTier } from "@/app/lib/api-helpers";

// Tier-scaled caps matching compute cost: more pairs on cheap GPUs, fewer on expensive ones.
const TIER_CAPS: Record<string, number> = {
  tl_small: 40,
  tl_medium: 25,
  tl_large: 15,
  tl_xlarge: 10,
};
const DEFAULT_CAP = 20;

const SYSTEM_PROMPT = `You are generating a dataset of contrastive prompt pairs for mechanistic interpretability research. These pairs will be used to compute a "steering vector" — a direction in a language model's activation space that represents a specific concept or behavior.

Each pair consists of:
- "clean": a prompt that exhibits or leads toward the TARGET concept
- "corrupted": a near-identical or thematically parallel prompt WITHOUT the target concept, or with the opposing concept

QUALITY RULES:
1. Keep both prompts in a pair SIMILAR in token length — avoid one being much longer than the other.
2. VARY scenarios widely across pairs: different topics, registers, contexts. Do not reuse the same sentence structure more than twice.
3. The concept difference should be ISOLATED — pairs should differ mainly on the target concept, not on multiple dimensions simultaneously.
4. Both prompts in a pair must be plausible, natural-sounding text. Avoid straw-man negatives.
5. Match the format and register of the example pair provided by the user.
6. Do NOT add explanatory text, markdown, or commentary. Output ONLY valid JSON objects, one per line.

OUTPUT FORMAT (one JSON object per line, no arrays, no markdown):
{"clean": "...", "corrupted": "..."}`;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to generate pairs" }, { status: 401 });
  }

  const { concept, primaryClean, primaryCorrupted, gpuTier, nPairs } =
    (await request.json()) as {
      concept: string;
      primaryClean: string;
      primaryCorrupted: string;
      gpuTier?: string;
      nPairs?: number;
    };

  // Input validation
  if (typeof concept !== "string" || concept.trim().length === 0 || concept.length > 500) {
    return new Response(
      JSON.stringify({ error: "concept must be a non-empty string of at most 500 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!validateGpuTier(gpuTier)) {
    return new Response(
      JSON.stringify({ error: "gpuTier must be one of: tl_small, tl_medium, tl_large, tl_xlarge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (
    typeof primaryClean !== "string" ||
    primaryClean.length < 1 ||
    primaryClean.length > 2000
  ) {
    return new Response(
      JSON.stringify({
        error: "primaryClean must be a non-empty string of at most 2000 characters",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (
    typeof primaryCorrupted !== "string" ||
    primaryCorrupted.length < 1 ||
    primaryCorrupted.length > 2000
  ) {
    return new Response(
      JSON.stringify({
        error: "primaryCorrupted must be a non-empty string of at most 2000 characters",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (nPairs !== undefined && (!Number.isInteger(nPairs) || nPairs < 1 || nPairs > 40)) {
    return new Response(
      JSON.stringify({ error: "nPairs must be an integer between 1 and 40" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  // Subtract 1 because the caller's seed pair already occupies slot 1 of the cap.
  const n = Math.max(1, (gpuTier ? (TIER_CAPS[gpuTier] ?? DEFAULT_CAP) : DEFAULT_CAP) - 1);

  const userMessage = `Target concept: "${concept.trim()}"

Example pair (match this format and register):
clean: ${primaryClean.trim()}
corrupted: ${primaryCorrupted.trim()}

Generate ${n} diverse contrastive pairs for the target concept. Output one JSON object per line.`;

  const client = new Anthropic({ apiKey });

  let raw: string;
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 });
  }

  // Parse one JSON object per line, skip blank lines and malformed entries.
  const pairs: Array<{ clean: string; corrupted: string }> = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.clean === "string" && typeof obj.corrupted === "string") {
        pairs.push({ clean: obj.clean, corrupted: obj.corrupted });
      }
    } catch {
      // skip unparseable lines (model sometimes adds preamble)
    }
  }

  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "Model returned no valid pairs. Try rephrasing the concept description." },
      { status: 422 }
    );
  }

  return NextResponse.json({ pairs, n_requested: n });
}
