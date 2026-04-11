"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { LayoutDashboard, FolderKanban, Calendar, CheckSquare, UploadCloud, Settings, ScrollText, UsersRound, MoreHorizontal, X, DollarSign, List, Layers, Users, FlaskConical } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileSplash } from "./MobileSplash";
import { CommandPalette } from "./CommandPalette";
import { FeedbackButton } from "./FeedbackButton";
import { OnboardingIntro } from "./OnboardingIntro";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MOBILE_NAV_PRIMARY = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects",  href: "/projects",  icon: FolderKanban },
  { label: "Cuts & Delivers", href: "/revisions", icon: UploadCloud },
  { label: "Settings",  href: "/settings",  icon: Settings },
];

const MOBILE_NAV_MORE = [
  { label: "Calendar",   href: "/calendar",   icon: Calendar },
  { label: "Tasks",      href: "/tasks",      icon: CheckSquare },
  { label: "Scripts",    href: "/scripts",    icon: ScrollText },
  { label: "Shot Lists", href: "/shot-lists", icon: List },
  { label: "Storyboard", href: "/storyboard", icon: Layers },
  { label: "Clients",    href: "/clients",    icon: Users },
  { label: "Finance",       href: "/finance",        icon: DollarSign },
  { label: "Team",          href: "/team",           icon: UsersRound },
  { label: "Beta Feedback", href: "/beta-feedback",  icon: FlaskConical },
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
  const router = useRouter();
  const pathname = usePathname();

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
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Suspense fallback={<div className="h-14 border-b border-border bg-background/80" />}>
          <TopBar action={topBarAction} onSignOut={handleSignOut} onOpenPalette={() => setPaletteOpen(true)} theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
        </Suspense>
        {/* pb-16 on mobile for bottom nav clearance */}
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">{children}</main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-[#0b0b0b]/95 backdrop-blur-md md:hidden">
        {MOBILE_NAV_PRIMARY.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[9px] font-medium tracking-wide transition-colors",
              isActive(item.href)
                ? "text-[#d4a853]"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 transition-all duration-200",
                isActive(item.href) ? "text-[#d4a853] scale-110" : "text-muted-foreground"
              )}
            />
            <span>{item.label}</span>
          </Link>
        ))}
        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-[9px] font-medium tracking-wide transition-colors",
            moreOpen ? "text-[#d4a853]" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className={cn("h-5 w-5 transition-all duration-200", moreOpen ? "text-[#d4a853]" : "text-muted-foreground")} />
          <span>More</span>
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
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-[#0f0f0f] pb-[env(safe-area-inset-bottom)] md:hidden"
            >
              {/* Handle + header */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-border absolute top-3 left-1/2 -translate-x-1/2" />
                <span className="text-sm font-semibold text-foreground">More pages</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-px border-t border-border bg-border px-0">
                {MOBILE_NAV_MORE.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 bg-[#0f0f0f] px-2 py-4 text-[10px] font-medium tracking-wide transition-colors active:bg-accent",
                      isActive(item.href) ? "text-[#d4a853]" : "text-muted-foreground"
                    )}
                  >
                    <item.icon className={cn("h-6 w-6", isActive(item.href) ? "text-[#d4a853]" : "text-muted-foreground")} />
                    <span className="text-center leading-tight">{item.label}</span>
                  </Link>
                ))}
              </div>
              {/* extra bottom padding for safe area */}
              <div className="h-5" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}