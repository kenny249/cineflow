"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type CohortRow = { month: string; signups: number; converted: number; rate: string };

export function FunnelCharts({ cohorts }: { cohorts: CohortRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={cohorts} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barGap={4}>
        <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#e4e4e7", marginBottom: 4 }}
          itemStyle={{ color: "#a1a1aa" }}
          formatter={(val, name) => [val, name === "signups" ? "Signups" : "Converted"]}
        />
        <Bar dataKey="signups" fill="rgba(255,255,255,0.08)" radius={[4, 4, 0, 0]} name="signups" />
        <Bar dataKey="converted" fill="#d4a853" radius={[4, 4, 0, 0]} name="converted" />
      </BarChart>
    </ResponsiveContainer>
  );
}
