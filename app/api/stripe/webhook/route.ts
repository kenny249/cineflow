import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, getPlanByPriceId, PLANS } from "@/lib/stripe";
import { Resend } from "resend";
import { emailPaymentFailed, emailSubscriptionCanceled } from "@/lib/email-templates";
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
  if (error) console.error("[webhook] profile update failed", { userId, error: error.message });
}

async function getProfileForEmail(userId: string): Promise<{ email: string | null; first_name: string | null; plan: string | null }> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("email, first_name, plan")
    .eq("id", userId)
    .single();
  return data ?? { email: null, first_name: null, plan: null };
}

async function sendSystemEmail(to: string, payload: { subject: string; html: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@usecineflow.com";
  const { error } = await resend.emails.send({
    from: `CineFlow <${fromEmail}>`,
    to: [to],
    subject: payload.subject,
    html: payload.html,
  });
  if (error) console.error("[webhook] email send failed", { to, subject: payload.subject, error: error.message });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) { console.error("[webhook] no userId on checkout session", { sessionId: session.id }); return; }

  const planId = session.metadata?.planId;
  const interval = session.metadata?.interval as "month" | "year" | "lifetime" | undefined;
  const plan = planId ? PLANS[planId as keyof typeof PLANS] : null;
  const seats = plan?.seats ?? 1;

  if (session.mode === "payment") {
    // Enforce lifetime cap: max 500 licenses
    const { count: lifetimeCount } = await getAdmin()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "lifetime");

    if ((lifetimeCount ?? 0) >= 500) {
      console.error("[webhook] lifetime cap reached — cannot activate", { userId, count: lifetimeCount });
      // Cannot reject after payment — log for manual review and still activate to avoid locking out a paying user
    }

    await updateProfile(userId, {
      plan: "lifetime",
      plan_status: "active",
      plan_interval: "lifetime",
      stripe_customer_id: session.customer as string,
      seat_count: seats,
      trial_ends_at: null,
      current_period_end: null,
    });
    console.log("[webhook] lifetime activated", { userId, lifetimeCount: (lifetimeCount ?? 0) + 1 });
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
    console.log("[webhook] subscription activated", { userId, planId });
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("[webhook] no userId on subscription", { subId: sub.id }); return; }

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
  console.log("[webhook] subscription updated", { userId, planId, status: sub.status });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) { console.error("[webhook] no userId on subscription delete", { subId: sub.id }); return; }

  await updateProfile(userId, {
    plan_status: "canceled",
    stripe_subscription_id: null,
  });
  console.log("[webhook] subscription canceled", { userId });

  const profile = await getProfileForEmail(userId);
  if (profile.email) {
    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
    await sendSystemEmail(profile.email, emailSubscriptionCanceled({
      firstName: profile.first_name ?? "",
      planName: profile.plan ?? "CineFlow",
      reactivateUrl: `${appUrl}/upgrade`,
    }));
  }
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
  console.log("[webhook] payment failed", { userId, subId });

  const profile = await getProfileForEmail(userId);
  if (profile.email) {
    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
    const priceId = sub.items.data[0]?.price.id;
    const planId = priceId ? getPlanByPriceId(priceId) : null;
    const planName = planId ? PLANS[planId].name : "CineFlow";
    await sendSystemEmail(profile.email, emailPaymentFailed({
      firstName: profile.first_name ?? "",
      planName,
      updateUrl: `${appUrl}/settings?tab=billing`,
    }));
  }
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
  console.log("[webhook] invoice paid", { userId });
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

  // Idempotency guard: skip events already processed successfully
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("processed_webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .single();

  if (existing) {
    console.log("[webhook] duplicate event skipped", { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true, duplicate: true });
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
    console.error("[webhook] handler error", { type: event.type, eventId: event.id, error: String(err) });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  // Record this event as processed so retries are no-ops
  await admin
    .from("processed_webhook_events")
    .insert({ event_id: event.id, event_type: event.type })
    .then(({ error }) => {
      if (error) console.error("[webhook] failed to record processed event", { eventId: event.id, error: error.message });
    });

  return NextResponse.json({ received: true });
}
