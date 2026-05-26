import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { ensureGrantAndGetBalance } from "@/app/lib/credits";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ balanceMicros: null });

  const balanceMicros = await ensureGrantAndGetBalance(session.user.id);
  return Response.json({ balanceMicros });
}
