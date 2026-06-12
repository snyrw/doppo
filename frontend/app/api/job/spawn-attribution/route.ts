import { attributionCache } from "@/app/schema";
import { createSpawnHandler, isValidPrompt, sha256 } from "@/app/lib/spawn-route";

type Params = {
  modelName: string;
  cleanPrompt: string;
  corruptedPrompt: string;
  targetPosition: number | "last";
  targetToken: string | null;
  contrastiveToken: string | null;
};

export const POST = createSpawnHandler<Params>({
  jobType: "attribution",
  cacheTable: attributionCache,
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
        targetToken: (body.targetToken as string | null) ?? null,
        contrastiveToken: (body.contrastiveToken as string | null) ?? null,
      },
    };
  },
  cacheKey: (userId, p) =>
    sha256(
      `${userId}:${p.modelName}:${p.cleanPrompt}:${p.corruptedPrompt}:${String(p.targetPosition)}:${p.targetToken ?? "__auto__"}:${p.contrastiveToken ?? "__none__"}`
    ),
  upstreamBody: (p) => ({
    prompt: p.cleanPrompt,
    corrupted_prompt: p.corruptedPrompt,
    model_name: p.modelName,
    target_position: p.targetPosition,
    target_token: p.targetToken,
    contrastive_token: p.contrastiveToken,
  }),
  cachePayload: (p) => ({
    modelName: p.modelName,
    prompt: p.cleanPrompt,
    corruptedPrompt: p.corruptedPrompt,
    targetPosition: String(p.targetPosition),
    targetToken: p.targetToken ?? "__auto__",
  }),
});
