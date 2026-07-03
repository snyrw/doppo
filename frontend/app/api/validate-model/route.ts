// frontend/app/api/validate-model/route.ts
import { NextRequest } from "next/server";
import { requireAuth, validateModelUpstream } from "@/app/lib/api-helpers";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;

  const body = (await request.json()) as { repo_id?: unknown };

  if (typeof body.repo_id !== "string" || body.repo_id.length < 1 || body.repo_id.length > 200) {
    return new Response(
      JSON.stringify({ detail: "repo_id must be a non-empty string of at most 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await validateModelUpstream(body.repo_id);
  if (!result.valid) {
    return new Response(JSON.stringify({ detail: result.reason }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.json(result);
}
