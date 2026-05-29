"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

const GOLD = "#d4a853";
const GRID = "rgba(255,255,255,0.04)";
const AXIS = "#52525b";

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="mb-4 text-sm font-semibold text-zinc-300">{title}</p>
      {children}
    </div>
  );
}

export function AnalyticsCharts({
  signupChart,
  planChart,
  featureUsage,
  monthlySignupChart,
}: {
  signupChart: { date: string; signups: number }[];
  planChart: { plan: string; count: number }[];
  featureUsage: { feature: string; users: number }[];
  monthlySignupChart: { month: string; signups: number }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <ChartCard title="Signups — last 30 days">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={signupChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={6} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: GOLD }}
            />
            <Area type="monotone" dataKey="signups" stroke={GOLD} strokeWidth={2} fill="url(#goldGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Plan distribution">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={planChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="plan" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: GOLD }}
            />
            <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Feature adoption (unique users)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={featureUsage} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis dataKey="feature" type="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} tickLine={false} axisLine={false} width={72} />
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: GOLD }}
            />
            <Bar dataKey="users" fill={GOLD} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly signups — last 6 months">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlySignupChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "#a1a1aa" }}
              itemStyle={{ color: GOLD }}
            />
            <Bar dataKey="signups" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
