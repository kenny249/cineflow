"use client";

import { Bell, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      {/* Page title */}
      <div>
        <h1 className="font-display text-sm font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-8 w-52 rounded-md bg-muted pl-8 text-xs border-transparent focus-visible:border-border"
          />
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#d4a853]" />
        </Button>

        {/* Primary action */}
        {action && (
          <Button
            size="sm"
            variant="gold"
            onClick={action.onClick}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
