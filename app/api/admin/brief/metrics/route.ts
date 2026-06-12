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

    const [authUsersRes, profilesRes, projectsRes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("id, plan_status, trial_ends_at, is_test"),
      supabase.from("projects").select("id, created_by"),
    ]);

    const authUsers = authUsersRes.data?.users ?? [];
    const profiles = profilesRes.data ?? [];
    const projects = projectsRes.data ?? [];

    // Build test-user set from profiles
    const testUserIds = new Set(profiles.filter((p) => p.is_test).map((p) => p.id));

    // Real users: not demo email, not marked is_test
    const realUsers = authUsers.filter(
      (u) => !u.email?.endsWith("@demo.usecineflow.com") && !testUserIds.has(u.id)
    );

    // Active in last 30 days (real users only)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activeRecently = realUsers.filter(
      (u) => u.last_sign_in_at && u.last_sign_in_at > thirtyDaysAgo
    ).length;

    // Active trials: real users only, trialing + not expired
    const now = new Date().toISOString();
    const realProfileIds = new Set(realUsers.map((u) => u.id));
    const activeTrials = profiles.filter(
      (p) =>
        realProfileIds.has(p.id) &&
        p.plan_status === "trialing" &&
        p.trial_ends_at &&
        p.trial_ends_at > now
    ).length;

    // Projects created by real users only
    const realProjects = projects.filter((p) => !testUserIds.has(p.created_by)).length;

    // MRR from Stripe — reuse the same logic as Finances page
    let mrr = 0;
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const activeSubs: Stripe.Subscription[] = [];
        let cursor: string | undefined;
        do {
          const page = await stripe.subscriptions.list({
            status: "active",
            limit: 100,
            starting_after: cursor,
            expand: ["data.items.data.price", "data.latest_invoice"],
          });
          activeSubs.push(...page.data);
          cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
        } while (cursor);

        for (const sub of activeSubs) {
          const invoice = sub.latest_invoice as Stripe.Invoice | null;
          if (!invoice || !invoice.amount_paid || invoice.amount_paid < 100) continue;
          const item = sub.items.data[0];
          if (!item) continue;
          const price = item.price as Stripe.Price;
          const unit = (price.unit_amount ?? 0) / 100;
          mrr += price.recurring?.interval === "year" ? unit / 12 : unit;
        }
      } catch {
        // Stripe unavailable — leave mrr as 0
      }
    }

    return NextResponse.json({
      totalUsers: realUsers.length,
      activeTrials,
      activeRecently,
      totalProjects: realProjects,
      mrr: mrr > 0 ? Math.round(mrr) : null,
    });
  } catch (err: any) {
    console.error("[brief/metrics]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
