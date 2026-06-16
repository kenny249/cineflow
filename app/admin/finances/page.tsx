import { DollarSign, TrendingUp, TrendingDown, Users, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, FlaskConical } from "lucide-react";
import { stripe, PLANS, getPlanByPriceId } from "@/lib/stripe";
import { requireAdminPage } from "@/lib/admin-guard";
import { MrrChart } from "./FinancesCharts";
import type Stripe from "stripe";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

async function fetchFinancials() {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith("sk_test_");

  // Paginate all active subscriptions, expanding latest_invoice to verify real payment
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

  // Filter to only subscriptions with actual collected payment — excludes:
  //   • $0 coupons / gifted accounts
  //   • test subscriptions that were never charged
  //   • free trials that haven't converted
  const paidSubs = activeSubs.filter((sub) => {
    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    if (!invoice) return false;
    // Must have collected at least $1 (amount_paid is in cents)
    return invoice.amount_paid != null && invoice.amount_paid >= 100;
  });

  // MRR: monthly equivalent of each verified-paid sub
  let mrr = 0;
  const planCounts: Record<string, { count: number; mrr: number }> = {};

  for (const sub of paidSubs) {
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

  // Canceled in last 30 days (verified: had real payment before canceling)
  const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
  const recentCanceled = await stripe.subscriptions.list({
    status: "canceled",
    limit: 100,
    expand: ["data.latest_invoice"],
  });
  const canceledSubs = recentCanceled.data.filter((s) => {
    if (s.canceled_at == null || s.canceled_at < thirtyDaysAgo) return false;
    const invoice = s.latest_invoice as Stripe.Invoice | null;
    return invoice?.amount_paid != null && invoice.amount_paid >= 100;
  });

  // Churn: monthly logo churn = canceled last 30d / active verified-paid
  const churnRate = paidSubs.length > 0 ? (canceledSubs.length / paidSubs.length) * 100 : 0;

  // Skipped subs: active but $0 / unverified (gifted, test, coupon-to-zero)
  const skippedCount = activeSubs.length - paidSubs.length;

  // Recent subscription events (real payment events only)
  const events = await stripe.events.list({
    types: [
      "customer.subscription.created",
      "customer.subscription.deleted",
      "customer.subscription.updated",
    ],
    limit: 20,
  });

  // ARPU per plan
  const arpu: Record<string, number> = {};
  for (const [key, { count, mrr: planMrr }] of Object.entries(planCounts)) {
    arpu[key] = count > 0 ? planMrr / count : 0;
  }
  const totalArpu = paidSubs.length > 0 ? mrr / paidSubs.length : 0;

  // Monthly revenue — last 6 months (paid invoices, cents → dollars)
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  const now = Date.now();
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(1);
    start.setMonth(start.getMonth() - i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    let total = 0;
    let hasCursor: string | undefined;
    do {
      const page = await stripe.invoices.list({
        status: "paid",
        created: { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(end.getTime() / 1000) },
        limit: 100,
        starting_after: hasCursor,
      });
      for (const inv of page.data) total += (inv.amount_paid ?? 0) / 100;
      hasCursor = page.has_more ? page.data[page.data.length - 1].id : undefined;
    } while (hasCursor);

    monthlyRevenue.push({
      month: start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue: total,
    });
  }

  return {
    isTestMode,
    mrr,
    arr: mrr * 12,
    paidUsers: paidSubs.length,
    canceledLast30: canceledSubs.length,
    churnRate,
    planCounts,
    skippedCount,
    events: events.data,
    arpu,
    totalArpu,
    monthlyRevenue,
  };
}

function planLabel(key: string) {
  return PLANS[key as keyof typeof PLANS]?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default async function FinancesPage() {
  await requireAdminPage();
  const data = await fetchFinancials();

  if (!data) {
    return (
      <div className="p-4 md:p-8">
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
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Finances</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live Stripe revenue data · verified paid only
          </p>
        </div>
        {data.isTestMode && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">TEST MODE — not real revenue</span>
          </div>
        )}
      </div>

      {/* Test mode banner */}
      {data.isTestMode && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-300">Stripe is in test mode</p>
            <p className="mt-0.5 text-xs text-amber-400/70">
              Your <code className="font-mono">STRIPE_SECRET_KEY</code> starts with <code className="font-mono">sk_test_</code>.
              All numbers below are fake test data. Switch to your live key (<code className="font-mono">sk_live_</code>) to see real revenue.
            </p>
          </div>
        </div>
      )}

      {/* Skipped/gifted accounts notice */}
      {data.skippedCount > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-400">{data.skippedCount} active Stripe subscription{data.skippedCount > 1 ? "s" : ""} excluded</span>
            {" "}— no verified payment on record (gifted accounts, $0 coupons, or unconverted trials).
            These are not counted in MRR or paid user totals.
          </p>
        </div>
      )}

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">

        {/* Plan breakdown */}
        <div className="md:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Revenue by Plan</h2>
          {planRows.length === 0 ? (
            <p className="text-sm text-zinc-600">No verified paid subscriptions yet.</p>
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

        {/* ARPU */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">ARPU</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Overall ARPU</p>
              <p className="text-2xl font-bold text-[#d4a853]">{fmtFull(data.totalArpu)}</p>
              <p className="text-xs text-zinc-600 mt-0.5">avg revenue per paid user / mo</p>
            </div>
            <div className="pt-2 space-y-2 border-t border-white/[0.04]">
              {planOrder.filter(k => data.planCounts[k]?.count > 0).map(k => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{planLabel(k)}</span>
                  <span className="text-xs font-mono text-zinc-300">{fmtFull(data.arpu[k] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
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
                  : `${data.canceledLast30} verified-paid subscription${data.canceledLast30 > 1 ? "s" : ""} canceled in the last 30 days.`}
              </p>
            </div>
          </div>
        </div>

        {/* Monthly revenue chart */}
        <div className="md:col-span-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-4">Revenue — last 6 months</h2>
          <MrrChart data={data.monthlyRevenue} />
        </div>

        {/* Recent subscription events */}
        <div className="md:col-span-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
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
                const date = new Date(ev.created * 1000).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });

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
          <p className="mt-4 text-[11px] text-zinc-700">
            Note: event log shows all Stripe subscription activity. MRR and paid-user counts above only include subscriptions with verified collected payments.
          </p>
        </div>

      </div>
    </div>
  );
}
