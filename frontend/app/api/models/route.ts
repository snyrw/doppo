// frontend/app/api/models/route.ts
import { FEATURED_MODELS } from "@/app/lib/featured-models";

export async function GET() {
  const models = Object.values(FEATURED_MODELS).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    description: m.description,
    requires_hf_token: m.requires_hf_token,
    gpu_tier: m.gpu_tier,
  }));
  return Response.json(models);
}
