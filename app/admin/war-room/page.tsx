import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";
import { stripe } from "@/lib/stripe";
import { WarRoomClient } from "./WarRoomClient";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchWarRoomData() {
  const admin = getAdmin();
  const now = Date.now();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(now + 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();

  const [
    { data: { users: authUsers } },
    { data: profiles },
    { data: recentProjects },
    { data: recentInvoices },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, first_name, last_name, plan, plan_status, trial_ends_at, created_at, is_test"),
    admin.from("projects").select("created_by, created_at").gte("created_at", thirtyDaysAgo),
    admin.from("invoices").select("created_by, status, created_at").gte("created_at", thirtyDaysAgo).in("status", ["sent", "paid"]),
  ]);

  const testUserIds = new Set((profiles ?? []).filter((p) => p.is_test).map((p) => p.id));
  const realUsers = (authUsers ?? []).filter(
    (u) => !u.email?.endsWith("@demo.usecineflow.com") && !testUserIds.has(u.id)
  );

  const todayStr = today.toISOString();
  const signupsToday = realUsers.filter((u) => u.created_at >= todayStr).length;

  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay(); // 0 = Sun
  weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7)); // Mon-based week
  weekStart.setHours(0, 0, 0, 0);
  const signupsThisWeek = realUsers.filter((u) => u.created_at >= weekStart.toISOString()).length;

  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const signupsThisMonth = realUsers.filter((u) => u.created_at >= monthStart.toISOString()).length;

  // Trials expiring in 7 days
  const nowIso = new Date(now).toISOString();
  const trialsExpiringSoon = (profiles ?? [])
    .filter((p) => p.plan_status === "trialing" && p.trial_ends_at && p.trial_ends_at > nowIso && p.trial_ends_at <= weekFromNow)
    .map((p) => {
      const u = realUsers.find((u) => u.id === p.id);
      return {
        id: p.id,
        email: u?.email ?? "",
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || u?.email?.split("@")[0] || "User",
        plan: p.plan ?? "studio",
        trial_ends_at: p.trial_ends_at!,
      };
    })
    .sort((a, b) => new Date(a.trial_ends_at).getTime() - new Date(b.trial_ends_at).getTime());

  // Recent signups (last 10)
  const recentSignups = realUsers
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((u) => {
      const p = (profiles ?? []).find((pr) => pr.id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        name: p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "",
        plan: p?.plan ?? "studio",
        plan_status: p?.plan_status ?? "trialing",
        created_at: u.created_at,
      };
    });

  // MRR + verified paid count from Stripe (excludes gifted/comped accounts with no real payment)
  let mrr = 0;
  let paidCount = 0;
  let canceledLast30 = 0;
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

      const paidSubs = activeSubs.filter((sub) => {
        const invoice = sub.latest_invoice as Stripe.Invoice | null;
        return invoice?.amount_paid != null && invoice.amount_paid >= 100;
      });

      paidCount = paidSubs.length;

      for (const sub of paidSubs) {
        const item = sub.items.data[0];
        if (!item) continue;
        const price = item.price as Stripe.Price;
        const unitAmount = (price.unit_amount ?? 0) / 100;
        mrr += price.recurring?.interval === "year" ? unitAmount / 12 : unitAmount;
      }

      const thirtyDaysAgoTs = Math.floor(now / 1000) - 30 * 24 * 60 * 60;
      const canceledSubs: Stripe.Subscription[] = [];
      let cancelCursor: string | undefined;
      do {
        const page = await stripe.subscriptions.list({
          status: "canceled",
          limit: 100,
          starting_after: cancelCursor,
          expand: ["data.latest_invoice"],
        });
        canceledSubs.push(...page.data);
        cancelCursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
      } while (cancelCursor);
      canceledLast30 = canceledSubs.filter((s) => {
        if (!s.canceled_at || s.canceled_at < thirtyDaysAgoTs) return false;
        const inv = s.latest_invoice as Stripe.Invoice | null;
        return inv?.amount_paid != null && inv.amount_paid >= 100;
      }).length;
    } catch {
      // Stripe unavailable — paidCount stays 0
    }
  }

  const trialsActive = (profiles ?? []).filter(
    (p) => p.plan_status === "trialing" && p.trial_ends_at && new Date(p.trial_ends_at) > new Date()
  ).length;

  return {
    mrr,
    totalUsers: realUsers.length,
    signupsToday,
    signupsThisWeek,
    signupsThisMonth,
    paidCount,
    trialsActive,
    trialsExpiringSoon: trialsExpiringSoon.length,
    canceledLast30,
    trialsExpiringSoonList: trialsExpiringSoon,
    recentSignups,
    projectsThisMonth: (recentProjects ?? []).length,
    invoicesThisMonth: (recentInvoices ?? []).length,
    fetchedAt: new Date().toISOString(),
  };
}

export default async function WarRoomPage() {
  await requireAdminPage();
  const data = await fetchWarRoomData();
  return <WarRoomClient data={data} />;
}
