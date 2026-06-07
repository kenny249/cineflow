"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DollarSign, Users, TrendingUp, TrendingDown, Clock, RefreshCw, Zap, AlertTriangle, CalendarDays, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type TrialUser = {
  id: string;
  email: string;
  name: string;
  plan: string;
  trial_ends_at: string;
};

type RecentSignup = {
  id: string;
  email: string;
  name: string;
  plan: string;
  plan_status: string;
  created_at: string;
};

type WarRoomData = {
  mrr: number;
  totalUsers: number;
  signupsToday: number;
  signupsThisWeek: number;
  signupsThisMonth: number;
  paidCount: number;
  trialsActive: number;
  trialsExpiringSoon: number;
  canceledLast30: number;
  trialsExpiringSoonList: TrialUser[];
  recentSignups: RecentSignup[];
  projectsThisMonth: number;
  invoicesThisMonth: number;
  fetchedAt: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `${days}d`;
}

const PLAN_COLORS: Record<string, string> = {
  solo: "text-blue-400",
  studio: "text-[#d4a853]",
  agency: "text-purple-400",
  enterprise: "text-emerald-400",
  lifetime: "text-pink-400",
};

export function WarRoomClient({ data: initial }: { data: WarRoomData }) {
  const router = useRouter();
  const [data] = useState(initial);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshing(true);
      router.refresh();
      setLastRefresh(new Date());
      setTimeout(() => setRefreshing(false), 1000);
    }, 60_000);
    return () => clearInterval(interval);
  }, [router]);

  // Tick every second for time displays
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  function manualRefresh() {
    setRefreshing(true);
    router.refresh();
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 1000);
  }

  const secsAgo = Math.floor((Date.now() - lastRefresh.getTime()) / 1000);
  const refreshLabel = secsAgo < 5 ? "just now" : secsAgo < 60 ? `${secsAgo}s ago` : `${Math.floor(secsAgo / 60)}m ago`;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#d4a853]" />
            <h1 className="text-xl font-bold text-white">War Room</h1>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">Live command center — auto-refreshes every 60s</p>
        </div>
        <button
          onClick={manualRefresh}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshLabel}
        </button>
      </div>

      {/* Hero MRR */}
      <div className="mb-6 rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-6">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="h-4 w-4 text-[#d4a853]" />
          <p className="text-xs font-medium uppercase tracking-widest text-[#d4a853]/70">Monthly Recurring Revenue</p>
        </div>
        <p className="text-5xl font-bold text-[#d4a853] tabular-nums">
          {data.mrr > 0 ? fmt(data.mrr) : "—"}
        </p>
        {data.mrr > 0 && (
          <p className="mt-1 text-sm text-zinc-500">
            ARR: <span className="text-zinc-300 font-medium">{fmt(data.mrr * 12)}</span>
            <span className="mx-3 text-zinc-700">·</span>
            ARPU: <span className="text-zinc-300 font-medium">{data.paidCount > 0 ? fmt(data.mrr / data.paidCount) : "—"}/mo</span>
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Signups today",
            value: data.signupsToday,
            sub: `${data.signupsThisWeek} this week · ${data.signupsThisMonth} this month`,
            icon: Users,
            color: "text-emerald-400",
            highlight: data.signupsToday > 0,
          },
          {
            label: "Paid users",
            value: data.paidCount,
            sub: `of ${data.totalUsers} total`,
            icon: TrendingUp,
            color: "text-blue-400",
            highlight: false,
          },
          {
            label: "Active trials",
            value: data.trialsActive,
            sub: `${data.trialsExpiringSoon} expiring this week`,
            icon: Clock,
            color: data.trialsExpiringSoon > 0 ? "text-amber-400" : "text-zinc-300",
            highlight: data.trialsExpiringSoon > 0,
          },
          {
            label: "Churn (30d)",
            value: data.canceledLast30,
            sub: "verified-paid cancellations",
            icon: TrendingDown,
            color: data.canceledLast30 > 2 ? "text-red-400" : data.canceledLast30 > 0 ? "text-amber-400" : "text-emerald-400",
            highlight: data.canceledLast30 > 0,
          },
        ].map(({ label, value, sub, icon: Icon, color, highlight }) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border p-5 transition-colors",
              highlight ? "border-white/[0.1] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500">{label}</p>
              <Icon className="h-3.5 w-3.5 text-zinc-600" />
            </div>
            <p className={cn("text-3xl font-bold tabular-nums", color)}>{value}</p>
            <p className="mt-1 text-xs text-zinc-600">{sub}</p>
          </div>
        ))}
      </div>

      {/* Activity stats row */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        {[
          { label: "Projects this month", value: data.projectsThisMonth, icon: CalendarDays },
          { label: "Invoices sent/paid this month", value: data.invoicesThisMonth, icon: FileText },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04]">
              <Icon className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-white tabular-nums">{value}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Trials expiring soon */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Trials expiring this week</h2>
            {data.trialsExpiringSoonList.length > 0 && (
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {data.trialsExpiringSoonList.length}
              </span>
            )}
          </div>
          {data.trialsExpiringSoonList.length === 0 ? (
            <p className="text-sm text-zinc-600">No trials expiring in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {data.trialsExpiringSoonList.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-300">{u.name || u.email}</p>
                    <p className="text-xs text-zinc-600 truncate">{u.email}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className={cn("text-xs font-medium tabular-nums", PLAN_COLORS[u.plan] ?? "text-zinc-400")}>{u.plan}</p>
                    <p className="text-xs text-amber-400">{daysUntil(u.trial_ends_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-300">Recent signups</h2>
          </div>
          {data.recentSignups.length === 0 ? (
            <p className="text-sm text-zinc-600">No signups yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentSignups.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-300">{u.name || u.email}</p>
                    <p className="text-xs text-zinc-600 truncate">{u.email}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className={cn("text-xs font-medium", PLAN_COLORS[u.plan] ?? "text-zinc-400")}>{u.plan}</p>
                    <p className="text-xs text-zinc-600">{timeAgo(u.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
