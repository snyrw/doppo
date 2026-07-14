import { steeringCache } from "@/app/schema";
import { MAX_EXTRA_PAIRS } from "@/app/lib/api-helpers";
import { createSpawnHandler, isValidPrompt, sha256 } from "@/app/lib/spawn-route";

type Params = {
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  generationPrompt: string | null;
  targetPosition: number | "last";
  components: Array<{ layer: number }>;
  alpha: number;
  nTokens: number;
  extraPairs: Array<{ clean: string; corrupted: string }> | null;
  temperature: number;
  repetitionPenalty: number;
};

export const POST = createSpawnHandler<Params>({
  jobType: "steering",
  cacheTable: steeringCache,
  parse: (body) => {
    if (!isValidPrompt(body.cleanPrompt)) return { ok: false, error: "Invalid cleanPrompt" };
    if (!isValidPrompt(body.corruptedPrompt)) return { ok: false, error: "Invalid corruptedPrompt" };
    const nTokens = body.nTokens;
    if (typeof nTokens !== "number" || !Number.isInteger(nTokens) || nTokens < 1 || nTokens > 500)
      return { ok: false, error: "nTokens must be an integer between 1 and 500" };
    const extraPairs = body.extraPairs as Params["extraPairs"] | undefined;
    if (extraPairs != null && (!Array.isArray(extraPairs) || extraPairs.length > MAX_EXTRA_PAIRS))
      return { ok: false, error: `extraPairs must be an array of at most ${MAX_EXTRA_PAIRS} pairs` };
    return {
      ok: true,
      params: {
        modelName: body.modelName as string,
        cleanPrompt: body.cleanPrompt,
        corruptedPrompt: body.corruptedPrompt,
        generationPrompt: (body.generationPrompt as string | undefined) ?? null,
        targetPosition: body.targetPosition as number | "last",
        // Strip legacy head/injectionType fields old cards may still carry so
        // the cache key sees one canonical shape.
        components: (body.components as Array<{ layer: number }>).map((c) => ({ layer: c.layer })),
        alpha: body.alpha as number,
        nTokens,
        extraPairs: extraPairs ?? null,
        temperature: (body.temperature as number | undefined) ?? 1.0,
        repetitionPenalty: (body.repetitionPenalty as number | undefined) ?? 1.3,
      },
    };
  },
  // Generation with temperature > 0 is non-deterministic sampling. 
  // Only cache deterministic (argmax) runs.
  // generationPrompt and extraPairs change the output (probe prompt and DIM
  // vector respectively), so they must be in the key.
  cacheKey: (userId, p) =>
    p.temperature <= 0
      ? sha256(
          `${userId}:${p.modelName}:${p.cleanPrompt}:${p.corruptedPrompt}:${p.generationPrompt ?? ""}:${p.alpha}:${p.nTokens}:${p.temperature}:${p.repetitionPenalty}:${JSON.stringify(p.components)}:${JSON.stringify(p.extraPairs ?? [])}`
        )
      : null,
  upstreamBody: (p) => ({
    model_name: p.modelName,
    clean_prompt: p.cleanPrompt,
    corrupted_prompt: p.corruptedPrompt,
    generation_prompt: p.generationPrompt,
    target_position: p.targetPosition,
    components: p.components.map((c) => ({ layer: c.layer })),
    alpha: p.alpha,
    n_tokens: p.nTokens,
    extra_pairs: p.extraPairs,
    temperature: p.temperature,
    repetition_penalty: p.repetitionPenalty,
  }),
  cachePayload: (p) => ({
    modelName: p.modelName,
    cleanPrompt: p.cleanPrompt,
    corruptedPrompt: p.corruptedPrompt,
  }),
});
