"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, BarChart2, DollarSign, Link2, Share2, Settings2, Film, ArrowLeft, ScrollText, Flag, Megaphone, Palette, Zap, Radio, Send, TrendingDown, MessageSquarePlus, BookOpen, Code2, LineChart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LS_KEY = "admin_feedback_last_viewed";

const NAV = [
  { href: "/admin/brief",        label: "Brief",          icon: BookOpen },
  { href: "/admin/growth-model", label: "Growth Model",   icon: LineChart },
  { href: "/admin/war-room",     label: "War Room",       icon: Zap },
  { href: "/admin/users",        label: "Users",          icon: Users },
  { href: "/admin/analytics",    label: "Analytics",      icon: BarChart2 },
  { href: "/admin/finances",     label: "Finances",       icon: DollarSign },
  { href: "/admin/funnel",       label: "Churn & Funnel", icon: TrendingDown },
  { href: "/admin/activity",     label: "Live Activity",  icon: Radio },
  { href: "/admin/broadcast",    label: "Broadcast",      icon: Send },
  { href: "/admin/feedback",     label: "Feedback",       icon: MessageSquarePlus },
  { href: "/admin/invite-links", label: "Invite Links",   icon: Link2 },
  { href: "/admin/referrals",    label: "Referrals",      icon: Share2 },
  { href: "/admin/audit-log",    label: "Audit Log",      icon: ScrollText },
  { href: "/admin/feature-flags",label: "Feature Flags",  icon: Flag },
  { href: "/admin/announcements",label: "Announcements",  icon: Megaphone },
  { href: "/admin/brand",        label: "Brand",          icon: Palette },
  { href: "/admin/system",       label: "System",         icon: Settings2 },
  { href: "/admin/code-stats",   label: "Code Stats",     icon: Code2 },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  finance:     "Finance",
  support:     "Support",
};

export function AdminSidebar({ adminName, adminRole }: { adminName?: string; adminRole?: string | null }) {
  const pathname = usePathname();
  const [feedbackUnread, setFeedbackUnread] = useState(0);

  useEffect(() => {
    const lastViewed = localStorage.getItem(LS_KEY);
    const supabase = createClient();
    let query = supabase
      .from("feedback")
      .select("id", { count: "exact", head: true });
    if (lastViewed) {
      query = query.gt("created_at", lastViewed) as typeof query;
    }
    query.then(({ count }) => setFeedbackUnread(count ?? 0));
  }, [pathname]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0b0b] h-screen overflow-y-auto">
        {/* Logo + back to app */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <div>
              <p className="text-[0.6rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">Cineflow</p>
              <p className="text-[0.55rem] text-zinc-600 uppercase tracking-wider">Admin</p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
          >
            <ArrowLeft className="h-3 w-3" />
            App
          </Link>
        </div>

        {/* Admin identity */}
        {adminName && (
          <div className="border-b border-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium text-zinc-300 truncate">{adminName}</p>
            <p className="text-[10px] text-zinc-600">
              {adminRole ? ROLE_LABELS[adminRole] ?? adminRole : "Super Admin"}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            const isFeedback = href === "/admin/feedback";
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#d4a853]/10 text-[#d4a853]"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {isFeedback && feedbackUnread > 0 && (
                  <span className="ml-auto rounded-full bg-[#d4a853] px-1.5 py-0.5 text-[9px] font-bold leading-none text-black">
                    {feedbackUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Mobile horizontal tab strip */}
      <div className="md:hidden flex flex-col border-b border-white/[0.06] bg-[#0b0b0b]">
        {/* Header row — safe area top padding for iPhone notch/island */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3 w-3 text-[#d4a853]" />
            </div>
            <p className="text-[0.6rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">Admin</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300 border border-white/[0.06]"
          >
            <ArrowLeft className="h-3 w-3" />
            App
          </Link>
        </div>
        {/* Scrollable tab strip */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-1 px-3 py-2 w-max">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              const isFeedback = href === "/admin/feedback";
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-[#d4a853]/10 text-[#d4a853]"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                  {isFeedback && feedbackUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853] text-[8px] font-bold text-black">
                      {feedbackUnread > 9 ? "9+" : feedbackUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
