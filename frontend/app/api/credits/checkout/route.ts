import Stripe from "stripe";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { CREDIT_PACKS } from "@/app/lib/rates";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response("Payments not yet configured", { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { packLabel } = await req.json();
  const pack = CREDIT_PACKS.find((p) => p.label === packLabel);
  if (!pack) return new Response("Invalid pack", { status: 400 });

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: pack.chargeCents,
          product_data: {
            name: `${pack.label} compute credit`,
            description:
              "Prices include Stripe payment processing fees (2.9% + $0.30) passed through at cost.",
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: session.user.id,
    customer_email: session.user.email ?? undefined,
    metadata: {
      userId: session.user.id,
      creditMicros: String(pack.creditMicros),
      packLabel: pack.label,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects?credits=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects`,
  });

  return Response.json({ url: checkout.url });
}
