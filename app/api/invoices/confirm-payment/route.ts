import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { getPaymentCredentials } from "@/lib/payment-credentials";

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
  if (await isRateLimited(`confirm-payment:${ip}`, 20, 60_000)) {
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

  const creds = await getPaymentCredentials(supabase, invoice.created_by);
  const stripeKey = creds.stripe_secret_key;
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
    console.log("[confirm-payment] session not paid", { invoiceId, sessionId, paymentStatus: session.payment_status });
    return NextResponse.json({ ok: false, paymentStatus: session.payment_status });
  }

  // A paid session alone isn't enough — it has to be a session that was
  // actually paid *for this invoice*. Without this, any session this
  // business has ever collected a real payment through (even for a
  // different, smaller invoice) could be replayed here against a larger
  // invoiceId and get it marked paid for free.
  //
  // Payment links are permanent, so invoices sent before this fix may still
  // have a link whose sessions carry no invoice_id metadata — for those,
  // fall back to an amount match alone rather than hard-failing a real
  // outstanding invoice. Any link generated from now on carries the tag, so
  // this fallback only matters for what's already out in the wild today.
  const expectedCents = Math.round((invoice.amount as number) * 100);
  const sessionInvoiceId = session.metadata?.invoice_id;
  const amountMatches = session.amount_total === expectedCents;
  const invoiceMatches = sessionInvoiceId ? sessionInvoiceId === invoiceId : amountMatches;
  if (!invoiceMatches || !amountMatches) {
    console.warn("[confirm-payment] session/invoice mismatch — refusing to mark paid", {
      invoiceId, sessionId, sessionInvoiceId, expectedCents, sessionAmount: session.amount_total,
    });
    return NextResponse.json({ error: "This payment doesn't match this invoice" }, { status: 400 });
  }

  // Atomic conditional update: only marks paid if still unpaid, preventing double-payment on concurrent requests.
  const { data: updatedRows } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      amount_paid: invoice.amount,
      paid_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .neq("status", "paid")
    .select("id");

  if (!updatedRows || updatedRows.length === 0) {
    console.log("[confirm-payment] already paid", { invoiceId });
    return NextResponse.json({ ok: true, alreadyPaid: true });
  }

  console.log("[confirm-payment] marked paid", { invoiceId, sessionId });
  return NextResponse.json({ ok: true, paid: true });
}
