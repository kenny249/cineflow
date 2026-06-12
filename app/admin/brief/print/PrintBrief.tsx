"use client";

import { useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell,
} from "recharts";
import { Check, X as XIcon, TrendingUp, ChevronRight } from "lucide-react";
import { BRIEF } from "@/lib/brief.config";
import { cn } from "@/lib/utils";

const GOLD = "#d4a853";

export function PrintBrief() {
  useEffect(() => {
    // Small delay so charts render before the print dialog opens
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);

  const pricingChartData = [
    { name: "CineFlow", price: 39, fill: GOLD },
    { name: "Frame.io", price: 25, fill: "#9ca3af" },
    { name: "StudioBinder", price: 29, fill: "#9ca3af" },
    { name: "Wipster", price: 25, fill: "#9ca3af" },
    { name: "Notion", price: 16, fill: "#9ca3af" },
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
    <>
      <style>{`
        @page { margin: 0.75in; size: letter; }
        body { font-family: system-ui, -apple-system, sans-serif; background: white; color: #111; }
        @media print { .no-print { display: none !important; } }
        h1, h2, h3 { page-break-after: avoid; }
        .section { page-break-inside: avoid; margin-bottom: 2rem; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; }
      `}</style>

      {/* Print hint */}
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-black/90 px-4 py-2 text-sm text-white shadow-xl">
        Print dialog opening… <span className="text-[#d4a853]">Save as PDF</span> to export
      </div>

      <div className="mx-auto max-w-4xl p-0 text-[#111]">

        {/* Cover */}
        <div className="section flex flex-col items-start gap-2 border-b-4 pb-8 mb-8" style={{ borderColor: GOLD }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: GOLD + "20", border: `1px solid ${GOLD}40` }}>
              <span className="font-black text-lg" style={{ color: GOLD }}>C</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: GOLD }}>CineFlow</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">{BRIEF.company.stage}</p>
            </div>
          </div>
          <h1 className="text-4xl font-black tracking-tight">{BRIEF.company.name}</h1>
          <p className="text-xl text-gray-600 mt-1">{BRIEF.company.tagline}</p>
          <p className="text-sm text-gray-400 mt-2">{BRIEF.company.website} · Founded {BRIEF.company.founded}</p>
        </div>

        {/* Mission */}
        <div className="section">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Mission</p>
          <p className="text-base text-gray-700 leading-relaxed">{BRIEF.company.mission}</p>
        </div>

        {/* Problem */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">{BRIEF.problem.headline}</h2>
          <div className="grid grid-cols-2 gap-4">
            {BRIEF.problem.points.map((p) => (
              <div key={p.stat} className="rounded-lg border border-gray-200 p-4">
                <p className="text-3xl font-black mb-1" style={{ color: GOLD }}>{p.stat}</p>
                <p className="text-sm font-semibold mb-1">{p.label}</p>
                <p className="text-xs text-gray-500">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Solution */}
        <div className="section">
          <h2 className="text-xl font-bold mb-3">{BRIEF.solution.headline}</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{BRIEF.solution.description}</p>
        </div>

        {/* Features */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">Product Features</h2>
          <div className="grid grid-cols-3 gap-3">
            {BRIEF.features.map((f) => (
              <div key={f.name} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-bold mb-1">{f.name}</p>
                <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{f.description}</p>
                <ul className="space-y-0.5">
                  {f.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-1 text-[9px] text-gray-400">
                      <ChevronRight className="h-2 w-2 shrink-0 mt-0.5" style={{ color: GOLD }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">Pricing</h2>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {BRIEF.pricing.tiers.map((t) => (
              <div key={t.name} className={cn(
                "rounded-lg border p-4",
                t.name === "Solo" ? "border-2" : "border-gray-200"
              )} style={t.name === "Solo" ? { borderColor: GOLD, background: GOLD + "08" } : {}}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{t.name}</p>
                <p className="text-2xl font-black mb-0.5">${t.price}</p>
                <p className="text-[9px] text-gray-400 mb-2">/mo · {t.seats === 999 ? "unlimited" : t.seats} seat{t.seats !== 1 ? "s" : ""}</p>
                <ul className="space-y-0.5">
                  {t.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-1 text-[9px] text-gray-500">
                      <Check className="h-2 w-2 shrink-0 mt-0.5" style={{ color: GOLD }} />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-lg p-3 text-sm" style={{ background: GOLD + "12", border: `1px solid ${GOLD}30` }}>
            <span className="font-bold" style={{ color: GOLD }}>Lifetime Deal: ${BRIEF.pricing.lifetime.price} one-time</span>
            <span className="ml-2 text-xs text-gray-500">{BRIEF.pricing.lifetime.description}</span>
          </div>
        </div>

        {/* Market */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">Market Opportunity</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[BRIEF.market.tam, BRIEF.market.sam, BRIEF.market.target].map((m, i) => (
              <div key={i} className="rounded-lg border border-gray-200 p-4">
                <p className="text-2xl font-black mb-1">{m.value}</p>
                <p className="text-[10px] text-gray-500">{m.label}</p>
                {"growth" in m && <p className="text-[10px] font-semibold text-green-600 mt-1">{m.growth}</p>}
              </div>
            ))}
          </div>
          <ul className="space-y-1.5">
            {BRIEF.market.tailwinds.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-600">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Competitive Analysis */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">Competitive Analysis</h2>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Feature Coverage</p>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 9 }} />
                  <Radar name="CineFlow" dataKey="CineFlow" stroke={GOLD} fill={GOLD} fillOpacity={0.15} strokeWidth={2} />
                  <Radar name="Others" dataKey="Others" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.08} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Monthly Price (USD)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pricingChartData} barSize={22}>
                  <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [`$${v}/mo`, "Price"]} />
                  <Bar dataKey="price" radius={[3, 3, 0, 0]}>
                    {pricingChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Feature</th>
                  {BRIEF.competitors.columns.map((c, i) => (
                    <th key={c} className={cn("px-3 py-2 text-center font-semibold", i === 0 ? "" : "text-gray-500")}
                      style={i === 0 ? { color: GOLD } : {}}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRIEF.competitors.rows.map((row, ri) => (
                  <tr key={row.feature} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-1.5 text-gray-600">{row.feature}</td>
                    {row.values.map((v, vi) => (
                      <td key={vi} className="px-3 py-1.5 text-center">
                        {v
                          ? <Check className={cn("mx-auto h-3.5 w-3.5", vi === 0 ? "" : "text-green-500")} style={vi === 0 ? { color: GOLD } : {}} />
                          : <XIcon className="mx-auto h-3 w-3 text-gray-300" />}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-3 py-2 text-gray-500">Monthly Price</td>
                  {BRIEF.competitors.monthlyPrice.map((p, i) => (
                    <td key={i} className="px-3 py-2 text-center font-bold"
                      style={i === 0 ? { color: GOLD } : { color: "#6b7280" }}>
                      {typeof p === "number" ? `$${p}` : p}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">{BRIEF.competitors.savingsNote}</p>
        </div>

        {/* ROI */}
        <div className="section">
          <h2 className="text-xl font-bold mb-4">ROI — Why Filmmakers Switch</h2>
          <div className="grid grid-cols-2 gap-6 mb-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tools CineFlow Replaces</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={savingsChartData} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 9 }} tickFormatter={(v) => `$${v}`} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#374151", fontSize: 9 }} axisLine={false} tickLine={false} width={80} />
                  <Bar dataKey="cost" fill="#9ca3af" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-400 mb-1">Avg. spend on separate tools</p>
                <p className="text-2xl font-black">${BRIEF.roi.totalReplaced}<span className="text-sm text-gray-400 font-normal">/mo</span></p>
              </div>
              <div className="rounded-lg border p-4" style={{ borderColor: GOLD + "40", background: GOLD + "08" }}>
                <p className="text-xs text-gray-400 mb-1">CineFlow Solo Plan</p>
                <p className="text-2xl font-black" style={{ color: GOLD }}>${BRIEF.roi.cineflowCost}<span className="text-sm text-gray-400 font-normal">/mo</span></p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-xs text-gray-400 mb-1">Monthly savings</p>
                <p className="text-2xl font-black text-green-600">${BRIEF.roi.monthlySavings}<span className="text-sm font-normal text-gray-400">/mo · ${BRIEF.roi.annualSavings}/yr</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech */}
        <div className="section">
          <h2 className="text-xl font-bold mb-3">Technology</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {BRIEF.tech.stack.map((t) => (
              <span key={t} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">{t}</span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BRIEF.tech.highlights.map((h) => (
              <div key={h} className="flex items-start gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <Check className="h-3 w-3 shrink-0 mt-0.5" style={{ color: GOLD }} />
                <p className="text-xs text-gray-600">{h}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 mt-8 flex items-center justify-between text-[10px] text-gray-400">
          <span>{BRIEF.company.name} · {BRIEF.company.website} · Founded {BRIEF.company.founded}</span>
          <span>Confidential — Generated from live company config</span>
        </div>
      </div>
    </>
  );
}
