import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Public endpoint — called from the /pay/[invoiceId] page after Stripe redirects back.
// Verifies the Stripe checkout session is actually paid, then marks the invoice paid.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`confirm-payment:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { invoiceId, sessionId } = await req.json().catch(() => ({}));
  if (!invoiceId || !sessionId) {
    return NextResponse.json({ error: "invoiceId and sessionId required" }, { status: 400 });
  }

  const supabase = getAdmin();

  // Get invoice + owner's Stripe key
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, amount, created_by")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "paid") return NextResponse.json({ ok: true, alreadyPaid: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("payment_settings")
    .eq("id", invoice.created_by)
    .single();

  const stripeKey = (profile?.payment_settings as Record<string, string> | null)?.stripe_secret_key;
  if (!stripeKey) return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });

  // Verify with Stripe that this session is actually paid
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const session = await stripeRes.json();

  if (session.error) {
    console.warn("[confirm-payment] Stripe session fetch error:", session.error.message);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json({ ok: false, paymentStatus: session.payment_status });
  }

  // Mark invoice as paid
  await supabase
    .from("invoices")
    .update({
      status: "paid",
      amount_paid: invoice.amount,
      paid_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  return NextResponse.json({ ok: true, paid: true });
}
