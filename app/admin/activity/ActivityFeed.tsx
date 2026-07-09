"use client";

import { useEffect, useRef, useState } from "react";
import { UserPlus, FolderOpen, FileText, PenLine, Wifi, WifiOff, Link2, Eye, Film, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityEvent = {
  id: string;
  type: "signup" | "project" | "invoice" | "contract" | "plan_change" | "portal" | "revision" | "review" | "comment";
  label: string;
  detail?: string;
  ts: string;
};

const TYPE_ICONS = {
  signup:      { icon: UserPlus,      color: "text-emerald-400", bg: "bg-emerald-400/10" },
  project:     { icon: FolderOpen,    color: "text-blue-400",    bg: "bg-blue-400/10" },
  invoice:     { icon: FileText,      color: "text-[#d4a853]",   bg: "bg-[#d4a853]/10" },
  contract:    { icon: PenLine,       color: "text-purple-400",  bg: "bg-purple-400/10" },
  plan_change: { icon: UserPlus,      color: "text-zinc-400",    bg: "bg-zinc-400/10" },
  portal:      { icon: Eye,           color: "text-cyan-400",    bg: "bg-cyan-400/10" },
  revision:    { icon: Film,          color: "text-blue-400",    bg: "bg-blue-400/10" },
  review:      { icon: Link2,         color: "text-emerald-400", bg: "bg-emerald-400/10" },
  comment:     { icon: MessageSquare, color: "text-amber-400",   bg: "bg-amber-400/10" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set<string>());
  const [newIds, setNewIds] = useState(new Set<string>());
  const [tick, setTick] = useState(0);

  async function fetchEvents() {
    try {
      const res = await fetch("/api/admin/activity");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const incoming: ActivityEvent[] = data.events ?? [];
      const fresh = incoming.filter((e) => !seenIds.current.has(e.id));
      if (fresh.length > 0) {
        for (const e of fresh) seenIds.current.add(e.id);
        setNewIds((prev) => {
          const next = new Set(prev);
          for (const e of fresh) next.add(e.id);
          return next;
        });
        setEvents((prev) => {
          const merged = [...fresh, ...prev];
          const seen = new Set<string>();
          return merged.filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; }).slice(0, 200);
        });
        // Remove "new" flash after 3s
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            for (const e of fresh) next.delete(e.id);
            return next;
          });
        }, 3000);
      }
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  // Tick every 30s to update "X ago" timestamps
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Group by date
  const grouped: { date: string; events: ActivityEvent[] }[] = [];
  for (const ev of events) {
    const date = formatDate(ev.ts);
    const last = grouped[grouped.length - 1];
    if (last?.date === date) {
      last.events.push(ev);
    } else {
      grouped.push({ date, events: [ev] });
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Status bar */}
      <div className="mb-4 flex items-center gap-2">
        {connected ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-zinc-500">Live · polling every 5s</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-red-400">Disconnected — retrying…</span>
          </>
        )}
        <span className="ml-auto text-xs text-zinc-700">{events.length} events loaded</span>
      </div>

      {loading && events.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-white/[0.04]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
                <div className="h-2.5 w-2/3 rounded bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-zinc-600">No activity in the last 24 hours.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, events: dayEvents }) => (
            <div key={date}>
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">{date}</p>
              <div className="space-y-1">
                {dayEvents.map((ev) => {
                  const meta = TYPE_ICONS[ev.type] ?? TYPE_ICONS.plan_change;
                  const Icon = meta.icon;
                  const isNew = newIds.has(ev.id);
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 transition-all duration-500",
                        isNew
                          ? "border-[#d4a853]/30 bg-[#d4a853]/5"
                          : "border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]"
                      )}
                    >
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
                        <Icon className={cn("h-4 w-4", meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-300">{ev.label}</p>
                        {ev.detail && (
                          <p className="mt-0.5 truncate text-xs text-zinc-600">{ev.detail}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-zinc-500">{formatTime(ev.ts)}</p>
                        <p className="text-xs text-zinc-700">{timeAgo(ev.ts)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
