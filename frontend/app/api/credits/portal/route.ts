import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { getStripe, getOrCreateStripeCustomer } from "@/app/lib/stripe";

export async function POST() {
  const stripe = getStripe();
  if (!stripe) return new Response("Payments not yet configured", { status: 503 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const customerId = await getOrCreateStripeCustomer(session.user.id, session.user.email);

  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects?settings=billing`,
  });

  return Response.json({ url: portal.url });
}
