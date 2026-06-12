import { createHash } from "node:crypto";
import { activationPatchCache } from "@/app/schema";
import { createSpawnHandler, isValidPrompt } from "@/app/lib/spawn-route";

type Params = {
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  targetPosition: number | "last";
  targetTokenIdx: number;
  contrastiveTokenIdx: number | null;
  components: object[];
  k: number;
};

export const POST = createSpawnHandler<Params>({
  jobType: "activation-patch",
  cacheTable: activationPatchCache,
  parse: (body) => {
    if (!isValidPrompt(body.cleanPrompt)) return { ok: false, error: "Invalid cleanPrompt" };
    if (!isValidPrompt(body.corruptedPrompt)) return { ok: false, error: "Invalid corruptedPrompt" };
    return {
      ok: true,
      params: {
        modelName: body.modelName as string,
        cleanPrompt: body.cleanPrompt,
        corruptedPrompt: body.corruptedPrompt,
        targetPosition: body.targetPosition as number | "last",
        targetTokenIdx: body.targetTokenIdx as number,
        contrastiveTokenIdx: (body.contrastiveTokenIdx as number | null) ?? null,
        components: body.components as object[],
        k: body.k as number,
      },
    };
  },
  // Pre-factory keys hashed these fields concatenated without separators — keep
  // the exact byte stream so existing cache rows stay reachable.
  cacheKey: (userId, p) =>
    createHash("sha256")
      .update(userId).update(p.modelName).update(p.cleanPrompt).update(p.corruptedPrompt)
      .update(String(p.targetPosition)).update(String(p.targetTokenIdx))
      .update(String(p.contrastiveTokenIdx ?? "null")).update(JSON.stringify(p.components)).update(String(p.k))
      .digest("hex"),
  upstreamBody: (p) => ({
    prompt: p.cleanPrompt,
    corrupted_prompt: p.corruptedPrompt,
    model_name: p.modelName,
    target_position: p.targetPosition,
    target_token_idx: p.targetTokenIdx,
    contrastive_token_idx: p.contrastiveTokenIdx,
    components: p.components,
    k: p.k,
  }),
  cachePayload: (p) => ({
    modelName: p.modelName,
    cleanPrompt: p.cleanPrompt,
    corruptedPrompt: p.corruptedPrompt,
  }),
});
