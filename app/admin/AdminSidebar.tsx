"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, BarChart2, DollarSign, Link2, Share2, Settings2, Film, ArrowLeft, ScrollText, Flag, Megaphone, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/users",        label: "Users",        icon: Users },
  { href: "/admin/analytics",    label: "Analytics",    icon: BarChart2 },
  { href: "/admin/finances",     label: "Finances",     icon: DollarSign },
  { href: "/admin/invite-links", label: "Invite Links", icon: Link2 },
  { href: "/admin/referrals",    label: "Referrals",    icon: Share2 },
  { href: "/admin/audit-log",    label: "Audit Log",    icon: ScrollText },
  { href: "/admin/feature-flags",label: "Feature Flags",icon: Flag },
  { href: "/admin/announcements",label: "Announcements",icon: Megaphone },
  { href: "/admin/brand",        label: "Brand",        icon: Palette },
  { href: "/admin/system",       label: "System",       icon: Settings2 },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  finance:     "Finance",
  support:     "Support",
};

export function AdminSidebar({ adminName, adminRole }: { adminName?: string; adminRole?: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0b0b]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
          <Film className="h-3.5 w-3.5 text-[#d4a853]" />
        </div>
        <div>
          <p className="text-[0.6rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">Cineflow</p>
          <p className="text-[0.55rem] text-zinc-600 uppercase tracking-wider">Admin</p>
        </div>
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
            </Link>
          );
        })}
      </nav>

      {/* Back to app */}
      <div className="border-t border-white/[0.06] p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to app
        </Link>
      </div>
    </aside>
  );
}
