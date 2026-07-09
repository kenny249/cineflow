"use client";

import { useEffect, useState } from "react";
import { Loader2, Code2, FileCode2, GitBranch, Database, LayoutTemplate, Globe, Layers } from "lucide-react";

interface Stats {
  totalFiles: number;
  totalLines: number;
  totalEffectiveLines: number;
  byDir: Record<string, number>;
  byExt: Record<string, number>;
  apiRoutes: number;
  components: number;
  migrations: number;
  appPages: number;
  linesChanged: number;
  projectAgeDays: number;
  projectStartDate: string;
  commitCount: number;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-bold text-white tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{label}</p>
      {sub && <p className="mt-1 text-[10px] text-zinc-700">{sub}</p>}
    </div>
  );
}

export default function CodeStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/code-stats")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setStats(d); })
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-600">
        {error ?? "No data"}
      </div>
    );
  }

  const tsxLines = (stats.byExt[".tsx"] ?? 0) + (stats.byExt[".ts"] ?? 0);
  const cssLines = stats.byExt[".css"] ?? 0;
  const sqlLines = stats.byExt[".sql"] ?? 0;

  const topDirs = Object.entries(stats.byDir)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0);

  const blankPct = stats.totalLines > 0
    ? Math.round(((stats.totalLines - stats.totalEffectiveLines) / stats.totalLines) * 100)
    : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Code2 className="h-5 w-5 text-[#d4a853]" /> Codebase Stats
        </h1>
        <p className="text-xs text-zinc-600 mt-1">
          Live read of the CineFlow source tree · AI-assisted development
          {stats.projectStartDate && ` · started ${stats.projectStartDate}`}
        </p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<FileCode2 className="h-4 w-4" />}
          label="Total lines"
          value={stats.totalLines}
          sub={`${stats.totalEffectiveLines.toLocaleString()} effective (${blankPct}% blank/comments)`}
        />
        <StatCard
          icon={<Code2 className="h-4 w-4" />}
          label="Lines changed"
          value={stats.linesChanged || stats.totalLines}
          sub={stats.linesChanged ? "added + deleted across all commits" : "total lines (git history unavailable)"}
        />
        <StatCard
          icon={<GitBranch className="h-4 w-4" />}
          label="Git commits"
          value={stats.commitCount || "—"}
          sub={stats.projectAgeDays > 0 ? `over ${stats.projectAgeDays} calendar days` : "git not available at runtime"}
        />
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Components"
          value={stats.components}
          sub="React component files"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Globe className="h-4 w-4" />}
          label="API routes"
          value={stats.apiRoutes}
          sub="server endpoints"
        />
        <StatCard
          icon={<LayoutTemplate className="h-4 w-4" />}
          label="App pages"
          value={stats.appPages}
          sub="Next.js page files"
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="DB migrations"
          value={stats.migrations}
          sub="Supabase schema changes"
        />
        <StatCard
          icon={<Code2 className="h-4 w-4" />}
          label="Across"
          value={stats.totalFiles}
          sub="source files scanned"
        />
      </div>

      {/* Language breakdown */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Language Breakdown</h2>
        <div className="space-y-2.5">
          {[
            { label: "TypeScript / TSX", lines: tsxLines, color: "bg-blue-500" },
            { label: "CSS", lines: cssLines, color: "bg-purple-500" },
            { label: "SQL (migrations)", lines: sqlLines, color: "bg-emerald-500" },
          ].map(({ label, lines, color }) => {
            const pct = stats.totalLines > 0 ? Math.round((lines / stats.totalLines) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-400">{label}</span>
                  <span className="text-xs font-mono text-zinc-500">{lines.toLocaleString()} lines · {pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By directory */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-zinc-300">Lines by Directory</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="px-5 py-2 text-left text-xs font-medium text-zinc-600">Directory</th>
              <th className="px-5 py-2 text-right text-xs font-medium text-zinc-600">Lines</th>
              <th className="px-5 py-2 text-right text-xs font-medium text-zinc-600">Share</th>
            </tr>
          </thead>
          <tbody>
            {topDirs.map(([dir, lines]) => {
              const pct = stats.totalLines > 0 ? Math.round((lines / stats.totalLines) * 100) : 0;
              return (
                <tr key={dir} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-2.5 font-mono text-xs text-zinc-300">{dir}/</td>
                  <td className="px-5 py-2.5 text-right text-xs text-zinc-400 tabular-nums">{lines.toLocaleString()}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-zinc-600">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* At a glance */}
      <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03] p-5">
        <h2 className="text-sm font-semibold text-[#d4a853] mb-3">At a glance</h2>
        <ul className="space-y-1.5 text-xs text-zinc-500">
          <li>
            · <span className="text-zinc-300 font-medium">{stats.totalEffectiveLines.toLocaleString()} effective lines</span> of
            code ({stats.totalLines.toLocaleString()} total including blank lines &amp; comments)
          </li>
          {stats.linesChanged > 0 && (
            <li>
              · <span className="text-zinc-300 font-medium">{stats.linesChanged.toLocaleString()} lines changed</span> across all
              commits (every addition + deletion) — {(stats.linesChanged / Math.max(1, stats.totalLines)).toFixed(1)}× the surviving
              tree, reflecting the real churn of AI-assisted iteration
            </li>
          )}
          {stats.commitCount > 0 && (
            <li>
              · <span className="text-zinc-300 font-medium">{stats.commitCount} commits</span>
              {stats.projectAgeDays > 0 && (
                <> over <span className="text-zinc-300 font-medium">{stats.projectAgeDays} calendar days</span>
                {" "}— that&apos;s about {Math.round(stats.commitCount / Math.max(1, stats.projectAgeDays / 7))} commits/week</>
              )}
            </li>
          )}
          <li>· <span className="text-zinc-300 font-medium">{stats.apiRoutes}</span> API endpoints + <span className="text-zinc-300 font-medium">{stats.appPages}</span> pages across the app</li>
          <li>· <span className="text-zinc-300 font-medium">{stats.migrations}</span> database migrations — every schema change tracked</li>
        </ul>
        <p className="mt-3 text-[10px] text-zinc-700">
          Hours are an estimate based on effective LOC only (blank lines and comments excluded). Traditional hand-coding estimates (~40 LOC/hr) don&apos;t apply to AI-assisted workflows.
        </p>
      </div>
    </div>
  );
}
