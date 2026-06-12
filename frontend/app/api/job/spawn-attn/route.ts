import { attnCache } from "@/app/schema";
import { createSpawnHandler, isValidPrompt, sha256 } from "@/app/lib/spawn-route";

type Params = { modelName: string; prompt: string };

export const POST = createSpawnHandler<Params>({
  jobType: "attn",
  cacheTable: attnCache,
  parse: (body) => {
    if (!isValidPrompt(body.prompt)) return { ok: false, error: "Invalid prompt" };
    return { ok: true, params: { modelName: body.modelName as string, prompt: body.prompt } };
  },
  cacheKey: (userId, p) => sha256(`${userId}:${p.modelName}:${p.prompt}`),
  upstreamBody: (p) => ({ prompt: p.prompt, model_name: p.modelName }),
  cachePayload: (p) => ({ modelName: p.modelName, prompt: p.prompt }),
});
