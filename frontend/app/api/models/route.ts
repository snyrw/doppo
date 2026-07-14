// frontend/app/api/models/route.ts
import { FEATURED_MODELS } from "@/app/lib/featured-models";

export async function GET() {
  const models = Object.values(FEATURED_MODELS).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    description: m.description,
    gpu_tier: m.gpu_tier,
  }));
  return Response.json(models);
}
