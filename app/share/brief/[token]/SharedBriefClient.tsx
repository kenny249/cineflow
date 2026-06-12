"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell,
} from "recharts";
import {
  TrendingUp, ChevronRight, Check, X as XIcon, ExternalLink, Sparkles,
} from "lucide-react";
import { BRIEF } from "@/lib/brief.config";
import { cn } from "@/lib/utils";

const GOLD = "#d4a853";

type LiveMetrics = { totalUsers: number; activeTrials: number; activeRecently: number; totalProjects: number };

function StatCard({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function SectionHeader({ label, number }: { label: string; number: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10">
        <span className="text-[10px] font-bold text-[#d4a853]">{number}</span>
      </div>
      <h2 className="font-display text-xl font-bold text-white">{label}</h2>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

export function SharedBriefClient() {
  const [metrics, setMetrics] = useState<LiveMetrics>({ totalUsers: 0, activeTrials: 0, activeRecently: 0, totalProjects: 0 });

  useEffect(() => {
    // Metrics from a public endpoint that only returns aggregate counts — no PII
    fetch("/api/share/brief/metrics")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMetrics({ ...d, activeRecently: d.activeRecently ?? 0 }); })
      .catch(() => {});
  }, []);

  const pricingChartData = [
    { name: "CineFlow", price: 39, fill: GOLD },
    { name: "Frame.io", price: 25, fill: "#6b7280" },
    { name: "StudioBinder", price: 29, fill: "#6b7280" },
    { name: "Wipster", price: 25, fill: "#6b7280" },
    { name: "Notion", price: 16, fill: "#6b7280" },
  ];

  const savingsChartData = BRIEF.roi.savings.map(s => ({
    name: s.tool.replace(" (Pro)", "").replace(" (Indie)", ""),
    cost: s.cost,
  }));

  const radarData = [
    { subject: "AI Tools",       CineFlow: 100, Others: 0 },
    { subject: "Project Mgmt",   CineFlow: 95,  Others: 70 },
    { subject: "Client Portal",  CineFlow: 90,  Others: 80 },
    { subject: "Finance",        CineFlow: 85,  Others: 10 },
    { subject: "Collaboration",  CineFlow: 90,  Others: 60 },
    { subject: "Film-specific",  CineFlow: 100, Others: 30 },
  ];

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#080808]/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
            <span className="text-xs font-black" style={{ color: GOLD }}>C</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4a853]">CineFlow</p>
          <span className="text-zinc-700">·</span>
          <p className="text-[11px] text-zinc-600">Company Brief · Confidential</p>
        </div>
        <a
          href={`https://${BRIEF.company.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-[#d4a853]"
        >
          {BRIEF.company.website}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-10">

        {/* Hero */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a853]/20 bg-[#d4a853]/5 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-[#d4a853] uppercase tracking-widest">{BRIEF.company.stage}</span>
          </div>
          <h1 className="font-display text-5xl font-black text-white mb-4">{BRIEF.company.name}</h1>
          <p className="text-xl text-zinc-300 max-w-2xl mx-auto mb-4">{BRIEF.company.tagline}</p>
          <p className="text-sm text-zinc-500 max-w-2xl mx-auto leading-relaxed">{BRIEF.company.mission}</p>
        </div>

        {/* Live Traction */}
        <div>
          <SectionHeader label="Live Traction" number="00" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard value={metrics.totalUsers.toLocaleString()} label="Real Users" sub="All-time signups" />
            <StatCard value={metrics.activeRecently.toLocaleString()} label="Active (30d)" sub="Logged in last 30 days" />
            <StatCard value={metrics.activeTrials.toLocaleString()} label="Active Trials" sub="Trial not yet expired" />
            <StatCard value={metrics.totalProjects.toLocaleString()} label="Projects" sub="Created by real users" />
          </div>
        </div>

        {/* Problem */}
        <div>
          <SectionHeader label={BRIEF.problem.headline} number="01" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BRIEF.problem.points.map((p) => (
              <div key={p.stat} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-4xl font-black text-[#d4a853] mb-1">{p.stat}</p>
                <p className="text-sm font-semibold text-white mb-1">{p.label}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Solution */}
        <div>
          <SectionHeader label={BRIEF.solution.headline} number="02" />
          <p className="text-base text-zinc-300 leading-relaxed max-w-3xl">{BRIEF.solution.description}</p>
        </div>

        {/* Features */}
        <div>
          <SectionHeader label="Product Features" number="03" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BRIEF.features.map((f) => (
              <div key={f.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-sm font-bold text-white mb-1.5">{f.name}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">{f.description}</p>
                <ul className="space-y-1">
                  {f.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-[11px] text-zinc-400">
                      <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-[#d4a853]" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <SectionHeader label="Pricing" number="04" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {BRIEF.pricing.tiers.map((t) => (
              <div key={t.name} className={cn(
                "rounded-xl border p-5 flex flex-col",
                t.name === "Solo" ? "border-[#d4a853]/30 bg-[#d4a853]/5" : "border-white/[0.06] bg-white/[0.02]"
              )}>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">{t.name}</p>
                <p className="text-3xl font-black text-white mb-0.5">${t.price}</p>
                <p className="text-[10px] text-zinc-600 mb-3">per month · {t.seats === 999 ? "unlimited" : t.seats} seat{t.seats !== 1 ? "s" : ""}</p>
                <p className="text-[11px] text-zinc-400 mb-3">{t.tagline}</p>
                <ul className="space-y-1 mt-auto">
                  {t.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-1.5 text-[10px] text-zinc-500">
                      <Check className="h-2.5 w-2.5 shrink-0 mt-0.5 text-[#d4a853]" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-4 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-[#d4a853] shrink-0" />
            <div>
              <span className="text-sm font-bold text-[#d4a853]">Lifetime Deal — ${BRIEF.pricing.lifetime.price} one-time</span>
              <span className="ml-2 text-xs text-zinc-500">{BRIEF.pricing.lifetime.description}</span>
            </div>
          </div>
        </div>

        {/* Market */}
        <div>
          <SectionHeader label="Market Opportunity" number="05" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[BRIEF.market.tam, BRIEF.market.sam, BRIEF.market.target].map((m, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-3xl font-black text-white mb-1">{m.value}</p>
                <p className="text-xs text-zinc-400 leading-relaxed">{m.label}</p>
                {"growth" in m && <p className="mt-1 text-[10px] font-semibold text-emerald-400">{m.growth}</p>}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-3">Tailwinds</p>
            <ul className="space-y-2">
              {BRIEF.market.tailwinds.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-zinc-300">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Competitive */}
        <div>
          <SectionHeader label="Competitive Landscape" number="06" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Feature Coverage vs. Market</p>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#ffffff10" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Radar name="CineFlow" dataKey="CineFlow" stroke={GOLD} fill={GOLD} fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Competitors" dataKey="Others" stroke="#6b7280" fill="#6b7280" fillOpacity={0.08} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Monthly Price Comparison</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pricingChartData} barSize={28}>
                  <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`$${v}/mo`, "Price"]} />
                  <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                    {pricingChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Feature</th>
                  {BRIEF.competitors.columns.map((c, i) => (
                    <th key={c} className={cn("px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider", i === 0 ? "text-[#d4a853]" : "text-zinc-500")}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRIEF.competitors.rows.map((row, ri) => (
                  <tr key={row.feature} className={cn("border-b border-white/[0.04]", ri % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]")}>
                    <td className="px-4 py-3 text-xs text-zinc-300">{row.feature}</td>
                    {row.values.map((v, vi) => (
                      <td key={vi} className="px-4 py-3 text-center">
                        {v ? <Check className={cn("mx-auto h-4 w-4", vi === 0 ? "text-[#d4a853]" : "text-emerald-500/60")} />
                           : <XIcon className="mx-auto h-3.5 w-3.5 text-zinc-700" />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-white/[0.08] bg-white/[0.03]">
                  <td className="px-4 py-3 text-xs font-semibold text-zinc-400">Monthly Price</td>
                  {BRIEF.competitors.monthlyPrice.map((p, i) => (
                    <td key={i} className={cn("px-4 py-3 text-center text-xs font-bold", i === 0 ? "text-[#d4a853]" : "text-zinc-500")}>
                      {typeof p === "number" ? `$${p}` : p}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-zinc-600">{BRIEF.competitors.savingsNote}</p>
        </div>

        {/* ROI */}
        <div>
          <SectionHeader label="ROI — Why Filmmakers Switch" number="07" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Tools CineFlow Replaces</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={savingsChartData} layout="vertical" barSize={16}>
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "#111", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`$${v}/mo`, "Cost"]} />
                  <Bar dataKey="cost" fill="#6b7280" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-xs text-zinc-500 mb-1">Avg. monthly spend on separate tools</p>
                <p className="text-3xl font-black text-white">${BRIEF.roi.totalReplaced}<span className="text-base text-zinc-500 font-normal">/mo</span></p>
              </div>
              <div className="flex-1 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-5">
                <p className="text-xs text-zinc-500 mb-1">CineFlow Solo Plan</p>
                <p className="text-3xl font-black text-[#d4a853]">${BRIEF.roi.cineflowCost}<span className="text-base text-zinc-500 font-normal">/mo</span></p>
              </div>
              <div className="flex-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs text-zinc-500 mb-1">Monthly savings</p>
                <p className="text-3xl font-black text-emerald-400">${BRIEF.roi.monthlySavings}<span className="text-base font-normal text-zinc-500">/mo · ${BRIEF.roi.annualSavings}/yr</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech */}
        <div>
          <SectionHeader label="Technology" number="08" />
          <div className="flex flex-wrap gap-2 mb-4">
            {BRIEF.tech.stack.map((t) => (
              <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-300">{t}</span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BRIEF.tech.highlights.map((h) => (
              <div key={h} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#d4a853]" />
                <p className="text-xs text-zinc-300 leading-relaxed">{h}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.04] pt-6 pb-10 text-center">
          <p className="text-[11px] text-zinc-700">{BRIEF.company.name} · {BRIEF.company.website} · Founded {BRIEF.company.founded}</p>
          <p className="text-[10px] text-zinc-800 mt-1">Confidential — For authorized recipients only</p>
        </div>
      </div>
    </div>
  );
}
