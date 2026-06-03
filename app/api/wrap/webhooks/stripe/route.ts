import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WRAP_WEBHOOK_SECRET;

  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const tripId = session.metadata?.wrap_trip_id;
    if (tripId && session.payment_status === "paid") {
      await getAdmin()
        .from("wrap_trips")
        .update({
          status: "paid",
          stripe_payment_intent: session.payment_intent as string,
          paid_at: new Date().toISOString(),
        })
        .eq("id", tripId);
    }
  }

  return NextResponse.json({ received: true });
}
