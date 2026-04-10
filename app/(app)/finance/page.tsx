"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, TrendingUp, Minus, Lock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { MOCK_PROJECTS } from "@/mock/projects";
import { getBudgetLines } from "@/lib/supabase/queries";
import type { BudgetLine } from "@/types";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

interface ProjectSummary {
  id: string;
  title: string;
  client_name?: string | null;
  budgeted: number;
  actual: number;
  lines: number;
}

export default function FinancePage() {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const results: ProjectSummary[] = [];
      for (const p of MOCK_PROJECTS) {
        try {
          const lines: BudgetLine[] = await getBudgetLines(p.id);
          if (lines.length === 0) continue;
          const budgeted = lines.reduce((s, l) => s + l.budgeted, 0);
          const actual = lines.reduce((s, l) => s + (l.actual ?? 0), 0);
          results.push({ id: p.id, title: p.title, client_name: p.client_name, budgeted, actual, lines: lines.length });
        } catch {
          // Skip projects with no access
        }
      }
      if (alive) { setSummaries(results); setLoading(false); }
    }
    load();
    return () => { alive = false; };
  }, []);

  const totalBudget = summaries.reduce((s, p) => s + p.budgeted, 0);
  const totalActual = summaries.reduce((s, p) => s + p.actual, 0);
  const totalVariance = totalActual - totalBudget;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-foreground">Finance</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">Budget tracking across all projects</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/5 px-2.5 py-1.5 text-[10px] text-[#d4a853]">
            <Lock className="h-3 w-3" />
            Admin only
          </div>
        </div>

        {/* Summary bar */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Total Budget", value: fmt(totalBudget), icon: DollarSign, color: "text-muted-foreground" },
            { label: "Actual Spend", value: fmt(totalActual), icon: TrendingUp, color: "text-foreground" },
            {
              label: "Variance",
              value: (totalVariance > 0 ? "+" : "") + fmt(totalVariance),
              icon: totalVariance > 0 ? TrendingUp : totalVariance < 0 ? TrendingDown : Minus,
              color: totalVariance > 0 ? "text-red-400" : totalVariance < 0 ? "text-emerald-400" : "text-muted-foreground",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <stat.icon className="h-3 w-3" />
                {stat.label}
              </div>
              <p className={`font-display text-base font-bold sm:text-lg ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 sm:px-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading budgets…</div>
        ) : summaries.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
            <DollarSign className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No budget data yet</p>
            <p className="text-xs text-muted-foreground/60">Add budget lines inside a project's Finance tab to see them here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{summaries.length} project{summaries.length !== 1 ? "s" : ""} with budgets</p>
            {summaries.map((p) => {
              const variance = p.actual - p.budgeted;
              const pct = p.budgeted > 0 ? Math.round((p.actual / p.budgeted) * 100) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-card/80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">{p.title}</p>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    {p.client_name && <p className="mt-0.5 text-xs text-muted-foreground truncate">{p.client_name}</p>}
                    <p className="mt-1 text-[10px] text-muted-foreground/60">{p.lines} line item{p.lines !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-foreground">{fmt(p.budgeted)}</p>
                    <p className="text-xs text-muted-foreground">{pct}% used</p>
                    <p className={`text-xs font-medium ${variance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {variance > 0 ? "+" : ""}{fmt(variance)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
