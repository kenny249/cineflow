"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  CheckSquare,
  ClipboardList,
  Settings,
  Film,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  UsersRound,
  ScrollText,
  DollarSign,
  FlaskConical,
  FileSignature,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOrCreateDisplayName, getInitials } from "@/lib/random-name";
import { createClient } from "@/lib/supabase/client";
import { isSoloPlan } from "@/types";

const NAV_MAIN = [
  { label: "Dashboard",  href: "/dashboard",      icon: LayoutDashboard },
  { label: "Projects",   href: "/projects",       icon: FolderKanban },
  { label: "Clients",    href: "/clients",        icon: Users },
  { label: "Calendar",   href: "/calendar",       icon: Calendar },
  { label: "To Do",      href: "/tasks",          icon: CheckSquare },
  { label: "Tasks",      href: "/project-tasks",  icon: ClipboardList },
  { label: "Contracts",  href: "/contracts",      icon: FileSignature },
  { label: "Forms",      href: "/forms",           icon: ClipboardList },
  { label: "Storyboard", href: "/storyboard",     icon: Clapperboard },
  { label: "Scripts",    href: "/scripts",        icon: ScrollText },
  { label: "Review",     href: "/revisions",      icon: Film },
  { label: "Finance",    href: "/finance",        icon: DollarSign },
  { label: "Team",       href: "/team",           icon: UsersRound },
];

const NAV_BOTTOM = [
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavItem({
  item,
  collapsed,
  isActive,
}: {
  item: (typeof NAV_MAIN)[0];
  collapsed: boolean;
  isActive: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-all duration-150",
        collapsed ? "justify-center w-9 px-0" : "",
        isActive
          ? "bg-[#d4a853]/[0.07] text-white font-medium ring-[0.5px] ring-inset ring-[#d4a853]/10"
          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#d4a853]" />
      )}
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-all duration-200",
          isActive
            ? "text-[#d4a853]"
            : "text-white/40 group-hover:text-white group-hover:scale-110"
        )}
      />
      {!collapsed && (
        <span className="truncate transition-opacity duration-200">{item.label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function BetaNavItem({
  collapsed,
  isActive,
}: {
  collapsed: boolean;
  isActive: boolean;
}) {
  const link = (
    <Link
      href="/beta-feedback"
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-all duration-150 mb-1",
        collapsed ? "justify-center w-9 px-0" : "",
        isActive
          ? "bg-[#d4a853]/[0.07] text-[#d4a853] font-medium ring-[0.5px] ring-inset ring-[#d4a853]/10"
          : "text-[#d4a853]/70 hover:bg-[#d4a853]/[0.05] hover:text-[#d4a853]"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#d4a853]" />
      )}
      {/* Pulse glow ring */}
      <span className="relative shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/25 duration-1000" />
        <FlaskConical className="relative h-4 w-4 text-[#d4a853] drop-shadow-[0_0_6px_rgba(212,168,83,0.7)]" />
      </span>
      {!collapsed && (
        <span className="truncate">Beta Feedback</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          Beta Feedback
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("Studio User");
  const [plan, setPlan] = useState<string>(() =>
    (typeof window !== "undefined" ? sessionStorage.getItem("cf_plan") : null) ?? "studio_beta"
  );

  useEffect(() => {
    setDisplayName(getOrCreateDisplayName());
    // Confirm plan from Supabase and keep sessionStorage in sync
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("plan").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.plan) {
            setPlan(data.plan);
            sessionStorage.setItem("cf_plan", data.plan);
          }
        });
    });
  }, []);

  const SOLO_HIDDEN = ["/team", "/scripts"];
  const navItems = isSoloPlan(plan)
    ? NAV_MAIN.filter((item) => !SOLO_HIDDEN.includes(item.href))
    : NAV_MAIN;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-screen flex-col border-r border-border bg-[#0b0b0b] transition-all duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* ── Ambient gold glow behind logo area ── */}
        <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-[radial-gradient(ellipse_80%_60%_at_30%_0%,rgba(212,168,83,0.07),transparent)] blur-sm" />

        {/* ── Logo + toggle ── */}
        <div
          className={cn(
            "relative flex h-14 items-center border-b border-border/60 px-3",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12 shadow-[0_0_12px_rgba(212,168,83,0.18)]">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <span className="font-display text-sm font-semibold tracking-tight text-gradient-gold">
                CINEFLOW
              </span>
            </Link>
          )}

          {collapsed && (
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12 shadow-[0_0_12px_rgba(212,168,83,0.18)]">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
          )}

          <button
            onClick={onToggle}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90",
              collapsed && "hidden"
            )}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Expand button when collapsed ── */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ── Main nav ── */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3 custom-scrollbar">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
            />
          ))}
        </nav>

        {/* ── Bottom nav ── */}
        <div className="p-2">
          {/* Beta Feedback — glowing special item */}
          <BetaNavItem collapsed={collapsed} isActive={isActive("/beta-feedback")} />

          {NAV_BOTTOM.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
            />
          ))}

          <Separator className="my-2" />

          {/* User profile */}
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2",
              collapsed && "justify-center px-0"
            )}
          >
            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border">
              <AvatarFallback className="text-[10px] bg-[#d4a853]/20 text-[#d4a853]">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white">{displayName}</p>
                <p className="truncate text-[10px] text-white/40">
                  {isSoloPlan(plan) ? "Solo Creator · Beta" : "Film Studio · Beta"}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
