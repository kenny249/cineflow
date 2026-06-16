import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAdminPage } from "@/lib/admin-guard";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    await requireAdminPage();
    const supabase = getAdmin();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [authRes, profilesRes, signups30Res, signups31to60Res, signups61to90Res] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("id, plan_status, trial_ends_at, is_test"),
      // Signups per rolling 30-day window for avg calculation
      supabase.from("profiles").select("id, created_at, is_test").gte("created_at", thirtyDaysAgo),
      supabase.from("profiles").select("id, created_at, is_test").gte("created_at", sixtyDaysAgo).lt("created_at", thirtyDaysAgo),
      supabase.from("profiles").select("id, created_at, is_test").gte("created_at", ninetyDaysAgo).lt("created_at", sixtyDaysAgo),
    ]);

    const authUsers = authRes.data?.users ?? [];
    const profiles = profilesRes.data ?? [];

    const testUserIds = new Set(profiles.filter((p) => p.is_test).map((p) => p.id));
    const demoEmail = "@demo.usecineflow.com";

    const isReal = (id: string, email?: string | null) =>
      !email?.endsWith(demoEmail) && !testUserIds.has(id);

    const realProfileIds = new Set(
      authUsers.filter((u) => isReal(u.id, u.email)).map((u) => u.id)
    );

    const nowIso = now.toISOString();

    const activeTrials = profiles.filter(
      (p) =>
        realProfileIds.has(p.id) &&
        p.plan_status === "trialing" &&
        p.trial_ends_at &&
        p.trial_ends_at > nowIso
    ).length;

    const paidCount = profiles.filter(
      (p) =>
        realProfileIds.has(p.id) &&
        (p.plan_status === "active" || p.plan_status === "founding")
    ).length;

    // Average monthly signups (real users) over last 3 months
    const realSignups = (rows: { id: string; is_test: boolean | null }[]) =>
      rows.filter((r) => !r.is_test).length;

    const s30 = realSignups(signups30Res.data ?? []);
    const s60 = realSignups(signups31to60Res.data ?? []);
    const s90 = realSignups(signups61to90Res.data ?? []);
    const avgMonthlySignups = Math.round((s30 + s60 + s90) / 3);

    // MRR from Stripe
    let mrr = 0;
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const subs: Stripe.Subscription[] = [];
        let cursor: string | undefined;
        do {
          const page = await stripe.subscriptions.list({
            status: "active",
            limit: 100,
            starting_after: cursor,
            expand: ["data.items.data.price", "data.latest_invoice"],
          });
          subs.push(...page.data);
          cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
        } while (cursor);

        for (const sub of subs) {
          const invoice = sub.latest_invoice as Stripe.Invoice | null;
          if (!invoice?.amount_paid || invoice.amount_paid < 100) continue;
          const item = sub.items.data[0];
          if (!item) continue;
          const price = item.price as Stripe.Price;
          const unit = (price.unit_amount ?? 0) / 100;
          mrr += price.recurring?.interval === "year" ? unit / 12 : unit;
        }
      } catch { /* leave mrr as 0 */ }
    }

    return NextResponse.json({
      mrr: Math.round(mrr),
      activeTrials,
      paidCount,
      avgMonthlySignups: Math.max(avgMonthlySignups, 1),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
