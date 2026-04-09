"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { supabase } from "@/lib/supabase/client";

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

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    router.push("/login");
  };

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

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar action={topBarAction} onSignOut={handleSignOut} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
