import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
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

  // Forward only validated fields to the upstream — never proxy raw client input.
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tokenize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model_name: body.model_name, text: body.text ?? "" }),
  }).catch((err: unknown) => {
    throw new Error(`Could not reach inference backend: ${err instanceof Error ? err.message : err}`);
  });

  if (!upstream.ok) {
    const errData = await upstream.json().catch(() => ({})) as { detail?: string };
    return new Response(
      JSON.stringify({ error: errData.detail ?? `Upstream error ${upstream.status}` }),
      { status: upstream.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
