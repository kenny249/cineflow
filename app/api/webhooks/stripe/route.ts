import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { getPaymentCredentials } from "@/lib/payment-credentials";

// Stripe webhook endpoint — handles payment confirmation automatically.
//
// Setup per user:
// 1. User goes to Stripe Dashboard → Developers → Webhooks → Add endpoint
// 2. Endpoint URL: https://usecineflow.com/api/webhooks/stripe
// 3. Events to listen for: checkout.session.completed
// 4. Copy the signing secret → paste into CineFlow Settings → Payment → Stripe Webhook Secret
//
// The webhook secret is stored per-user in profiles.payment_settings.stripe_webhook_secret.
// We identify the owner by matching the payment_link URL stored on the invoice.

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;

  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Replay protection: reject events older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > 300) return false;

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  console.log("[webhook/stripe] POST received");
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const paymentStatus = session.payment_status as string;
  const paymentLinkId = session.payment_link as string | undefined;

  if (paymentStatus !== "paid" || !paymentLinkId) {
    return NextResponse.json({ received: true });
  }

  const supabase = getAdmin();

  // Find invoice by payment_link URL (Stripe payment_link ID is embedded in the URL)
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, amount, created_by, payment_link")
    .ilike("payment_link", `%${paymentLinkId}%`)
    .single();

  if (!invoice || invoice.status === "paid") {
    return NextResponse.json({ received: true });
  }

  // Verify the webhook signature using the owner's stored webhook secret.
  // We always require a valid signature — no bypass if secret is unconfigured.
  const creds = await getPaymentCredentials(supabase, invoice.created_by);
  const webhookSecret = creds.stripe_webhook_secret;

  if (!webhookSecret || !signature) {
    console.warn("[webhook/stripe] missing webhook secret or signature for invoice:", invoice.id);
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 400 });
  }

  const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.warn("[webhook/stripe] signature verification failed for invoice:", invoice.id);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
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
    .eq("id", invoice.id);

  console.log("[webhook/stripe] invoice marked paid via webhook:", invoice.id);
  return NextResponse.json({ received: true });
}
