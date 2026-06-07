import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdminPage } from "@/lib/admin-guard";
import { stripe, getPlanByPriceId, PLANS } from "@/lib/stripe";
import { FunnelCharts } from "./FunnelCharts";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function planLabel(key: string) {
  return PLANS[key as keyof typeof PLANS]?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

async function fetchFunnelData() {
  const admin = getAdmin();
  const now = Date.now();

  const [
    { data: { users: authUsers } },
    { data: profiles },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, plan, plan_status, trial_ends_at, created_at"),
  ]);

  const realUsers = (authUsers ?? []).filter((u) => !u.email?.endsWith("@demo.usecineflow.com"));
  const nowIso = new Date(now).toISOString();

  const totalSignups = realUsers.length;
  const trialsActive = (profiles ?? []).filter(
    (p) => p.plan_status === "trialing" && p.trial_ends_at && p.trial_ends_at > nowIso
  ).length;
  const trialsExpired = (profiles ?? []).filter(
    (p) => p.plan_status === "trialing" && (!p.trial_ends_at || p.trial_ends_at <= nowIso)
  ).length;
  const paidCount = (profiles ?? []).filter(
    (p) => p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime"
  ).length;
  const conversionRate = totalSignups > 0 ? ((paidCount / totalSignups) * 100).toFixed(1) : "0.0";

  // Cohort analysis: signup month → conversion
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const cohorts = months6.map((month) => {
    const cohortUsers = realUsers.filter((u) => u.created_at.slice(0, 7) === month);
    const converted = cohortUsers.filter((u) => {
      const p = profileMap[u.id];
      return p && (p.plan_status === "active" || p.plan_status === "founding" || p.plan === "lifetime");
    }).length;
    const label = new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    return {
      month: label,
      signups: cohortUsers.length,
      converted,
      rate: cohortUsers.length > 0 ? ((converted / cohortUsers.length) * 100).toFixed(0) : "0",
    };
  });

  // Stripe churn data
  type CanceledSub = {
    id: string;
    email: string;
    plan: string;
    canceledAt: string;
    mrr: number;
  };
  let canceledList: CanceledSub[] = [];
  let mrrLostLast30 = 0;
  let mrrLostLast90 = 0;

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const ninetyDaysAgo = Math.floor(now / 1000) - 90 * 24 * 60 * 60;
      const thirtyDaysAgo = Math.floor(now / 1000) - 30 * 24 * 60 * 60;

      let cursor: string | undefined;
      const canceled: Stripe.Subscription[] = [];
      do {
        const page = await stripe.subscriptions.list({
          status: "canceled",
          limit: 100,
          starting_after: cursor,
          expand: ["data.items.data.price", "data.latest_invoice", "data.customer"],
        });
        canceled.push(...page.data.filter((s) => s.canceled_at != null && s.canceled_at >= ninetyDaysAgo));
        cursor = page.has_more && page.data[page.data.length - 1].canceled_at! >= ninetyDaysAgo
          ? page.data[page.data.length - 1].id
          : undefined;
      } while (cursor);

      for (const sub of canceled) {
        const invoice = sub.latest_invoice as Stripe.Invoice | null;
        if (!invoice?.amount_paid || invoice.amount_paid < 100) continue;

        const item = sub.items.data[0];
        if (!item) continue;
        const price = item.price as Stripe.Price;
        const unitAmount = (price.unit_amount ?? 0) / 100;
        const monthly = price.recurring?.interval === "year" ? unitAmount / 12 : unitAmount;
        const plan = getPlanByPriceId(price.id) ?? "unknown";
        const customer = sub.customer as Stripe.Customer | null;
        const email = customer?.email ?? "unknown";

        if (sub.canceled_at! >= thirtyDaysAgo) mrrLostLast30 += monthly;
        mrrLostLast90 += monthly;

        canceledList.push({
          id: sub.id,
          email,
          plan,
          canceledAt: new Date(sub.canceled_at! * 1000).toISOString(),
          mrr: monthly,
        });
      }
      canceledList.sort((a, b) => new Date(b.canceledAt).getTime() - new Date(a.canceledAt).getTime());
    } catch {
      // Stripe unavailable
    }
  }

  const fmtC = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

  return {
    totalSignups,
    trialsActive,
    trialsExpired,
    paidCount,
    conversionRate,
    cohorts,
    canceledList,
    mrrLostLast30,
    mrrLostLast90,
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
    funnelSteps: [
      { label: "Total signups",    value: totalSignups, pct: "100%" },
      { label: "Started trial",    value: totalSignups, pct: "100%" },
      { label: "Active trial",     value: trialsActive, pct: totalSignups > 0 ? `${((trialsActive / totalSignups) * 100).toFixed(0)}%` : "—" },
      { label: "Converted to paid",value: paidCount,    pct: totalSignups > 0 ? `${((paidCount / totalSignups) * 100).toFixed(0)}%` : "—" },
    ],
  };
}

export default async function FunnelPage() {
  await requireAdminPage();
  const data = await fetchFunnelData();

  const fmtC = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Churn &amp; Funnel</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Trial conversion, cancellations, and cohort analysis</p>
      </div>

      {/* Funnel */}
      <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">Conversion funnel</h2>
        <div className="flex items-end gap-1">
          {data.funnelSteps.map((step, i) => {
            const pctNum = parseFloat(step.pct) || 0;
            const width = `${Math.max(pctNum, 4)}%`;
            const colors = ["bg-zinc-500", "bg-blue-500", "bg-[#d4a853]", "bg-emerald-500"];
            return (
              <div key={step.label} className="flex flex-1 flex-col items-center gap-2">
                <p className="text-xs font-bold text-white tabular-nums">{step.value.toLocaleString()}</p>
                <div
                  className={`w-full rounded-t-md ${colors[i] ?? "bg-zinc-600"} transition-all`}
                  style={{ height: `${Math.max(pctNum * 1.2, 6)}px`, minHeight: "6px" }}
                />
                <p className="text-center text-[10px] text-zinc-500 leading-tight">{step.label}</p>
                <p className="text-xs font-semibold text-zinc-400">{step.pct}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-zinc-400">
          Overall trial → paid conversion: <span className="font-bold text-[#d4a853]">{data.conversionRate}%</span>
        </p>
      </div>

      {/* Cohort table */}
      <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">Signup cohorts — last 6 months</h2>
        <FunnelCharts cohorts={data.cohorts} />
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left">
              <th className="pb-2 text-xs font-medium text-zinc-500">Month</th>
              <th className="pb-2 text-right text-xs font-medium text-zinc-500">Signups</th>
              <th className="pb-2 text-right text-xs font-medium text-zinc-500">Converted</th>
              <th className="pb-2 text-right text-xs font-medium text-zinc-500">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((c) => (
              <tr key={c.month} className="border-b border-white/[0.04] last:border-0">
                <td className="py-2.5 text-zinc-300">{c.month}</td>
                <td className="py-2.5 text-right text-zinc-400 tabular-nums">{c.signups}</td>
                <td className="py-2.5 text-right text-zinc-400 tabular-nums">{c.converted}</td>
                <td className="py-2.5 text-right font-semibold tabular-nums">
                  <span className={
                    parseInt(c.rate) >= 20 ? "text-emerald-400" :
                    parseInt(c.rate) >= 5  ? "text-[#d4a853]" :
                    parseInt(c.rate) > 0   ? "text-zinc-300" : "text-zinc-600"
                  }>
                    {c.rate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Churn stats + list */}
      {data.hasStripe && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Churn — last 90 days</h2>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-600">30d MRR lost</p>
                <p className="text-sm font-bold text-red-400">{fmtC(data.mrrLostLast30)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-600">90d MRR lost</p>
                <p className="text-sm font-bold text-red-400">{fmtC(data.mrrLostLast90)}</p>
              </div>
            </div>
          </div>
          {data.canceledList.length === 0 ? (
            <p className="text-sm text-zinc-600">No verified-paid cancellations in the last 90 days.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="pb-2 text-xs font-medium text-zinc-500">Customer</th>
                  <th className="pb-2 text-xs font-medium text-zinc-500">Plan</th>
                  <th className="pb-2 text-right text-xs font-medium text-zinc-500">MRR lost</th>
                  <th className="pb-2 text-right text-xs font-medium text-zinc-500">Canceled</th>
                </tr>
              </thead>
              <tbody>
                {data.canceledList.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 font-mono text-xs text-zinc-300">{c.email}</td>
                    <td className="py-2.5 text-zinc-400">{planLabel(c.plan)}</td>
                    <td className="py-2.5 text-right font-mono text-sm text-red-400 tabular-nums">{fmtC(c.mrr)}</td>
                    <td className="py-2.5 text-right text-xs text-zinc-500">
                      {new Date(c.canceledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!data.hasStripe && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-sm text-zinc-600">Configure STRIPE_SECRET_KEY to see churn details.</p>
        </div>
      )}
    </div>
  );
}
