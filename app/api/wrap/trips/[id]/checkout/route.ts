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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = getAdmin();

  // Load trip + receipts
  const { data: trip, error: tripErr } = await admin
    .from("wrap_trips")
    .select("*")
    .eq("id", id)
    .single();

  if (tripErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  const { data: receipts } = await admin
    .from("wrap_receipts")
    .select("vendor, amount, currency, description, category")
    .eq("trip_id", id);

  const total = (receipts ?? []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);
  if (total <= 0) return NextResponse.json({ error: "Nothing to charge" }, { status: 400 });

  const origin = _req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(total * 100),
          product_data: {
            name: trip.name,
            description: `${(receipts ?? []).length} expense${(receipts ?? []).length !== 1 ? "s" : ""} · Wrap by CineFlow`,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: trip.client_email ?? undefined,
    success_url: `${origin}/wrap/report/${id}?paid=1`,
    cancel_url:  `${origin}/wrap/report/${id}`,
    metadata: { wrap_trip_id: id },
  });

  // Store session id so webhook can look up the trip
  await admin.from("wrap_trips").update({ stripe_session_id: session.id }).eq("id", id);

  return NextResponse.json({ url: session.url });
}
