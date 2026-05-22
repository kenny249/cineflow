import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

export default function FinancesPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Finances</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Cineflow subscription revenue (requires Stripe billing setup)</p>
      </div>

      {/* Notice */}
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-300">Stripe subscription billing not yet configured</p>
          <p className="mt-0.5 text-xs text-amber-400/70">
            This tab will show MRR, churn, and revenue once Cineflow subscription plans are set up in Stripe.
            This is the next build item after the admin portal.
          </p>
        </div>
      </div>

      {/* Placeholder metrics */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          { label: "MRR", value: "—", icon: DollarSign, note: "Monthly recurring revenue" },
          { label: "ARR", value: "—", icon: TrendingUp, note: "Annual run rate" },
          { label: "Paid users", value: "—", icon: DollarSign, note: "Active subscriptions" },
          { label: "Churn rate", value: "—", icon: TrendingUp, note: "Last 30 days" },
        ].map(({ label, value, icon: Icon, note }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-zinc-600" />
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
            <p className="text-2xl font-bold text-zinc-600">{value}</p>
            <p className="mt-1 text-xs text-zinc-700">{note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <DollarSign className="mx-auto mb-3 h-10 w-10 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">Revenue dashboard coming soon</p>
        <p className="mt-1 text-xs text-zinc-700 max-w-sm mx-auto">
          Once Stripe subscription plans are configured, this will show real-time MRR, new subscriptions,
          cancellations, and per-plan revenue breakdown.
        </p>
      </div>
    </div>
  );
}
