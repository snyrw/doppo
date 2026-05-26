import { NextRequest } from "next/server";
import { requireAuth, resolveEndpointUrl, runPodJob } from "../../lib/api-helpers";

export async function POST(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (authResult instanceof Response) {
    return authResult;
  }

  const body = (await request.json()) as { model_name?: unknown; text?: unknown };

  // Validate model_name
  if (typeof body.model_name !== "string" || body.model_name.length < 1 || body.model_name.length > 200) {
    return new Response(
      JSON.stringify({ error: "model_name must be a non-empty string of at most 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate text
  if (body.text !== undefined && (typeof body.text !== "string" || body.text.length > 8000)) {
    return new Response(
      JSON.stringify({ error: "text must be a string of at most 8000 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Call RunPod tokenize endpoint via tl_small tier (tokenization doesn't require GPU)
  let result: unknown;
  try {
    result = await runPodJob(resolveEndpointUrl("tl_small"), {
      endpoint: "tokenize",
      model_id: body.model_name,
      text: body.text ?? "",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate response structure
  if (!Array.isArray((result as any)?.tokens)) {
    return new Response(JSON.stringify({ error: "Invalid tokenization response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cast result and return
  const typedResult = result as { tokens: { text: string; special: boolean }[] };
  return new Response(JSON.stringify(typedResult), { headers: { "Content-Type": "application/json" } });
}
