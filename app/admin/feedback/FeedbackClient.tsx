"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, MessageCircle, ExternalLink, Check, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LS_KEY = "admin_feedback_last_viewed";

type FeedbackType = "bug" | "idea" | "other";
type Filter = "all" | FeedbackType;

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  message: string;
  page_url: string | null;
  display_name: string | null;
  created_at: string;
  resolved_at: string | null;
};

const TYPE_CONFIG: Record<FeedbackType, { label: string; icon: React.ElementType; color: string }> = {
  bug:   { label: "Bug",   icon: Bug,         color: "text-red-400 bg-red-500/10 border-red-500/20" },
  idea:  { label: "Idea",  icon: Lightbulb,   color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  other: { label: "Other", icon: MessageCircle, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
};

const FILTER_OPTIONS: { key: Filter; label: string }[] = [
  { key: "all",   label: "All" },
  { key: "bug",   label: "Bugs" },
  { key: "idea",  label: "Ideas" },
  { key: "other", label: "General" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FeedbackClient() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [lastViewed, setLastViewed] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    setLastViewed(stored);

    const supabase = createClient();
    supabase
      .from("feedback")
      .select("id, type, message, page_url, display_name, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as FeedbackRow[]) ?? []);
        setLoading(false);
        // Mark as viewed — everything is "read" from here
        localStorage.setItem(LS_KEY, new Date().toISOString());
      });
  }, []);

  async function toggleResolved(item: FeedbackRow) {
    const resolved = !item.resolved_at;
    setPendingIds((prev) => new Set(prev).add(item.id));
    const prevState = item.resolved_at;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, resolved_at: resolved ? new Date().toISOString() : null } : i));
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, resolved }),
      });
      if (!res.ok) throw new Error();
      toast.success(resolved ? "Marked resolved" : "Reopened");
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, resolved_at: prevState } : i));
      toast.error("Failed to update — try again");
    } finally {
      setPendingIds((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  }

  const typeFiltered = filter === "all" ? items : items.filter((i) => i.type === filter);
  const filtered = showResolved ? typeFiltered : typeFiltered.filter((i) => !i.resolved_at);
  const resolvedCount = typeFiltered.filter((i) => i.resolved_at).length;
  const unreadCount = lastViewed
    ? items.filter((i) => new Date(i.created_at) > new Date(lastViewed) && !i.resolved_at).length
    : items.filter((i) => !i.resolved_at).length;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white">User Feedback</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#d4a853] px-2 py-0.5 text-[10px] font-bold text-black">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">
            {items.length} total submission{items.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(({ key, label }) => {
            const count = key === "all"
              ? items.filter((i) => !i.resolved_at).length
              : items.filter((i) => i.type === key && !i.resolved_at).length;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === key
                    ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                    : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                )}
              >
                {label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                  filter === key ? "bg-[#d4a853]/20 text-[#d4a853]" : "bg-white/[0.06] text-zinc-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setShowResolved((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            showResolved
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
          )}
        >
          <Check className="h-3 w-3" />
          {showResolved ? "Hide resolved" : `Show resolved (${resolvedCount})`}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-[#d4a853]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MessageSquarePlus className="mb-3 h-8 w-8 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-500">
            {typeFiltered.length > 0 ? "All caught up — everything here is resolved" : "No feedback yet"}
          </p>
          <p className="text-xs text-zinc-700 mt-1">
            {typeFiltered.length > 0 ? "Toggle \"Show resolved\" above to see it" : "When users submit feedback it will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isUnread = lastViewed
              ? new Date(item.created_at) > new Date(lastViewed)
              : true;
            const isResolved = !!item.resolved_at;
            const isPending = pendingIds.has(item.id);
            const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
            const Icon = cfg.icon;
            return (
              <div
                key={item.id}
                className={cn(
                  "relative rounded-xl border p-4 transition-colors",
                  isResolved
                    ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                    : isUnread
                      ? "border-[#d4a853]/20 bg-[#d4a853]/[0.03]"
                      : "border-white/[0.06] bg-white/[0.02]"
                )}
              >
                {isUnread && !isResolved && (
                  <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-[#d4a853]/60" />
                )}
                <div className="flex items-start gap-3">
                  {/* Type badge */}
                  <div className={cn("flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold", cfg.color)}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm leading-relaxed", isResolved ? "text-zinc-400 line-through decoration-zinc-600" : "text-zinc-200")}>{item.message}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                      <span>{item.display_name ?? "Anonymous"}</span>
                      <span>·</span>
                      <span>{timeAgo(item.created_at)}</span>
                      {item.page_url && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-mono text-zinc-700">
                            <ExternalLink className="h-2.5 w-2.5" />
                            {item.page_url}
                          </span>
                        </>
                      )}
                      {isResolved && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-emerald-500">
                            <Check className="h-2.5 w-2.5" />
                            Resolved {timeAgo(item.resolved_at!)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Resolve toggle */}
                  <button
                    onClick={() => toggleResolved(item)}
                    disabled={isPending}
                    title={isResolved ? "Reopen" : "Mark resolved"}
                    className={cn(
                      "shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                      isResolved
                        ? "border-white/[0.08] text-zinc-500 hover:border-white/[0.16] hover:text-zinc-300"
                        : "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
                    )}
                  >
                    {isResolved ? <RotateCcw className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {isResolved ? "Reopen" : "Resolve"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
