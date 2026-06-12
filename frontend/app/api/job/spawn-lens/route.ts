import { heatmapCache } from "@/app/schema";
import { createSpawnHandler, isValidPrompt, sha256 } from "@/app/lib/spawn-route";

type Params = { modelName: string; prompt: string; topK: number };

export const POST = createSpawnHandler<Params>({
  jobType: "lens",
  cacheTable: heatmapCache,
  parse: (body) => {
    if (!isValidPrompt(body.prompt)) return { ok: false, error: "Invalid prompt" };
    return {
      ok: true,
      params: {
        modelName: body.modelName as string,
        prompt: body.prompt,
        topK: (body.topK as number | undefined) ?? 5,
      },
    };
  },
  cacheKey: (userId, p) => sha256(`${userId}:${p.modelName}:${p.prompt}:${p.topK}`),
  upstreamBody: (p) => ({ prompt: p.prompt, model_name: p.modelName, top_k: p.topK }),
  cachePayload: (p) => ({ prompt: p.prompt, modelName: p.modelName, topK: p.topK }),
});
