import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, getPlanByPriceId, PLANS } from "@/lib/stripe";
import type Stripe from "stripe";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function updateProfile(userId: string, patch: Record<string, unknown>) {
  const admin = getAdmin();
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) console.error("[webhook] profile update failed", userId, error.message);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) { console.error("[webhook] no userId on checkout session", session.id); return; }

  const planId = session.metadata?.planId;
  const interval = session.metadata?.interval as "month" | "year" | "lifetime" | undefined;
  const plan = planId ? PLANS[planId as keyof typeof PLANS] : null;
  const seats = plan?.seats ?? 1;

  if (session.mode === "payment") {
    await updateProfile(userId, {
      plan: "lifetime",
      plan_status: "active",
      plan_interval: "lifetime",
      stripe_customer_id: session.customer as string,
      seat_count: seats,
      trial_ends_at: null,
      current_period_end: null,
    });
    console.log("[webhook] lifetime activated", userId);
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);
    await updateProfile(userId, {
      plan: planId,
      plan_status: "active",
      plan_interval: interval ?? "month",
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: sub.id,
      seat_count: seats,
      trial_ends_at: null,
    });
    console.log("[webhook] subscription activated", userId, planId);
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("[webhook] no userId on subscription", sub.id); return; }

  const priceId = sub.items.data[0]?.price.id;
  const planId = priceId ? getPlanByPriceId(priceId) : null;
  const plan = planId ? PLANS[planId] : null;

  const status =
    sub.status === "active" ? "active" :
    sub.status === "past_due" ? "past_due" :
    "canceled";

  await updateProfile(userId, {
    plan: planId ?? undefined,
    plan_status: status,
    stripe_subscription_id: sub.id,
    seat_count: plan?.seats ?? undefined,
  });
  console.log("[webhook] subscription updated", userId, planId, sub.status);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("[webhook] no userId on subscription delete", sub.id); return; }

  await updateProfile(userId, {
    plan_status: "canceled",
    stripe_subscription_id: null,
  });
  console.log("[webhook] subscription canceled", userId);
}

function getSubIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails) return null;
  const sub = subDetails.subscription;
  return typeof sub === "string" ? sub : (sub?.id ?? null);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = getSubIdFromInvoice(invoice);
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.userId;
  if (!userId) return;

  await updateProfile(userId, { plan_status: "past_due" });
  console.log("[webhook] payment failed", userId);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subId = getSubIdFromInvoice(invoice);
  if (!subId) return;

  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.userId;
  if (!userId) return;

  await updateProfile(userId, {
    plan_status: "active",
    current_period_end: new Date(invoice.period_end * 1000).toISOString(),
  });
  console.log("[webhook] invoice paid", userId);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[webhook] handler error", event.type, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
