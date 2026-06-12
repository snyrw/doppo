import { dlaCache } from "@/app/schema";
import { createSpawnHandler, isValidPrompt, sha256 } from "@/app/lib/spawn-route";

type Params = {
  modelName: string;
  prompt: string;
  targetPosition: number | "last";
  targetToken: string | null;
  contrastiveToken: string | null;
};

export const POST = createSpawnHandler<Params>({
  jobType: "dla",
  cacheTable: dlaCache,
  parse: (body) => {
    if (!isValidPrompt(body.prompt)) return { ok: false, error: "Invalid prompt" };
    return {
      ok: true,
      params: {
        modelName: body.modelName as string,
        prompt: body.prompt,
        targetPosition: body.targetPosition as number | "last",
        targetToken: (body.targetToken as string | null) ?? null,
        contrastiveToken: (body.contrastiveToken as string | null) ?? null,
      },
    };
  },
  cacheKey: (userId, p) =>
    sha256(
      `${userId}:${p.modelName}:${p.prompt}:${String(p.targetPosition)}:${p.targetToken ?? "__auto__"}:${p.contrastiveToken ?? "__none__"}`
    ),
  upstreamBody: (p) => ({
    prompt: p.prompt,
    model_name: p.modelName,
    target_position: p.targetPosition,
    target_token: p.targetToken,
    contrastive_token: p.contrastiveToken,
  }),
  cachePayload: (p) => ({
    modelName: p.modelName,
    prompt: p.prompt,
    targetPosition: String(p.targetPosition),
    targetToken: p.targetToken ?? "__auto__",
  }),
});
