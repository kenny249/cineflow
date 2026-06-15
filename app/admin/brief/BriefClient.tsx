"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";
import {
  Sparkles, FileText, Download, Copy, CheckCheck, Loader2,
  Users, TrendingUp, DollarSign, Activity, ExternalLink,
  ChevronRight, Check, X as XIcon,
} from "lucide-react";
import { BRIEF } from "@/lib/brief.config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Format = "ig" | "sms" | "email" | "pitch";

const FORMAT_OPTIONS: { key: Format; label: string; icon: string; desc: string }[] = [
  { key: "ig",    label: "Instagram",  icon: "📸", desc: "Hook + bullets + hashtags" },
  { key: "sms",   label: "SMS / Text", icon: "💬", desc: "~160 chars, casual" },
  { key: "email", label: "Email Pitch", icon: "📧", desc: "Investor / partner intro" },
  { key: "pitch", label: "Full Pitch",  icon: "📋", desc: "600–900 word narrative" },
];

type LiveMetrics = {
  totalUsers: number;
  activeTrials: number;
  activeRecently: number;
  totalProjects: number;
  mrr: number | null;
};

const GOLD = "#d4a853";

function StatCard({ value, label, icon: Icon, sub }: { value: string; label: string; icon: React.ElementType; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">{label}</span>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a853]/10">
          <Icon className="h-3.5 w-3.5 text-[#d4a853]" />
        </div>
      </div>
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

function buildAIBrief(metrics: LiveMetrics): string {
  const mrrLine = metrics.mrr != null ? `$${metrics.mrr.toLocaleString()}/mo MRR` : "pre-revenue (beta)";
  return `# CineFlow — Full AI Context Brief
Generated from: ${BRIEF.company.website} | Stage: ${BRIEF.company.stage}

---

## What is CineFlow?
${BRIEF.company.name} is ${BRIEF.company.tagline}

Mission: ${BRIEF.company.mission}
Vision: ${BRIEF.company.vision}

## Target User
${BRIEF.company.targetUser}

---

## The Problem
${BRIEF.problem.headline}

${BRIEF.problem.points.map(p => `- ${p.stat} ${p.label}: ${p.detail}`).join("\n")}

## The Solution
${BRIEF.solution.headline}
${BRIEF.solution.description}

---

## Core Features (${BRIEF.features.length} modules)

${BRIEF.features.map(f => `### ${f.name}\n${f.description}\nKey capabilities: ${f.highlights.join(", ")}`).join("\n\n")}

---

## Pricing

${BRIEF.pricing.tiers.map(t => `- **${t.name}** — $${t.price}/mo · ${t.seats === 999 ? "unlimited" : t.seats} seat${t.seats !== 1 ? "s" : ""} · ${t.tagline}\n  Includes: ${t.highlights.join(", ")}`).join("\n")}
- **Lifetime Deal** — $${BRIEF.pricing.lifetime.price} one-time · ${BRIEF.pricing.lifetime.description}

---

## Competitive Positioning

Competitors: ${BRIEF.competitors.columns.slice(1).join(", ")}

CineFlow is the ONLY platform that combines: project management, client review portal, AI production tools, invoicing, contracts, shot lists, crew management, audio transcription, drone ops, and retainer management — all built specifically for filmmakers.

Key moat: ${BRIEF.competitors.savingsNote}

A filmmaker using competitor tools pays $${BRIEF.roi.totalReplaced}/mo across 5+ subscriptions. CineFlow replaces all of them for $${BRIEF.roi.cineflowCost}/mo — saving $${BRIEF.roi.monthlySavings}/mo ($${BRIEF.roi.annualSavings}/yr).

Time saved: ${BRIEF.roi.timePerWeek}.

Tools CineFlow replaces:
${BRIEF.roi.savings.map(s => `- ${s.tool} ($${s.cost}/mo) → ${s.replacedBy}`).join("\n")}

---

## Market Opportunity

- TAM: ${BRIEF.market.tam.value} — ${BRIEF.market.tam.label} (${BRIEF.market.tam.growth})
- SAM: ${BRIEF.market.sam.value} — ${BRIEF.market.sam.label}
- Target segment: ${BRIEF.market.target.value} — ${BRIEF.market.target.label}

Tailwinds:
${BRIEF.market.tailwinds.map(t => `- ${t}`).join("\n")}

---

## Live Traction (real users only, demo/test excluded)

- Total users: ${metrics.totalUsers.toLocaleString()}
- Active in last 30 days: ${metrics.activeRecently.toLocaleString()}
- Active trials: ${metrics.activeTrials.toLocaleString()}
- Total projects created: ${metrics.totalProjects.toLocaleString()}
- Revenue: ${mrrLine}

---

## Technology Stack

${BRIEF.tech.stack.join(", ")}

${BRIEF.tech.highlights.map(h => `- ${h}`).join("\n")}

---

## Distribution & Go-to-Market

- Direct: usecineflow.com (SEO, social, word of mouth)
- Referral system: built-in custom referral program
- Mac desktop app: available as a native .dmg download
- Extended trials (90-day) being used for early adopter seeding in film communities
- Target channels: film schools, DP/editor communities, indie production Facebook groups, YouTube filmmaking creators

---

## Founder Context

Solo bootstrapped founder with a background in the film/production industry. Built the entire platform from scratch. Deep domain expertise in filmmaker workflows — this is not a generic SaaS company trying to enter the space.

Website: https://${BRIEF.company.website}
Founded: ${BRIEF.company.founded}
`;
}

export function BriefClient() {
  const [metrics, setMetrics] = useState<LiveMetrics>({ totalUsers: 0, activeTrials: 0, activeRecently: 0, totalProjects: 0, mrr: null });
  const [generating, setGenerating] = useState<Format | null>(null);
  const [generated, setGenerated] = useState<Partial<Record<Format, string>>>({});
  const [copied, setCopied] = useState<Format | null>(null);
  const [activeFormat, setActiveFormat] = useState<Format | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [aiBriefCopied, setAiBriefCopied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/brief/metrics")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setMetrics({
            totalUsers: data.totalUsers ?? 0,
            activeTrials: data.activeTrials ?? 0,
            activeRecently: data.activeRecently ?? 0,
            totalProjects: data.totalProjects ?? 0,
            mrr: data.mrr ?? null,
          });
        }
      })
      .catch(() => {});
    fetch("/api/admin/brief/share-token")
      .then((r) => r.json())
      .then((d) => { if (d.token) setShareToken(d.token); })
      .catch(() => {});
  }, []);

  async function copyShareLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/brief/${shareToken}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    toast.success("Share link copied to clipboard");
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function generate(format: Format) {
    setGenerating(format);
    setActiveFormat(format);
    try {
      const res = await fetch("/api/admin/brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { text } = await res.json();
      setGenerated((prev) => ({ ...prev, [format]: text }));
    } catch {
      toast.error("Failed to generate — check API key");
    } finally {
      setGenerating(null);
    }
  }

  async function copyAIBrief() {
    await navigator.clipboard.writeText(buildAIBrief(metrics));
    setAiBriefCopied(true);
    toast.success("AI brief copied — paste into Claude, ChatGPT, or any AI");
    setTimeout(() => setAiBriefCopied(false), 3000);
  }

  async function copyGenerated(format: Format) {
    const text = generated[format];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(format);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  // Chart data
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
    <div className="min-h-full bg-[#080808]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#080808]/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4a853]">CineFlow</p>
          <p className="text-[10px] text-zinc-600">Company Brief · Auto-updates on deploy</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAIBrief}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10 px-3 py-1.5 text-xs font-semibold text-[#d4a853] transition-colors hover:bg-[#d4a853]/20"
          >
            {aiBriefCopied ? <CheckCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiBriefCopied ? "Copied!" : "Copy AI Brief"}
          </button>
          {shareToken && (
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/5 px-3 py-1.5 text-xs font-medium text-[#d4a853] transition-colors hover:bg-[#d4a853]/10"
            >
              {linkCopied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {linkCopied ? "Copied!" : "Copy share link"}
            </button>
          )}
          <a
            href="/admin/brief/print"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-10">

        {/* ── Hero ── */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d4a853]/20 bg-[#d4a853]/5 px-4 py-1.5 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-[#d4a853] uppercase tracking-widest">{BRIEF.company.stage}</span>
          </div>
          <h1 className="font-display text-5xl font-black text-white mb-4">{BRIEF.company.name}</h1>
          <p className="text-xl text-zinc-300 max-w-2xl mx-auto mb-2">{BRIEF.company.tagline}</p>
          <a href={`https://${BRIEF.company.website}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#d4a853] hover:underline">
            {BRIEF.company.website} <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* ── Live Metrics ── */}
        <div>
          <SectionHeader label="Live Traction" number="01" />
          <p className="text-[11px] text-zinc-600 mb-4">Real users only — demo &amp; test accounts excluded</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard value={metrics.totalUsers.toLocaleString()} label="Real Users" icon={Users} sub="All-time signups" />
            <StatCard value={metrics.activeRecently.toLocaleString()} label="Active (30d)" icon={Activity} sub="Logged in last 30 days" />
            <StatCard value={metrics.activeTrials.toLocaleString()} label="Active Trials" icon={TrendingUp} sub="Trial not yet expired" />
            <StatCard value={metrics.totalProjects.toLocaleString()} label="Projects" icon={FileText} sub="Created by real users" />
            <StatCard
              value={metrics.mrr != null ? `$${metrics.mrr.toLocaleString()}` : "—"}
              label="MRR"
              icon={DollarSign}
              sub="Live from Stripe"
            />
          </div>
        </div>

        {/* ── Problem ── */}
        <div>
          <SectionHeader label={BRIEF.problem.headline} number="02" />
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

        {/* ── Solution ── */}
        <div>
          <SectionHeader label={BRIEF.solution.headline} number="03" />
          <p className="text-base text-zinc-300 leading-relaxed max-w-3xl">{BRIEF.solution.description}</p>
        </div>

        {/* ── Features ── */}
        <div>
          <SectionHeader label="Product Features" number="04" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BRIEF.features.slice(0, 6).map((f) => (
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

        {/* ── Pricing ── */}
        <div>
          <SectionHeader label="Pricing" number="05" />
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

        {/* ── Market ── */}
        <div>
          <SectionHeader label="Market Opportunity" number="06" />
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

        {/* ── Competitive Analysis ── */}
        <div>
          <SectionHeader label="Competitive Landscape" number="07" />

          {/* Radar chart */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Feature Coverage vs. Market</p>
            <p className="text-[11px] text-zinc-600 mb-4">CineFlow (gold) vs. the average competitor (grey) across six core capability areas</p>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#ffffff10" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#71717a", fontSize: 11 }} />
                <Radar name="CineFlow" dataKey="CineFlow" stroke={GOLD} fill={GOLD} fillOpacity={0.15} strokeWidth={2} />
                <Radar name="Competitors" dataKey="Others" stroke="#6b7280" fill="#6b7280" fillOpacity={0.08} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Feature matrix */}
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Feature</th>
                  {BRIEF.competitors.columns.map((c, i) => (
                    <th key={c} className={cn(
                      "px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider",
                      i === 0 ? "text-[#d4a853]" : "text-zinc-500"
                    )}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRIEF.competitors.rows.map((row, ri) => (
                  <tr key={row.feature} className={cn("border-b border-white/[0.04]", ri % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]")}>
                    <td className="px-4 py-3 text-xs text-zinc-300">{row.feature}</td>
                    {row.values.map((v, vi) => (
                      <td key={vi} className="px-4 py-3 text-center">
                        {v
                          ? <Check className={cn("mx-auto h-4 w-4", vi === 0 ? "text-[#d4a853]" : "text-emerald-500/60")} />
                          : <XIcon className="mx-auto h-3.5 w-3.5 text-zinc-700" />
                        }
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
          <p className="mt-3 text-[11px] text-zinc-600 leading-relaxed">{BRIEF.competitors.savingsNote}</p>
        </div>

        {/* ── ROI ── */}
        <div>
          <SectionHeader label="ROI — Why Filmmakers Switch" number="08" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Tools CineFlow Replaces</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={savingsChartData} layout="vertical" barSize={16}>
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip
                    contentStyle={{ background: "#111", border: "1px solid #ffffff15", borderRadius: 8, fontSize: 12, color: "#fff" }}
                    formatter={(v) => [`$${v}/mo`, "Cost"]}
                  />
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
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-sm text-zinc-300">
              <span className="font-semibold text-white">Time saved: </span>{BRIEF.roi.timePerWeek}
            </p>
          </div>
        </div>

        {/* ── Tech Stack ── */}
        <div>
          <SectionHeader label="Technology" number="09" />
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

        {/* ── AI Format Generator ── */}
        <div>
          <SectionHeader label="Generate Short Formats" number="10" />
          <p className="text-sm text-zinc-500 mb-5">Use Claude to reformat this brief for any channel. Results are generated fresh from the current config.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {FORMAT_OPTIONS.map(({ key, label, icon, desc }) => (
              <button
                key={key}
                onClick={() => generate(key)}
                disabled={generating !== null}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  activeFormat === key
                    ? "border-[#d4a853]/40 bg-[#d4a853]/5"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                )}
              >
                <p className="text-lg mb-2">{icon}</p>
                <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
                <p className="text-[10px] text-zinc-600">{desc}</p>
                {generating === key && <Loader2 className="mt-2 h-3 w-3 animate-spin text-[#d4a853]" />}
              </button>
            ))}
          </div>

          {activeFormat && generated[activeFormat] && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                <p className="text-xs font-semibold text-zinc-400">
                  {FORMAT_OPTIONS.find(f => f.key === activeFormat)?.icon}{" "}
                  {FORMAT_OPTIONS.find(f => f.key === activeFormat)?.label}
                </p>
                <button
                  onClick={() => copyGenerated(activeFormat)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-white"
                >
                  {copied === activeFormat ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === activeFormat ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap p-5 text-sm text-zinc-200 leading-relaxed font-sans">
                {generated[activeFormat]}
              </pre>
            </div>
          )}
        </div>

        {/* ── AI Brief Prompt ── */}
        <div>
          <SectionHeader label="AI Context Brief" number="11" />
          <p className="text-sm text-zinc-500 mb-5">
            A single plain-text brief you can paste into Claude, ChatGPT, or any AI to instantly give it full context on CineFlow.
            Auto-updates from this config — includes live traction metrics.
          </p>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
              <p className="text-xs font-semibold text-zinc-400">CineFlow Full AI Context Brief</p>
              <button
                onClick={copyAIBrief}
                className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-1.5 text-xs font-semibold text-[#d4a853] transition-colors hover:bg-[#d4a853]/10"
              >
                {aiBriefCopied ? <CheckCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiBriefCopied ? "Copied to clipboard!" : "Copy to clipboard"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap p-5 text-xs text-zinc-400 leading-relaxed font-mono max-h-96 overflow-y-auto">
              {buildAIBrief(metrics)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.04] pt-6 pb-10 text-center">
          <p className="text-[11px] text-zinc-700">
            {BRIEF.company.name} · {BRIEF.company.website} · Founded {BRIEF.company.founded}
          </p>
          <p className="text-[10px] text-zinc-800 mt-1">This brief auto-updates on every deployment — last updated when this version was deployed.</p>
        </div>
      </div>
    </div>
  );
}
