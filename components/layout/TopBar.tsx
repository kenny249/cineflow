"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search, ChevronDown, LogOut, User, Settings, Clapperboard, CalendarDays, Upload, CheckCheck, Sun, Moon } from "lucide-react";
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
import { getOrCreateDisplayName, getInitials } from "@/lib/random-name";
import { cn } from "@/lib/utils";

const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    icon: Clapperboard,
    color: "text-[#d4a853]",
    bg: "bg-[#d4a853]/10",
    title: "Project review requested",
    desc: "Protetta, client left feedback",
    time: "2m ago",
    unread: true,
  },
  {
    id: "2",
    icon: CalendarDays,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Shoot scheduled tomorrow",
    desc: "Downtown commercial, 9:00 AM",
    time: "1h ago",
    unread: true,
  },
  {
    id: "3",
    icon: Upload,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    title: "Revision uploaded",
    desc: "Cut v3 is ready for review",
    time: "3h ago",
    unread: false,
  },
  {
    id: "4",
    icon: CheckCheck,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    title: "Shot list approved",
    desc: "All 24 shots confirmed",
    time: "Yesterday",
    unread: false,
  },
];

interface TopBarProps {
  action?: {
    label: string;
    onClick: () => void;
  };
  onSignOut?: () => void;
  onOpenPalette?: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export function TopBar({ action, onSignOut, onOpenPalette, theme = "dark", onToggleTheme }: TopBarProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Studio User");
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

  useEffect(() => {
    setDisplayName(getOrCreateDisplayName());
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur-sm">
      {/* ⌘K Search trigger */}
      <div className="relative hidden w-64 md:block">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <button
          onClick={onOpenPalette}
          className="flex h-8 w-full items-center rounded-md border border-border bg-muted/50 pl-9 pr-14 text-xs text-muted-foreground transition-all hover:border-[#d4a853]/30 hover:text-foreground"
        >
          Search or jump to…
        </button>
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden select-none items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:flex">
          ⌘K
        </kbd>
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

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-[#d4a853] transition-colors duration-200">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-1.5 w-1.5 rounded-full bg-[#d4a853]">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4a853] opacity-50" />
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <DropdownMenuLabel className="p-0 font-semibold text-sm text-foreground">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853] text-[9px] font-bold text-black">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuLabel>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-muted-foreground hover:text-[#d4a853] transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors hover:bg-accent/50 cursor-pointer",
                    n.unread && "bg-[#d4a853]/[0.03]"
                  )}
                  onClick={() => setNotifications((prev) =>
                    prev.map((item) => item.id === n.id ? { ...item, unread: false } : item)
                  )}
                >
                  <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5", n.bg)}>
                    <n.icon className={cn("h-3.5 w-3.5", n.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium text-foreground", n.unread && "text-white")}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{n.desc}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{n.time}</p>
                  </div>
                  {n.unread && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853] mt-2 shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-2.5">
              <p className="text-center text-[11px] text-muted-foreground">You&apos;re all caught up</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-accent focus:outline-none">
              <Avatar className="h-6 w-6 ring-1 ring-border">
                <AvatarFallback className="text-[10px] bg-[#d4a853]/20 text-[#d4a853]">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-xs font-medium text-foreground md:block">
                {displayName.split(" ")[0]}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-xs font-medium text-foreground">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">Beta User</p>
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
