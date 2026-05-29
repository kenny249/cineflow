import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { stripe, PLANS, getPlanByPriceId } from "@/lib/stripe";
import type Stripe from "stripe";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

async function fetchFinancials() {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  // Paginate all active subscriptions
  const activeSubs: Stripe.Subscription[] = [];
  let cursor: string | undefined;
  do {
    const page = await stripe.subscriptions.list({ status: "active", limit: 100, starting_after: cursor, expand: ["data.items.data.price"] });
    activeSubs.push(...page.data);
    cursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
  } while (cursor);

  // Fetch recently canceled subs and filter in-memory by canceled_at
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const recentCanceled = await stripe.subscriptions.list({ status: "canceled", limit: 100 });
  const canceledSubs = recentCanceled.data.filter(
    (s) => s.canceled_at != null && s.canceled_at >= thirtyDaysAgo
  );

  // MRR: monthly equivalent of each active sub
  let mrr = 0;
  const planCounts: Record<string, { count: number; mrr: number }> = {};

  for (const sub of activeSubs) {
    const item = sub.items.data[0];
    if (!item) continue;
    const price = item.price as Stripe.Price;
    const unitAmount = (price.unit_amount ?? 0) / 100;
    const monthlyAmount = price.recurring?.interval === "year"
      ? unitAmount / 12
      : unitAmount;
    mrr += monthlyAmount;

    const planKey = getPlanByPriceId(price.id) ?? "unknown";
    if (!planCounts[planKey]) planCounts[planKey] = { count: 0, mrr: 0 };
    planCounts[planKey].count++;
    planCounts[planKey].mrr += monthlyAmount;
  }

  // Churn: canceled last 30d / (active + canceled last 30d)
  const churnBase = activeSubs.length + canceledSubs.length;
  const churnRate = churnBase > 0 ? (canceledSubs.length / churnBase) * 100 : 0;

  // Recent events: last 20 subscription-related events
  const events = await stripe.events.list({
    types: ["customer.subscription.created", "customer.subscription.deleted", "customer.subscription.updated"],
    limit: 20,
  });

  return { mrr, arr: mrr * 12, paidUsers: activeSubs.length, canceledLast30: canceledSubs.length, churnRate, planCounts, events: events.data };
}

function planLabel(key: string) {
  return PLANS[key as keyof typeof PLANS]?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default async function FinancesPage() {
  const data = await fetchFinancials();

  if (!data) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Finances</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Cineflow subscription revenue</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-300">STRIPE_SECRET_KEY not configured</p>
            <p className="mt-0.5 text-xs text-amber-400/70">Add your Stripe secret key to environment variables to see live revenue data.</p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "MRR", value: fmt(data.mrr), icon: DollarSign, note: "Monthly recurring revenue", color: "text-[#d4a853]" },
    { label: "ARR", value: fmt(data.arr), icon: TrendingUp, note: "Annual run rate", color: "text-emerald-400" },
    { label: "Paid users", value: data.paidUsers.toLocaleString(), icon: Users, note: "Active subscriptions", color: "text-blue-400" },
    { label: "Churn rate", value: `${data.churnRate.toFixed(1)}%`, icon: TrendingDown, note: "Last 30 days", color: data.churnRate > 5 ? "text-red-400" : "text-zinc-300" },
  ];

  const planOrder = ["solo", "studio", "agency", "enterprise", "lifetime", "unknown"] as const;
  const planRows = planOrder
    .filter(k => data.planCounts[k]?.count > 0)
    .map(k => ({ key: k, ...data.planCounts[k] }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Finances</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Live Stripe revenue data</p>
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {metrics.map(({ label, value, icon: Icon, note, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
              <Icon className="h-4 w-4 text-zinc-600" />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="mt-1 text-xs text-zinc-600">{note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">

        {/* Plan breakdown */}
        <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Revenue by Plan</h2>
          {planRows.length === 0 ? (
            <p className="text-sm text-zinc-600">No active subscriptions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/[0.06]">
                  <th className="pb-2 text-xs text-zinc-500 font-medium">Plan</th>
                  <th className="pb-2 text-xs text-zinc-500 font-medium text-right">Subscribers</th>
                  <th className="pb-2 text-xs text-zinc-500 font-medium text-right">MRR</th>
                  <th className="pb-2 text-xs text-zinc-500 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {planRows.map(({ key, count, mrr: planMrr }) => (
                  <tr key={key} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-3 text-zinc-300 font-medium">{planLabel(key)}</td>
                    <td className="py-3 text-zinc-400 text-right">{count}</td>
                    <td className="py-3 text-[#d4a853] font-mono text-right">{fmtFull(planMrr)}</td>
                    <td className="py-3 text-zinc-500 text-right">
                      {data.mrr > 0 ? `${((planMrr / data.mrr) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
                {planRows.length > 1 && (
                  <tr className="border-t border-white/[0.08]">
                    <td className="pt-3 text-zinc-400 font-semibold">Total</td>
                    <td className="pt-3 text-zinc-300 font-semibold text-right">{data.paidUsers}</td>
                    <td className="pt-3 text-[#d4a853] font-semibold font-mono text-right">{fmtFull(data.mrr)}</td>
                    <td className="pt-3 text-zinc-400 text-right">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Churn / cancellations */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Churn (30d)</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Cancellations</p>
              <p className="text-2xl font-bold text-zinc-300">{data.canceledLast30}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Churn rate</p>
              <p className={`text-2xl font-bold ${data.churnRate > 5 ? "text-red-400" : data.churnRate > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {data.churnRate.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-3 py-2">
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                {data.canceledLast30 === 0
                  ? "No cancellations in the last 30 days."
                  : `${data.canceledLast30} subscription${data.canceledLast30 > 1 ? "s" : ""} canceled in the last 30 days out of ${data.paidUsers + data.canceledLast30} total.`}
              </p>
            </div>
          </div>
        </div>

        {/* Recent subscription events */}
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Recent Subscription Events</h2>
          {data.events.length === 0 ? (
            <p className="text-sm text-zinc-600">No recent events.</p>
          ) : (
            <div className="space-y-1">
              {data.events.map((ev) => {
                const sub = ev.data.object as Stripe.Subscription;
                const priceId = sub.items?.data[0]?.price?.id;
                const planKey = priceId ? getPlanByPriceId(priceId) : null;
                const isNew = ev.type === "customer.subscription.created";
                const isCanceled = ev.type === "customer.subscription.deleted";
                const date = new Date(ev.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                return (
                  <div key={ev.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.03] transition-colors">
                    <div className="flex items-center gap-3">
                      {isNew ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : isCanceled ? (
                        <ArrowDownRight className="h-4 w-4 text-red-400 shrink-0" />
                      ) : (
                        <Minus className="h-4 w-4 text-zinc-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-zinc-300">
                          {isNew ? "New subscription" : isCanceled ? "Cancellation" : "Subscription updated"}
                          {planKey && <span className="ml-2 text-xs text-zinc-500">· {planLabel(planKey)}</span>}
                        </p>
                        <p className="text-xs text-zinc-600 font-mono">{sub.id}</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 shrink-0">{date}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
