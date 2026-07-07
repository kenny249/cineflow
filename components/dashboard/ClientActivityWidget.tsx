"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCheck, MessageSquare, ArrowUpRight, ChevronDown,
  Bell, DollarSign, FileSignature, RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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
  comment_added:    { icon: MessageSquare,   color: "text-blue-400",    bg: "bg-blue-400/10" },
  revision_approved:{ icon: CheckCheck,      color: "text-purple-400",  bg: "bg-purple-400/10" },
  revision_uploaded:{ icon: RefreshCw,       color: "text-amber-400",   bg: "bg-amber-400/10" },
  quote_accepted:   { icon: DollarSign,      color: "text-emerald-400", bg: "bg-emerald-400/10" },
  contract_signed:  { icon: FileSignature,   color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

// Only client-triggered events — excludes owner status_changed, system events, etc.
const CLIENT_EVENT_TYPES = [
  "comment_added",
  "revision_approved",
  "revision_uploaded",
  "quote_accepted",
  "contract_signed",
];

const TYPE_LABEL: Record<string, string> = {
  comment_added:     "Left a comment",
  revision_approved: "Approved revision",
  revision_uploaded: "Requested changes",
  quote_accepted:    "Accepted quote",
  contract_signed:   "Signed contract",
};

export function ClientActivityWidget() {
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cf-client-activity-collapsed") === "1";
  });

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
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
  }, []);

  // Sync with bell "mark all read" action
  useEffect(() => {
    function onMarkAllRead() {
      setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
    }
    window.addEventListener("cf:notifications:mark-all-read", onMarkAllRead);
    return () => window.removeEventListener("cf:notifications:mark-all-read", onMarkAllRead);
  }, []);

  const unread = events.filter((e) => !e.read).length;

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("cf-client-activity-collapsed", next ? "1" : "0");
  }

  if (!loading && events.length === 0) return null;

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

      {!collapsed && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
            </div>
          ) : (
            events.map((ev) => {
              const cfg = TYPE_CONFIG[ev.type] ?? { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };
              const Icon = cfg.icon;
              const badge = TYPE_LABEL[ev.type];
              const inner = (
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
                    {badge && (
                      <span className={cn(
                        "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        cfg.bg, cfg.color
                      )}>
                        {badge}
                      </span>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/50">
                      {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {ev.href && <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 shrink-0 mt-1" />}
                  {!ev.read && <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853] mt-2 shrink-0" />}
                </div>
              );
              return ev.href ? (
                <Link key={ev.id} href={ev.href}>{inner}</Link>
              ) : (
                <div key={ev.id}>{inner}</div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
