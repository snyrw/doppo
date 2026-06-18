import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { getStripe, getOrCreateStripeCustomer } from "@/app/lib/stripe";

export async function POST() {
  const stripe = getStripe();
  if (!stripe) return new Response("Payments not yet configured", { status: 503 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const customerId = await getOrCreateStripeCustomer(session.user.id, session.user.email);

  // mode: "setup" saves + validates a card for $0 — no charge, no refund.
  const checkout = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    client_reference_id: session.user.id,
    metadata: { userId: session.user.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects?card=verified`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects`,
  });

  return Response.json({ url: checkout.url });
}
