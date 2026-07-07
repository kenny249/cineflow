"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEditSession } from "@/contexts/EditSessionContext";
import {
  LayoutDashboard,
  FolderKanban,
  LayoutGrid,
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
  Repeat2,
  ListChecks,
  FileText,
  ContactRound,
  Wrench,
  Calculator,
  ShieldCheck,
  ChevronDown,
  Lock,
  SlidersHorizontal,
} from "lucide-react";
import { DroneIcon } from "@/components/icons/DroneIcon";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/random-name";
import { createClient } from "@/lib/supabase/client";
import { isSoloPlan } from "@/types";
import { trialDaysLeft } from "@/lib/billing";
import { Zap, X, Check } from "lucide-react";
import { UpgradePlanModal } from "@/components/shared/UpgradePlanModal";

// ── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  soloHidden?: boolean;
  producerOnly?: boolean; // hidden for plain 'member' role
}

interface NavGroup {
  label: string | null; // null = no section header (Dashboard)
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Clients & Projects",
    items: [
      { label: "Projects",  href: "/projects",  icon: FolderKanban },
      { label: "Clients",   href: "/clients",   icon: Users },
      { label: "Retainers", href: "/retainers", icon: Repeat2 },
      { label: "Crew",      href: "/crew",      icon: ContactRound },
      { label: "Calendar",  href: "/calendar",  icon: Calendar },
    ],
  },
  {
    label: "Production",
    items: [
      { label: "Boards",         href: "/boards",         icon: LayoutGrid },
      { label: "Storyboard",    href: "/storyboard",    icon: Clapperboard },
      { label: "Shot Lists",    href: "/shot-lists",    icon: ListChecks },
      { label: "Scripts",       href: "/scripts",       icon: ScrollText, soloHidden: true },
      { label: "Review",        href: "/revisions",     icon: Film },
      { label: "Tasks",         href: "/project-tasks", icon: ClipboardList },
      { label: "To Do",         href: "/tasks",         icon: CheckSquare },
      { label: "Editor Tools",  href: "/editor-tools",  icon: Wrench },
      { label: "Drones",        href: "/drones",        icon: DroneIcon },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Contracts",        href: "/contracts",        icon: FileSignature },
      { label: "Forms",            href: "/forms",            icon: FileText },
      { label: "Finance",          href: "/finance",          icon: DollarSign, producerOnly: true },
      { label: "Quote Calculator", href: "/quote-calculator", icon: Calculator, producerOnly: true },
      { label: "Team",             href: "/team",             icon: UsersRound, soloHidden: true },
    ],
  },
];

type UserPrefs = { user_role: string | null; team_size: string | null; uses_drone: boolean };

function isHiddenByPrefs(href: string, prefs: UserPrefs): boolean {
  if (!prefs.user_role) return false;
  switch (href) {
    case "/drones":       return !prefs.uses_drone;
    case "/crew":         return prefs.user_role === "solo_editor" || prefs.user_role === "agency";
    case "/team":         return prefs.team_size === "just_me" || prefs.user_role === "solo_editor";
    case "/retainers":    return !["agency", "production_company"].includes(prefs.user_role);
    case "/editor-tools": return ["production_company", "agency"].includes(prefs.user_role);
    case "/storyboard":   return prefs.user_role === "solo_editor" || prefs.user_role === "agency";
    case "/shot-lists":   return prefs.user_role === "solo_editor" || prefs.user_role === "agency";
    case "/scripts":      return prefs.user_role === "solo_editor" || prefs.user_role === "agency";
    default:              return false;
  }
}

const NAV_BOTTOM: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

// ── NavItem ──────────────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  isActive,
  showNewBadge,
  isGated,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  showNewBadge?: boolean;
  isGated?: boolean;
}) {
  if (isGated) {
    const gatedEl = (
      <div
        className={cn(
          "group relative flex h-9 cursor-not-allowed items-center gap-3 rounded-md px-2.5 text-sm opacity-35",
          collapsed ? "justify-center w-9 px-0" : ""
        )}
      >
        <item.icon className="h-4 w-4 shrink-0 text-white/40" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            <span className="ml-auto shrink-0">
              <Lock className="h-3 w-3 text-white/40" />
            </span>
          </>
        )}
        {collapsed && <Lock className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-white/40" />}
      </div>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>{gatedEl}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Coming soon</TooltipContent>
      </Tooltip>
    );
  }

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
        <>
          <span className="truncate transition-opacity duration-200">{item.label}</span>
          {showNewBadge && (
            <span className="ml-auto shrink-0 rounded-full bg-[#d4a853] px-1.5 py-0.5 text-[8px] font-bold leading-none text-black tracking-wide">
              NEW
            </span>
          )}
        </>
      )}
      {collapsed && showNewBadge && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#d4a853]" />
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ── FeedbackNavItem ──────────────────────────────────────────────────────────

function BetaNavItem({ collapsed, isActive }: { collapsed: boolean; isActive: boolean }) {
  const link = (
    <Link
      href="/beta-feedback"
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-all duration-150 mb-1",
        collapsed ? "justify-center w-9 px-0" : "",
        isActive
          ? "bg-white/[0.06] text-foreground font-medium"
          : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#d4a853]" />
      )}
      <FlaskConical className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">Feedback</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Feedback</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ── AdminNavItem ─────────────────────────────────────────────────────────────

function AdminNavItem({ collapsed, isActive }: { collapsed: boolean; isActive: boolean }) {
  const link = (
    <Link
      href="/admin"
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-all duration-150 mb-1",
        collapsed ? "justify-center w-9 px-0" : "",
        isActive
          ? "bg-violet-500/10 text-violet-300 font-medium ring-[0.5px] ring-inset ring-violet-500/20"
          : "text-violet-400/60 hover:bg-violet-500/[0.08] hover:text-violet-300"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-violet-400" />
      )}
      <ShieldCheck className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">Admin</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Admin Portal</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ── Session indicator ─────────────────────────────────────────────────────────

function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function SessionIndicator({ collapsed }: { collapsed: boolean }) {
  const { active, elapsed } = useEditSession();
  const router = useRouter();
  if (!active) return null;

  const timeStr = fmtElapsed(elapsed);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => router.push("/editor-tools")}
            className="mx-auto mb-1 flex h-9 w-9 items-center justify-center rounded-md"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/50 duration-1000" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-[#d4a853]" />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>Editing · {timeStr}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      onClick={() => router.push("/editor-tools")}
      className="mx-2 mb-1 flex items-center gap-2.5 rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/8 px-2.5 py-2 text-left transition-all hover:border-[#d4a853]/35 hover:bg-[#d4a853]/12 active:scale-[0.98]"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/50 duration-1000" />
        <span className="relative h-2 w-2 rounded-full bg-[#d4a853]" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] font-bold text-[#d4a853] leading-none">{timeStr}</p>
        <p className="text-[9px] text-white/30 truncate mt-0.5">{active.title}</p>
      </div>
    </button>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  role?: "owner" | "admin" | "member";
}

export function Sidebar({ collapsed, onToggle, role = "owner" }: SidebarProps) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("Studio User");
  const [plan, setPlan] = useState<string>(() =>
    (typeof window !== "undefined" ? sessionStorage.getItem("cf_plan") : null) ?? "studio"
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [planStatus, setPlanStatus] = useState<string>(() =>
    (typeof window !== "undefined" ? sessionStorage.getItem("cf_plan_status") : null) ?? ""
  );
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPrefs>({ user_role: null, team_size: null, uses_drone: false });
  const [moreExpanded, setMoreExpanded] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("sidebar-more") === "1" : false
  );
  const [trialDismissed, setTrialDismissed] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem("trial_banner_dismissed");
    return v ? parseInt(v) : null;
  });
  const [sidebarPins,   setSidebarPins]   = useState<string[]>([]);
  const [sidebarHidden, setSidebarHidden] = useState<string[]>([]);
  const [contextMenu,   setContextMenu]   = useState<{ href: string; x: number; y: number } | null>(null);
  const [newBadgeKeys,    setNewBadgeKeys]    = useState<Set<string>>(new Set());
  const [gatedKeys,       setGatedKeys]       = useState<Set<string>>(new Set());
  const [showCustomize,   setShowCustomize]   = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<string | null>(null);

  const [showCustomizeHint, setShowCustomizeHint] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("cf-customize-hint-seen");
  });

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const s = localStorage.getItem("sidebar-collapsed-sections");
      return s ? new Set(JSON.parse(s)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    fetch("/api/feature-flags")
      .then((r) => r.json())
      .then((d) => {
        if (d.badgeKeys) setNewBadgeKeys(new Set(d.badgeKeys as string[]));
        if (d.gatedKeys) setGatedKeys(new Set(d.gatedKeys as string[]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("first_name, last_name, plan, plan_status, trial_ends_at, is_admin, user_role, team_size, uses_drone, sidebar_pins, sidebar_hidden").eq("id", user.id).single()
        .then(({ data }) => {
          if (data?.plan) {
            setPlan(data.plan);
            sessionStorage.setItem("cf_plan", data.plan);
          }
          if (data?.plan_status) {
            setPlanStatus(data.plan_status);
            sessionStorage.setItem("cf_plan_status", data.plan_status);
          }
          if (data?.trial_ends_at) setTrialEndsAt(data.trial_ends_at);
          if (data?.is_admin) setIsAdmin(true);
          if (data?.user_role) setUserPrefs({ user_role: data.user_role, team_size: data.team_size ?? null, uses_drone: data.uses_drone ?? false });
          if (data?.sidebar_pins)   setSidebarPins(data.sidebar_pins as string[]);
          if (data?.sidebar_hidden) setSidebarHidden(data.sidebar_hidden as string[]);
          if (data?.first_name || data?.last_name) {
            setDisplayName(`${data.first_name ?? ""} ${data.last_name ?? ""}`.trim());
          } else {
            const meta = supabase.auth.getUser().then(({ data: { user: u } }) => {
              if (!u) return;
              const m = u.user_metadata ?? {};
              const metaName = [m.first_name || m.given_name, m.last_name || m.family_name]
                .filter(Boolean).join(" ").trim() || m.full_name || m.name || "";
              const emailPrefix = u.email?.split("@")[0] ?? "";
              setDisplayName(metaName || emailPrefix || "User");
            });
            void meta;
          }
        });
    });
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // User overrides take priority over onboarding prefs
  const isInMore = (href: string): boolean => {
    if (sidebarPins.includes(href))   return false;
    if (sidebarHidden.includes(href)) return true;
    return isHiddenByPrefs(href, userPrefs);
  };

  function openCtx(e: React.MouseEvent, href: string) {
    e.preventDefault();
    setContextMenu({ href, x: e.clientX, y: e.clientY });
  }

  function pinItem(href: string) {
    const pins   = [...sidebarPins.filter(h => h !== href), href];
    const hidden = sidebarHidden.filter(h => h !== href);
    setSidebarPins(pins); setSidebarHidden(hidden);
    saveCustomization(pins, hidden);
    setContextMenu(null);
  }

  function hideItem(href: string) {
    const hidden = [...sidebarHidden.filter(h => h !== href), href];
    const pins   = sidebarPins.filter(h => h !== href);
    setSidebarHidden(hidden); setSidebarPins(pins);
    saveCustomization(pins, hidden);
    setContextMenu(null);
  }

  function resetItem(href: string) {
    const pins   = sidebarPins.filter(h => h !== href);
    const hidden = sidebarHidden.filter(h => h !== href);
    setSidebarPins(pins); setSidebarHidden(hidden);
    saveCustomization(pins, hidden);
    setContextMenu(null);
  }

  function saveCustomization(pins: string[], hidden: string[]) {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void supabase.from("profiles").update({ sidebar_pins: pins, sidebar_hidden: hidden }).eq("id", user.id);
    });
  }

  function toggleItem(href: string) {
    if (isInMore(href)) {
      const pins   = [...sidebarPins.filter(h => h !== href), href];
      const hidden = sidebarHidden.filter(h => h !== href);
      setSidebarPins(pins); setSidebarHidden(hidden);
      saveCustomization(pins, hidden);
    } else {
      const hidden = [...sidebarHidden.filter(h => h !== href), href];
      const pins   = sidebarPins.filter(h => h !== href);
      setSidebarHidden(hidden); setSidebarPins(pins);
      saveCustomization(pins, hidden);
    }
  }

  function resetAll() {
    setSidebarPins([]); setSidebarHidden([]);
    saveCustomization([], []);
  }

  function toggleSection(label: string) {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      localStorage.setItem("sidebar-collapsed-sections", JSON.stringify([...next]));
      return next;
    });
  }

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const key   = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", key); };
  }, [contextMenu]);

  const solo       = isSoloPlan(plan);
  const isProducer = role === "owner" || role === "admin";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-screen flex-col border-r border-border bg-[#0b0b0b] transition-all duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-[radial-gradient(ellipse_80%_60%_at_30%_0%,rgba(212,168,83,0.07),transparent)] blur-sm" />

        {/* Logo + toggle */}
        <div
          className={cn(
            "relative flex min-h-14 items-center border-b border-border/60 px-3 pt-[env(safe-area-inset-top)]",
            collapsed ? "justify-center" : "justify-between"
          )}
        >
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/12 shadow-[0_0_12px_rgba(212,168,83,0.18)]">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-sm font-semibold tracking-tight text-gradient-gold">
                  CINEFLOW
                </span>
                <span className="text-[9px] text-white/25 tracking-widest uppercase">by Maltav</span>
              </div>
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

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-all duration-200 hover:bg-white/[0.06] hover:text-white active:scale-90"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Main nav */}
        <nav className="flex flex-1 flex-col overflow-y-auto p-2 pt-3 custom-scrollbar gap-4">

          {showCustomize ? (
            /* ── Edit mode: all items with toggles ── */
            <>
              <div className="mx-0.5 flex items-center justify-between rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/[0.05] px-3 py-2.5">
                <p className="text-[11px] text-white/40">Tap to show or hide</p>
                <button onClick={resetAll} className="text-[10px] text-white/20 hover:text-[#d4a853]/60 transition-colors shrink-0">
                  Reset
                </button>
              </div>
              {NAV_GROUPS.map((group, gi) => {
                const allItems = group.items.filter(
                  item => !(item.producerOnly && !isProducer)
                );
                if (allItems.length === 0) return null;
                return (
                  <div key={gi} className="flex flex-col gap-0.5">
                    {group.label && (
                      <p className="mb-1 px-2.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/20">
                        {group.label}
                      </p>
                    )}
                    {allItems.map(item => {
                      const visible = !isInMore(item.href);
                      return (
                        <button
                          key={item.href}
                          onClick={() => toggleItem(item.href)}
                          className="group flex h-9 w-full items-center gap-3 rounded-md px-2.5 transition-all hover:bg-white/[0.04]"
                        >
                          <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", visible ? "text-white/50" : "text-white/15")} />
                          <span className={cn("flex-1 text-left text-sm transition-colors", visible ? "text-white/70" : "text-white/20 line-through decoration-white/20")}>
                            {item.label}
                          </span>
                          <div className={cn(
                            "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
                            visible ? "bg-[#d4a853]" : "bg-white/[0.12]"
                          )}>
                            <span className={cn(
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200",
                              visible ? "left-[18px]" : "left-[2px]"
                            )} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          ) : (
            /* ── Normal mode ── */
            <>
              {NAV_GROUPS.map((group, gi) => {
                const visibleItems = group.items.filter(
                  (item) =>
                    !(item.producerOnly && !isProducer) &&
                    !isInMore(item.href)
                );
                if (visibleItems.length === 0) return null;
                const isSectionCollapsed = !!group.label && collapsedSections.has(group.label);

                return (
                  <div key={gi} className="flex flex-col gap-0.5">
                    {/* Section header — collapsible when expanded sidebar */}
                    {group.label && !collapsed && (
                      <button
                        onClick={() => toggleSection(group.label!)}
                        className="group mb-1 flex w-full items-center justify-between rounded px-2.5 py-0.5 transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/20 transition-colors group-hover:text-white/40">
                          {group.label}
                        </span>
                        <ChevronDown className={cn(
                          "h-3 w-3 text-white/15 transition-all duration-200 group-hover:text-white/35",
                          isSectionCollapsed && "-rotate-90"
                        )} />
                      </button>
                    )}
                    {group.label && collapsed && gi > 0 && (
                      <div className="mx-auto mb-1 h-px w-5 bg-white/10" />
                    )}
                    {/* Items with grid animation */}
                    <div className={cn(
                      "grid transition-all duration-200 ease-in-out",
                      isSectionCollapsed && !collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
                    )}>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {visibleItems.map((item) => {
                          const isSoloLocked = solo && !!item.soloHidden;
                          return (
                            <div key={item.href} onContextMenu={(e) => !isSoloLocked && openCtx(e, item.href)}>
                              {isSoloLocked ? (
                                <button
                                  onClick={() => setUpgradeModal(item.label)}
                                  className={cn(
                                    "group relative flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2.5 text-sm opacity-40 hover:opacity-60 transition-opacity",
                                    collapsed ? "justify-center px-0" : ""
                                  )}
                                >
                                  <item.icon className="h-4 w-4 shrink-0 text-white/40" />
                                  {!collapsed && (
                                    <>
                                      <span className="truncate text-white/60">{item.label}</span>
                                      <Lock className="ml-auto h-3 w-3 shrink-0 text-[#d4a853]/60" />
                                    </>
                                  )}
                                  {collapsed && <Lock className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 text-[#d4a853]/60" />}
                                </button>
                              ) : (
                                <NavLink
                                  item={item}
                                  collapsed={collapsed}
                                  isActive={isActive(item.href)}
                                  showNewBadge={newBadgeKeys.has(item.href.slice(1))}
                                  isGated={!isAdmin && gatedKeys.has(item.href.slice(1))}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* More tools */}
              {(() => {
                const hiddenItems = NAV_GROUPS.flatMap(g => g.items).filter(item => {
                  if (item.soloHidden) return false; // locked items don't appear in More
                  if (item.producerOnly && !isProducer) return false;
                  return isInMore(item.href);
                });
                if (hiddenItems.length === 0) return null;
                return (
                  <div className="flex flex-col gap-0.5">
                    {collapsed && <div className="mx-auto mb-1 h-px w-5 bg-white/10" />}
                    <button
                      onClick={() => {
                        const next = !moreExpanded;
                        setMoreExpanded(next);
                        if (typeof window !== "undefined") localStorage.setItem("sidebar-more", next ? "1" : "0");
                      }}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[11px] transition-all duration-150 text-white/25 hover:text-white/45",
                        collapsed ? "justify-center w-9 px-0" : ""
                      )}
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", moreExpanded && "rotate-180")} />
                      {!collapsed && <span>{moreExpanded ? "Show less" : `${hiddenItems.length} more tools`}</span>}
                    </button>
                    {moreExpanded && hiddenItems.map(item => (
                      <div key={item.href} onContextMenu={(e) => openCtx(e, item.href)}>
                        <NavLink
                          item={item}
                          collapsed={collapsed}
                          isActive={isActive(item.href)}
                          showNewBadge={newBadgeKeys.has(item.href.slice(1))}
                          isGated={!isAdmin && gatedKeys.has(item.href.slice(1))}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </nav>

        <SessionIndicator collapsed={collapsed} />

        {/* Trial countdown — only at 7, 3, 1 day milestones */}
        {planStatus === "trialing" && trialEndsAt && !collapsed && (() => {
          const days = trialDaysLeft(trialEndsAt);
          if (days <= 0) return null;
          const milestone = days <= 1 ? 1 : days <= 3 ? 3 : days <= 7 ? 7 : null;
          if (!milestone || trialDismissed === milestone) return null;
          const urgent = days <= 3;
          return (
            <div className="relative mx-2 mb-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/[0.06] p-3">
              <button
                onClick={() => {
                  localStorage.setItem("trial_banner_dismissed", String(milestone));
                  setTrialDismissed(milestone);
                }}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
              <p className={`pr-4 text-[11px] font-semibold ${urgent ? "text-orange-400" : "text-[#d4a853]"}`}>
                {days === 1 ? "Trial ends today" : `${days} days left in trial`}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Upgrade to keep your work.</p>
              <Link
                href="/upgrade"
                className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-2.5 py-1.5 text-[11px] font-bold text-black hover:bg-[#e0b55e] transition-colors"
              >
                <Zap className="h-3 w-3" />
                Choose a plan
              </Link>
            </div>
          );
        })()}

        {/* Bottom nav */}
        <div className="p-2">
          <BetaNavItem collapsed={collapsed} isActive={isActive("/beta-feedback")} />
          {isAdmin && <AdminNavItem collapsed={collapsed} isActive={isActive("/admin")} />}
          {NAV_BOTTOM.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive(item.href)}
              showNewBadge={newBadgeKeys.has(item.href.slice(1))}
              isGated={!isAdmin && gatedKeys.has(item.href.slice(1))}
            />
          ))}
          {/* Customize / Done button */}
          {!collapsed ? (
            <button
              onClick={() => {
                localStorage.setItem("cf-customize-hint-seen", "1");
                setShowCustomizeHint(false);
                if (showCustomize) { setShowCustomize(false); return; }
                if (collapsed) onToggle();
                setShowCustomize(true);
              }}
              className={cn(
                "relative flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm transition-all",
                showCustomize
                  ? "bg-[#d4a853]/10 text-[#d4a853] hover:bg-[#d4a853]/15"
                  : "text-white/30 hover:bg-white/[0.06] hover:text-white/60"
              )}
            >
              {showCustomizeHint && !showCustomize && (
                <span className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-[#d4a853]/50 animate-pulse" />
              )}
              {showCustomize
                ? <><Check className="h-4 w-4 shrink-0" /><span>Done editing</span></>
                : <><SlidersHorizontal className="h-4 w-4 shrink-0" /><span>Customize</span></>
              }
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => { if (collapsed) onToggle(); setShowCustomize(true); }}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/60"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={12}>Customize navigation</TooltipContent>
            </Tooltip>
          )}
          <Separator className="my-2" />
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
                {plan === "lifetime" ? (
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-[#d4a853]/75">✦ Founding Member</p>
                ) : (
                  <p className="truncate text-[10px] text-white/40">
                    {role === "owner" ? "Owner" : role === "admin" ? "Producer" : "Team Member"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Upgrade modal — shown when Solo user clicks a locked feature */}
      {upgradeModal && (
        <UpgradePlanModal featureLabel={upgradeModal} onClose={() => setUpgradeModal(null)} />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[300] min-w-[170px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#161616] shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {isInMore(contextMenu.href) ? (
            <button
              onClick={() => pinItem(contextMenu.href)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              Move to sidebar
            </button>
          ) : (
            <button
              onClick={() => hideItem(contextMenu.href)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              Move to More tools
            </button>
          )}
          {(sidebarPins.includes(contextMenu.href) || sidebarHidden.includes(contextMenu.href)) && (
            <button
              onClick={() => resetItem(contextMenu.href)}
              className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-3 py-2.5 text-left text-xs text-white/30 hover:bg-white/[0.06] hover:text-white/60 transition-colors"
            >
              Reset to default
            </button>
          )}
        </div>
      )}
    </TooltipProvider>
  );
}
