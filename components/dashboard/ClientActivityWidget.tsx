"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CheckCheck, MessageSquare, ArrowUpRight, ChevronDown,
  Bell, DollarSign, FileSignature, RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markNotificationRead, getRevisionsNeedingAttention } from "@/lib/supabase/queries";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AttentionItem { id: string; title: string; project_id: string; project?: { id: string; title: string } }

interface ClientEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  href: string | null;
  created_at: string;
  read: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  comment_added:     { icon: MessageSquare,  color: "text-blue-400",    bg: "bg-blue-400/10" },
  client_commented:  { icon: MessageSquare,  color: "text-blue-400",    bg: "bg-blue-400/10" },
  revision_approved: { icon: CheckCheck,     color: "text-purple-400",  bg: "bg-purple-400/10" },
  changes_requested: { icon: RefreshCw,      color: "text-amber-400",   bg: "bg-amber-400/10" },
  revision_uploaded: { icon: RefreshCw,      color: "text-amber-400",   bg: "bg-amber-400/10" },
  quote_accepted:    { icon: DollarSign,     color: "text-emerald-400", bg: "bg-emerald-400/10" },
  contract_signed:   { icon: FileSignature,  color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

const CLIENT_EVENT_TYPES = [
  "comment_added",
  "client_commented",
  "revision_approved",
  "changes_requested",
  "revision_uploaded",
  "quote_accepted",
  "contract_signed",
];

export function ClientActivityWidget() {
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [needsAttention, setNeedsAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cf-client-activity-collapsed") === "1";
  });
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        userIdRef.current = user.id;

        const { data } = await supabase
          .from("notifications")
          .select("id, type, title, description, href, created_at, read")
          .eq("user_id", user.id)
          .in("type", CLIENT_EVENT_TYPES)
          .order("created_at", { ascending: false })
          .limit(10);
        setEvents(data ?? []);
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    }
    void load();
    getRevisionsNeedingAttention()
      .then((revs) => setNeedsAttention(revs.map((r) => ({ id: r.id, title: r.title, project_id: r.project_id, project: r.project }))))
      .catch(() => {});

    // Real-time: new client events appear instantly
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel("client-activity-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const n = payload.new as ClientEvent;
            if (CLIENT_EVENT_TYPES.includes(n.type)) {
              setEvents((prev) => [n, ...prev].slice(0, 10));
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Sync with bell "mark all read"
  useEffect(() => {
    function onMarkAllRead() {
      setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
    }
    window.addEventListener("cf:notifications:mark-all-read", onMarkAllRead);
    return () => window.removeEventListener("cf:notifications:mark-all-read", onMarkAllRead);
  }, []);

  function handleClick(ev: ClientEvent) {
    if (!ev.read) {
      setEvents((prev) => prev.map((e) => e.id === ev.id ? { ...e, read: true } : e));
      markNotificationRead(ev.id).catch(() => {});
    }
  }

  const unread = events.filter((e) => !e.read).length;

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("cf-client-activity-collapsed", next ? "1" : "0");
  }

  if (!loading && events.length === 0 && needsAttention.length === 0) return null;

  return (
    <section>
      <button
        onClick={toggleCollapse}
        className="mb-3 flex w-full items-center justify-between group"
      >
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <span className="h-3 w-0.5 rounded-full bg-[#d4a853]" />
          Client Activity
          {unread > 0 && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853] text-[9px] font-bold text-black">
              {unread}
            </span>
          )}
        </h2>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 group-hover:text-muted-foreground",
          collapsed && "-rotate-90"
        )} />
      </button>

      {/* Needs attention — cuts where a client requested changes */}
      {!collapsed && needsAttention.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.04] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-400/15">
            <RefreshCw className="h-3.5 w-3.5 text-amber-400" />
            <p className="text-xs font-semibold text-amber-400">
              Needs your attention · {needsAttention.length} cut{needsAttention.length !== 1 ? "s" : ""} awaiting a revision
            </p>
          </div>
          {needsAttention.map((r) => (
            <Link
              key={r.id}
              href={`/revisions?project=${r.project_id}`}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-400/10 last:border-0 hover:bg-amber-400/[0.06] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                {r.project?.title && <p className="text-[10px] text-muted-foreground truncate">{r.project.title}</p>}
              </div>
              <span className="shrink-0 text-[10px] font-medium text-amber-400">Upload revision</span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
            </Link>
          ))}
        </div>
      )}

      {!collapsed && events.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
            </div>
          ) : (
            events.map((ev) => {
              const cfg = TYPE_CONFIG[ev.type] ?? { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
              const Icon = cfg.icon;
              const row = (
                <div className={cn(
                  "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                  ev.href ? "hover:bg-muted/30 cursor-pointer" : "",
                  !ev.read && "bg-[#d4a853]/[0.025]"
                )}>
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5", cfg.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium leading-snug", !ev.read ? "text-foreground" : "text-muted-foreground")}>
                      {ev.title}
                    </p>
                    {ev.description && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70 leading-snug line-clamp-2">{ev.description}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/40">
                      {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {ev.href && <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-1" />}
                  {!ev.read && <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853] shrink-0 mt-2" />}
                </div>
              );
              return ev.href ? (
                <Link key={ev.id} href={ev.href} onClick={() => handleClick(ev)}>{row}</Link>
              ) : (
                <div key={ev.id} onClick={() => handleClick(ev)}>{row}</div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
