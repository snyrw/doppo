import { NextRequest } from "next/server";
import { requireAuth } from "../../lib/api-helpers";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!("userId" in authResult)) return authResult;

  const body = (await request.json()) as { model_name?: unknown; text?: unknown };

  if (typeof body.model_name !== "string" || body.model_name.length < 1 || body.model_name.length > 200) {
    return new Response(
      JSON.stringify({ error: "model_name must be a non-empty string of at most 200 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (body.text !== undefined && (typeof body.text !== "string" || body.text.length > 8000)) {
    return new Response(
      JSON.stringify({ error: "text must be a string of at most 8000 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tokenize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: body.model_name, text: body.text ?? "" }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Could not reach inference backend: ${msg}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    const errData = (await upstream.json().catch(() => ({}))) as { detail?: string };
    const detail = errData.detail ?? `Upstream error ${upstream.status}`;
    return new Response(JSON.stringify({ error: detail }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = (await upstream.json()) as unknown;

  if (!Array.isArray((result as any)?.tokens)) {
    return new Response(JSON.stringify({ error: "Invalid tokenization response" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const typedResult = result as { tokens: { text: string; special: boolean }[] };
  return new Response(JSON.stringify(typedResult), { headers: { "Content-Type": "application/json" } });
}
