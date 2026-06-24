"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, Zap, RefreshCw,
  ChevronUp, ChevronDown, Minus, Target, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Model ──────────────────────────────────────────────────────────────────────

interface ModelParams {
  startMRR: number;
  startTrials: number;
  startPaid: number;
  monthlySignups: number;
  conversionRate: number; // % of trial pool that converts each month
  churnRate: number;      // % of paid users that churn each month
  arpu: number;
  months: number;
}

interface MonthPoint {
  label: string;
  mrr: number;
  arr: number;
  paid: number;
  trials: number;
  newPaid: number;
  churned: number;
}

function computeModel(p: ModelParams): MonthPoint[] {
  const points: MonthPoint[] = [];
  let trials = p.startTrials;
  let paid = p.startPaid;
  const now = new Date();

  // Month 0 — current state
  points.push({
    label: "Now",
    mrr: p.startMRR || paid * p.arpu,
    arr: (p.startMRR || paid * p.arpu) * 12,
    paid,
    trials,
    newPaid: 0,
    churned: 0,
  });

  for (let i = 1; i <= p.months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: i > 12 ? "2-digit" : undefined });

    const newPaid = Math.round(trials * (p.conversionRate / 100));
    const churned = Math.round(paid * (p.churnRate / 100));

    paid = Math.max(0, paid + newPaid - churned);
    trials = Math.max(0, trials - newPaid) + p.monthlySignups;

    const mrr = paid * p.arpu;
    points.push({ label, mrr, arr: mrr * 12, paid, trials: Math.round(trials), newPaid, churned });
  }

  return points;
}

function monthsToTarget(points: MonthPoint[], target: number): number | null {
  for (let i = 1; i < points.length; i++) {
    if (points[i].mrr >= target) return i;
  }
  return null;
}

// ── Scenarios ──────────────────────────────────────────────────────────────────

const SCENARIOS = {
  conservative: { label: "Conservative", monthlySignups: 5,  conversionRate: 8,  churnRate: 6,  color: "zinc" },
  realistic:    { label: "Realistic",    monthlySignups: 15, conversionRate: 15, churnRate: 3,  color: "amber" },
  aggressive:   { label: "Aggressive",   monthlySignups: 40, conversionRate: 25, churnRate: 1.5, color: "emerald" },
} as const;

type Scenario = keyof typeof SCENARIOS;

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOLD = "#d4a853";
const GREEN = "#34d399";
const BLUE = "#60a5fa";
const RED = "#f87171";

const fmt = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
    : `$${Math.round(n)}`;

const fmtFull = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function Slider({
  label, value, min, max, step, onChange, format, description,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; description?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color: GOLD }}>{format(value)}</span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/[0.06]" />
        <div
          className="absolute left-0 h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}88, ${GOLD})` }}
        />
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-6"
        />
        <div
          className="absolute w-4 h-4 rounded-full border-2 shadow-lg pointer-events-none"
          style={{
            left: `calc(${pct}% - 8px)`,
            borderColor: GOLD,
            background: "#1a1a1a",
            boxShadow: `0 0 8px ${GOLD}66`,
          }}
        />
      </div>
      {description && <p className="text-[10px] text-zinc-600 leading-relaxed">{description}</p>}
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = "gold", trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: "gold" | "green" | "blue" | "red"; trend?: "up" | "down" | "flat";
}) {
  const colors = { gold: GOLD, green: GREEN, blue: BLUE, red: RED };
  const c = colors[color];
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c}15` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: c }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-black text-white tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>}
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-semibold",
          trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500"
        )}>
          {trend === "up" && <ChevronUp className="h-3 w-3" />}
          {trend === "down" && <ChevronDown className="h-3 w-3" />}
          {trend === "flat" && <Minus className="h-3 w-3" />}
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#111] p-3 shadow-2xl text-xs space-y-1.5 min-w-[160px]">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4">
          <span style={{ color: entry.color }} className="text-[11px]">{entry.name}</span>
          <span className="font-bold text-white tabular-nums">
            {entry.dataKey === "mrr" || entry.dataKey === "arr"
              ? fmtFull(entry.value)
              : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface SeedData {
  mrr: number;
  activeTrials: number;
  paidCount: number;
  avgMonthlySignups: number;
}

export function GrowthModelClient() {
  const [seed, setSeed] = useState<SeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>("realistic");

  // Slider state
  const [monthlySignups, setMonthlySignups] = useState(15);
  const [conversionRate, setConversionRate] = useState(15);
  const [churnRate, setChurnRate] = useState(3);
  const [arpu, setArpu] = useState(49);
  const [months, setMonths] = useState(12);
  const [startPaid, setStartPaid] = useState(0);
  const [startTrials, setStartTrials] = useState(0);
  const [startMRR, setStartMRR] = useState(0);

  useEffect(() => {
    fetch("/api/admin/growth-model/seed")
      .then((r) => r.json())
      .then((d: SeedData) => {
        setSeed(d);
        setStartMRR(d.mrr);
        setStartTrials(d.activeTrials);
        setStartPaid(d.paidCount);
        setMonthlySignups(Math.max(d.avgMonthlySignups, 5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function applyScenario(s: Scenario) {
    setActiveScenario(s);
    setMonthlySignups(SCENARIOS[s].monthlySignups);
    setConversionRate(SCENARIOS[s].conversionRate);
    setChurnRate(SCENARIOS[s].churnRate);
  }

  function handleSliderChange() {
    setActiveScenario(null);
  }

  const data = useMemo(() => computeModel({
    startMRR, startTrials, startPaid, monthlySignups, conversionRate, churnRate, arpu, months,
  }), [startMRR, startTrials, startPaid, monthlySignups, conversionRate, churnRate, arpu, months]);

  const finalMRR = data[data.length - 1]?.mrr ?? 0;
  const finalPaid = data[data.length - 1]?.paid ?? 0;
  const finalARR = finalMRR * 12;
  const mrrGrowth = finalMRR - (data[0]?.mrr ?? 0);
  const mrrGrowthPct = data[0]?.mrr ? Math.round((mrrGrowth / data[0].mrr) * 100) : null;

  const to1k = monthsToTarget(data, 1000);
  const to5k = monthsToTarget(data, 5000);
  const to10k = monthsToTarget(data, 10000);

  // Determine Y axis max
  const maxMRR = Math.max(...data.map((d) => d.mrr), 1000);
  const milestones = [1000, 5000, 10000, 25000, 50000].filter((m) => m <= maxMRR * 1.2);

  // Insight string
  const insight = useMemo(() => {
    if (finalMRR < 1000) return `At this rate you won't reach $1K MRR in ${months} months — try increasing signups or conversion rate.`;
    if (to1k && !to5k) return `You'll hit $1K MRR in month ${to1k}, but need more velocity to reach $5K. Focus on increasing monthly signups or reducing churn.`;
    if (to5k && !to10k) return `$5K MRR in month ${to5k}. Solid trajectory — tighten churn and you'll push toward $10K.`;
    if (to10k) return `$10K MRR in month ${to10k}. That's $${Math.round(finalARR / 1000)}K ARR by end of projection. 🔥`;
    return `Projecting ${fmtFull(finalMRR)} MRR at end of period.`;
  }, [finalMRR, finalARR, to1k, to5k, to10k, months]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#080808]">
        <div className="flex items-center gap-3 text-zinc-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading live data…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#080808]">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#080808]/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Growth Model</p>
          <p className="text-[10px] text-zinc-600">Seeded from live data · drag sliders to simulate</p>
        </div>
        <div className="flex items-center gap-2">
          {seed && (
            <span className="text-[10px] text-zinc-600 border border-white/[0.06] rounded-lg px-2.5 py-1.5">
              Live: {seed.paidCount} paid · {seed.activeTrials} trials · {seed.mrr > 0 ? fmtFull(seed.mrr) + " MRR" : "pre-revenue"}
            </span>
          )}
          <button
            onClick={() => {
              setStartMRR(seed?.mrr ?? 0);
              setStartTrials(seed?.activeTrials ?? 0);
              setStartPaid(seed?.paidCount ?? 0);
              setMonthlySignups(Math.max(seed?.avgMonthlySignups ?? 5, 5));
              applyScenario("realistic");
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">

        {/* Insight banner */}
        <div className="flex items-center gap-3 rounded-xl border px-5 py-4"
          style={{ borderColor: `${GOLD}30`, background: `${GOLD}08` }}>
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
          <p className="text-sm text-zinc-200 leading-relaxed">{insight}</p>
        </div>

        {/* Scenario presets */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Scenario Presets</p>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(SCENARIOS) as Scenario[]).map((key) => {
              const s = SCENARIOS[key];
              const isActive = activeScenario === key;
              return (
                <button
                  key={key}
                  onClick={() => applyScenario(key)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? "border-[#d4a853]/40 bg-[#d4a853]/08"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  )}
                >
                  <p className={cn("text-sm font-bold mb-1", isActive ? "text-[#d4a853]" : "text-white")}>{s.label}</p>
                  <p className="text-[10px] text-zinc-600">
                    {s.monthlySignups} signups/mo · {s.conversionRate}% conversion · {s.churnRate}% churn
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main layout: chart + sliders */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* MRR Chart */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">MRR Projection</p>
                <p className="text-2xl font-black text-white mt-1">{fmtFull(finalMRR)} <span className="text-sm font-normal text-zinc-500">at month {months}</span></p>
              </div>
              {mrrGrowthPct !== null && (
                <div className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold",
                  mrrGrowth >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                )}>
                  {mrrGrowth >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {mrrGrowthPct}% growth
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmt(v)}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                {milestones.map((m) => (
                  <ReferenceLine
                    key={m}
                    y={m}
                    stroke="#ffffff18"
                    strokeDasharray="4 4"
                    label={{
                      value: fmt(m),
                      position: "insideTopRight",
                      fill: "#52525b",
                      fontSize: 9,
                      fontWeight: "bold",
                    }}
                  />
                ))}
                <Area
                  type="monotone"
                  dataKey="mrr"
                  name="MRR"
                  stroke={GOLD}
                  strokeWidth={2.5}
                  fill="url(#mrrGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: GOLD, stroke: "#111", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Sliders */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Model Inputs</p>
            <Slider
              label="New signups / month"
              value={monthlySignups}
              min={1} max={5000} step={5}
              onChange={(v) => { setMonthlySignups(v); handleSliderChange(); }}
              format={(v) => `${v}`}
              description="Organic + referral new users entering trial each month"
            />
            <Slider
              label="Trial → Paid conversion"
              value={conversionRate}
              min={1} max={50} step={0.5}
              onChange={(v) => { setConversionRate(v); handleSliderChange(); }}
              format={(v) => `${v}%`}
              description="% of your active trial pool that converts each month. Industry avg: 10–20%"
            />
            <Slider
              label="Monthly churn"
              value={churnRate}
              min={0.5} max={15} step={0.5}
              onChange={(v) => { setChurnRate(v); handleSliderChange(); }}
              format={(v) => `${v}%`}
              description="% of paid users who cancel each month. Great SaaS: 2–4%"
            />
            <Slider
              label="Avg revenue per user (ARPU)"
              value={arpu}
              min={10} max={300} step={1}
              onChange={(v) => { setArpu(v); handleSliderChange(); }}
              format={(v) => `$${v}`}
              description="Solo plan is $39 · Studio is $79 · mix shifts this over time"
            />
            <Slider
              label="Projection window"
              value={months}
              min={6} max={24} step={6}
              onChange={(v) => { setMonths(v); handleSliderChange(); }}
              format={(v) => `${v}mo`}
            />
          </div>
        </div>

        {/* Key milestone stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Time to $1K MRR"
            value={to1k ? `Mo. ${to1k}` : "—"}
            sub={to1k ? `${new Date(new Date().setMonth(new Date().getMonth() + to1k)).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : `Not in ${months} months`}
            icon={Target}
            color={to1k ? "gold" : "red"}
          />
          <StatCard
            label="Time to $5K MRR"
            value={to5k ? `Mo. ${to5k}` : "—"}
            sub={to5k ? `${new Date(new Date().setMonth(new Date().getMonth() + to5k)).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : `Not in ${months} months`}
            icon={Target}
            color={to5k ? "green" : "red"}
          />
          <StatCard
            label={`MRR at Mo. ${months}`}
            value={fmtFull(finalMRR)}
            sub={`${finalPaid} paying users`}
            icon={DollarSign}
            color="gold"
            trend={mrrGrowth > 0 ? "up" : mrrGrowth < 0 ? "down" : "flat"}
          />
          <StatCard
            label="Projected ARR"
            value={fmtFull(finalARR)}
            sub={`${finalMRR > 0 ? `$${Math.round(finalARR / 1000)}K run rate` : "Pre-revenue"}`}
            icon={TrendingUp}
            color="blue"
          />
        </div>

        {/* Users chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-6">User Pipeline — Paid vs. Trials Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barSize={16} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 10, color: "#71717a" }}
                formatter={(v) => <span style={{ color: "#a1a1aa", fontSize: 10 }}>{v}</span>}
              />
              <Bar dataKey="paid" name="Paid Users" fill={GOLD} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
              <Bar dataKey="trials" name="Active Trials" fill={BLUE} fillOpacity={0.4} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sensitivity table */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Sensitivity — MRR at Month {months}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">How different conversion rates affect outcome at your current signup rate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Conversion %</th>
                  {[1, 2, 3, 4, 5, 8, 10].map((churn) => (
                    <th key={churn} className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {churn}% churn
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[5, 10, 15, 20, 30].map((conv, ri) => (
                  <tr key={conv} className={cn("border-b border-white/[0.03]", ri % 2 === 0 ? "" : "bg-white/[0.01]")}>
                    <td className="px-4 py-2.5 font-semibold text-zinc-300">{conv}%</td>
                    {[1, 2, 3, 4, 5, 8, 10].map((churn) => {
                      const pts = computeModel({ startMRR, startTrials, startPaid, monthlySignups, conversionRate: conv, churnRate: churn, arpu, months });
                      const m = pts[pts.length - 1]?.mrr ?? 0;
                      const isCurrentish = Math.abs(conv - conversionRate) < 3 && Math.abs(churn - churnRate) < 1;
                      return (
                        <td key={churn} className={cn("px-4 py-2.5 text-center tabular-nums font-medium", isCurrentish ? "text-[#d4a853]" : m >= 10000 ? "text-emerald-400" : m >= 5000 ? "text-zinc-200" : "text-zinc-500")}>
                          {fmt(m)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key assumptions */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-4">Model Assumptions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Trial pool", detail: "All new signups enter a trial. Conversion % applies to the full active trial pool each month." },
              { label: "Churn timing", detail: "Churn applies to paid users each month. Churned users leave the paid pool immediately." },
              { label: "ARPU is fixed", detail: "The model uses a constant ARPU. In reality this will shift as plan mix changes." },
              { label: "No seasonality", detail: "Signup rate is constant month-over-month. Real growth will have peaks and troughs." },
              { label: "No expansion revenue", detail: "Upgrades from Solo → Studio → Agency are not modeled here. Real ARR will be higher." },
              { label: "Starting state", detail: `Seeded from live data: ${seed?.paidCount ?? 0} paid, ${seed?.activeTrials ?? 0} trials, ${seed?.mrr ? fmtFull(seed.mrr) : "$0"} MRR.` },
            ].map((a) => (
              <div key={a.label} className="flex items-start gap-2">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: GOLD }} />
                <div>
                  <p className="text-[11px] font-semibold text-zinc-300">{a.label}</p>
                  <p className="text-[10px] text-zinc-600 leading-relaxed mt-0.5">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}
