"use client";

import { Suspense } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { LayoutDashboard, FolderKanban, Calendar, UploadCloud, Settings } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects",  href: "/projects",  icon: FolderKanban },
  { label: "Calendar",  href: "/calendar",  icon: Calendar },
  { label: "Revisions", href: "/revisions", icon: UploadCloud },
  { label: "Settings",  href: "/settings",  icon: Settings },
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
  const router = useRouter();
  const pathname = usePathname();

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
          <TopBar action={topBarAction} onSignOut={handleSignOut} />
        </Suspense>
        {/* pb-16 on mobile for bottom nav clearance */}
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">{children}</main>
      </div>

      {/* ── Mobile bottom navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-[#0b0b0b]/95 backdrop-blur-md md:hidden">
        {MOBILE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[9px] font-medium tracking-wide transition-colors",
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
      </nav>
    </div>
  );
}
