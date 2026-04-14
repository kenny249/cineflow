"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LayoutDashboard, FolderKanban, Calendar, CheckSquare, UploadCloud, Settings, ScrollText, UsersRound, MoreHorizontal, X, DollarSign, List, Layers, Users, FlaskConical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SidebarDivider } from "./SidebarDivider";
import { TopBar } from "./TopBar";
import { MobileSplash } from "./MobileSplash";
import { CommandPalette } from "./CommandPalette";
import { FeedbackButton } from "./FeedbackButton";
import { OnboardingIntro } from "./OnboardingIntro";
import { DemoBanner } from "./DemoBanner";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isSoloPlan } from "@/types";

type MobileNavItem = { label: string; href: string; icon: LucideIcon; special?: boolean };

// ── Solo: shoot-day focused bottom bar ──────────────────────────────────────
const MOBILE_SOLO_PRIMARY: MobileNavItem[] = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Tasks",      href: "/tasks",      icon: CheckSquare },
  { label: "Shot Lists", href: "/shot-lists", icon: List },
  { label: "Cuts",       href: "/revisions",  icon: UploadCloud },
];
const MOBILE_SOLO_MORE: MobileNavItem[] = [
  { label: "Projects",      href: "/projects",      icon: FolderKanban },
  { label: "Clients",       href: "/clients",       icon: Users },
  { label: "Calendar",      href: "/calendar",      icon: Calendar },
  { label: "Finance",       href: "/finance",       icon: DollarSign },
  { label: "Settings",      href: "/settings",      icon: Settings },
  { label: "Beta Feedback", href: "/beta-feedback", icon: FlaskConical, special: true },
];

// ── Studio: project management focused bottom bar ───────────────────────────
const MOBILE_STUDIO_PRIMARY: MobileNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects",  href: "/projects",  icon: FolderKanban },
  { label: "Cuts",      href: "/revisions", icon: UploadCloud },
  { label: "Calendar",  href: "/calendar",  icon: Calendar },
];
const MOBILE_STUDIO_MORE: MobileNavItem[] = [
  { label: "Tasks",         href: "/tasks",         icon: CheckSquare },
  { label: "Shot Lists",    href: "/shot-lists",    icon: List },
  { label: "Scripts",       href: "/scripts",       icon: ScrollText },
  { label: "Storyboard",    href: "/storyboard",    icon: Layers },
  { label: "Clients",       href: "/clients",       icon: Users },
  { label: "Finance",       href: "/finance",       icon: DollarSign },
  { label: "Team",          href: "/team",          icon: UsersRound },
  { label: "Settings",      href: "/settings",      icon: Settings },
  { label: "Beta Feedback", href: "/beta-feedback", icon: FlaskConical, special: true },
];

interface AppLayoutProps {
  children: React.ReactNode;
  topBarAction?: {
    label: string;
    onClick: () => void;
  };
}

export function AppLayout({ children, topBarAction }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);
  const [theme, setTheme] = useLocalStorage<"dark" | "light">("cineflow-theme", "dark");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plan, setPlan] = useState<string>(() =>
    (typeof window !== "undefined" ? sessionStorage.getItem("cf_plan") : null) ?? "studio_beta"
  );
  const router = useRouter();
  const pathname = usePathname();

  // Confirm plan from Supabase and keep sessionStorage in sync
  useEffect(() => {
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

  // Apply theme to document
  useEffect(() => {
    if (theme === "light") {
      document.documentElement.dataset.theme = "light";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [theme]);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSignOut = async () => {
    const { error } = await createClient().auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const solo         = isSoloPlan(plan);
  const primaryNav   = solo ? MOBILE_SOLO_PRIMARY   : MOBILE_STUDIO_PRIMARY;
  const moreItems    = solo ? MOBILE_SOLO_MORE       : MOBILE_STUDIO_MORE;
  const moreIsActive = moreItems.some((item) => isActive(item.href));

  return (
    <div className="relative flex h-screen overflow-hidden bg-background">
      <MobileSplash />
      <OnboardingIntro />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <FeedbackButton />
      {/* ── Ambient grain overlay across entire app ── */}
      <svg
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 h-full w-full"
        style={{ opacity: 0.07, mixBlendMode: "overlay" }}
      >
        <defs>
          <filter id="app-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#app-grain)" />
      </svg>

      {/* ── Very subtle corner ambient glow ── */}
      <div className="pointer-events-none fixed left-0 top-0 z-0 h-64 w-64 rounded-full bg-[#d4a853]/[0.04] blur-[100px]" />


      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <SidebarDivider />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-14 border-b border-border bg-background/80" />}>
          <TopBar action={topBarAction} onSignOut={handleSignOut} onOpenPalette={() => setPaletteOpen(true)} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
        </Suspense>
        <DemoBanner />
        {/* pb-20 on mobile for bottom nav clearance (nav is ~68px + safe area) */}
        <main className="flex-1 overflow-hidden pb-20 md:pb-0">{children}</main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/60 bg-[#0a0a0a]/96 backdrop-blur-xl md:hidden">
        {primaryNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-all active:opacity-60"
            >
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                active ? "bg-[#d4a853]/12 shadow-[0_0_12px_rgba(212,168,83,0.15)]" : ""
              )}>
                <item.icon className={cn(
                  "h-[1.2rem] w-[1.2rem] transition-all duration-200",
                  active ? "text-[#d4a853] scale-110" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium tracking-wide transition-colors",
                active ? "text-[#d4a853]" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] transition-all active:opacity-60"
        >
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
            moreOpen || moreIsActive ? "bg-[#d4a853]/12 shadow-[0_0_12px_rgba(212,168,83,0.15)]" : ""
          )}>
            <MoreHorizontal className={cn(
              "h-[1.2rem] w-[1.2rem] transition-all duration-200",
              moreOpen || moreIsActive ? "text-[#d4a853]" : "text-muted-foreground"
            )} />
          </div>
          <span className={cn(
            "text-[10px] font-medium tracking-wide transition-colors",
            moreOpen || moreIsActive ? "text-[#d4a853]" : "text-muted-foreground"
          )}>
            More
          </span>
        </button>
      </nav>

      {/* ── More drawer (bottom sheet) ── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              onClick={() => setMoreOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              key="more-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border/60 bg-[#0d0d0d] md:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 pt-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">
                    {solo ? "Solo Tools" : "Studio Tools"}
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    {solo ? "Everything for your workflow" : "Your full production suite"}
                  </p>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground transition-all hover:bg-white/[0.10] hover:text-foreground active:scale-90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Nav grid — 3 columns for comfortable tapping */}
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {moreItems.map((item) => {
                  const active  = isActive(item.href);
                  const special = item.special;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2.5 rounded-2xl border py-5 px-2 transition-all duration-150 active:scale-95",
                        special
                          ? "border-[#d4a853]/35 bg-[#d4a853]/[0.07] text-[#d4a853]"
                          : active
                            ? "border-[#d4a853]/25 bg-[#d4a853]/[0.06] text-[#d4a853]"
                            : "border-border/60 bg-white/[0.03] text-muted-foreground hover:border-border hover:bg-white/[0.05]"
                      )}
                    >
                      {special ? (
                        <span className="relative flex items-center justify-center">
                          <span className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/20 duration-1000" />
                          <item.icon className="relative h-[1.35rem] w-[1.35rem] text-[#d4a853] drop-shadow-[0_0_8px_rgba(212,168,83,0.65)]" />
                        </span>
                      ) : (
                        <item.icon className={cn(
                          "h-[1.35rem] w-[1.35rem]",
                          active ? "text-[#d4a853]" : "text-muted-foreground"
                        )} />
                      )}
                      <span className={cn(
                        "text-center text-[11px] font-semibold leading-tight tracking-wide",
                        special ? "text-[#d4a853]" : active ? "text-[#d4a853]" : "text-muted-foreground"
                      )}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Safe area spacer */}
              <div className="h-[max(1rem,env(safe-area-inset-bottom))]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}