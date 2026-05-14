import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const upstream = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tokenize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
