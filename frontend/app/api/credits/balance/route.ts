import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { db } from "@/app/db";
import { userCredits } from "@/app/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return Response.json({ balanceMicros: null });

  const [row] = await db
    .select({ b: userCredits.balanceMicros })
    .from(userCredits)
    .where(eq(userCredits.userId, session.user.id));

  return Response.json({ balanceMicros: row?.b ?? 0 });
}
