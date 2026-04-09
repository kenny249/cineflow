"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Search, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";

interface TopBarProps {
  action?: {
    label: string;
    onClick: () => void;
  };
  onSignOut?: () => void;
}

export function TopBar({ action, onSignOut }: TopBarProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [localQ, setLocalQ] = useState(searchParams.get("q") ?? "");

  const pushSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q);
      else params.delete("q");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams],
  );

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-sm">
      {/* ── Search ── */}
      <div className="relative hidden w-64 md:block">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search projects..."
          value={localQ}
          onChange={(e) => {
            setLocalQ(e.target.value);
            pushSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setLocalQ("");
              pushSearch("");
            }
          }}
          className="h-8 w-full rounded-md border border-border bg-muted/50 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#d4a853]/50 focus:ring-2 focus:ring-[#d4a853]/20 focus:shadow-[0_0_0_3px_rgba(212,168,83,0.10)] transition-all duration-200"
        />
        {localQ ? (
          <button
            onClick={() => { setLocalQ(""); pushSearch(""); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <span className="text-xs">✕</span>
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden select-none items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        )}
      </div>

      {/* ── Right side ── */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Primary action */}
        {action && (
          <Button
            size="sm"
            variant="gold"
            onClick={action.onClick}
            className="mr-2 h-8 gap-1.5 text-xs"
          >
            {action.label}
          </Button>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-[#d4a853] transition-colors duration-200">
          <Bell className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5 rounded-full bg-[#d4a853]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4a853] opacity-50" />
          </span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent focus:outline-none">
              <Avatar className="h-6 w-6 ring-1 ring-border">
                <AvatarImage
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80"
                  alt="Kenneth Garcia"
                />
                <AvatarFallback className="text-[10px]">KG</AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-foreground md:block">
                Kenneth
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-xs font-medium text-foreground">Kenneth Garcia</p>
                <p className="text-[10px] text-muted-foreground">kenny@maltavmedia.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer gap-2">
                <User className="h-3.5 w-3.5" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="cursor-pointer gap-2">
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="gap-2 text-red-400 focus:text-red-400">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
