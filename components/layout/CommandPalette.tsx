"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, FolderKanban, Calendar, CheckSquare,
  ClipboardList, FileSignature, ScrollText, DollarSign, UsersRound,
  Settings, Users, ArrowRight, Film, Plus,
} from "lucide-react";
import { getProjects } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/dashboard",      icon: LayoutDashboard, category: "Go to" },
  { label: "Projects",   href: "/projects",       icon: FolderKanban,    category: "Go to" },
  { label: "Clients",    href: "/clients",        icon: Users,           category: "Go to" },
  { label: "Calendar",   href: "/calendar",       icon: Calendar,        category: "Go to" },
  { label: "To Do",      href: "/tasks",          icon: CheckSquare,     category: "Go to" },
  { label: "Tasks",      href: "/project-tasks",  icon: ClipboardList,   category: "Go to" },
  { label: "Contracts",  href: "/contracts",      icon: FileSignature,   category: "Go to" },
  { label: "Scripts",    href: "/scripts",        icon: ScrollText,      category: "Go to" },
  { label: "Finance",    href: "/finance",        icon: DollarSign,      category: "Go to" },
  { label: "Team",       href: "/team",           icon: UsersRound,      category: "Go to" },
  { label: "Settings",   href: "/settings",       icon: Settings,        category: "Go to" },
];

interface CommandItem {
  key: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  subtitle?: string;
  action?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewProject?: () => void;
}

export function CommandPalette({ open, onClose, onNewProject }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!open) return;
    getProjects().then(setProjects).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const projectItems: CommandItem[] = projects.map((p) => ({
    key: `proj-${p.id}`,
    label: p.title,
    href: `/projects/${p.id}`,
    icon: Film,
    category: "Projects",
    subtitle: p.client_name ?? undefined,
  }));

  const actionItems: CommandItem[] = onNewProject
    ? [{ key: "new-project", label: "New Project", icon: Plus, category: "Actions", action: () => { onNewProject(); onClose(); } }]
    : [];

  const base: CommandItem[] = [
    ...NAV_ITEMS.map((n) => ({ ...n, key: `nav-${n.href}` })),
    ...(query ? projectItems : projectItems.slice(0, 4)),
    ...actionItems,
  ];

  const filtered = query
    ? base.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : base;

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action) { item.action(); return; }
      if (item.href) { router.push(item.href); onClose(); }
    },
    [router, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); return; }
      if (e.key === "Enter" && filtered[selected]) { e.preventDefault(); handleSelect(filtered[selected]); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [open, filtered, selected, onClose, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  let idx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Search pages, projects..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            Object.entries(groups).map(([category, items]) => (
              <div key={category}>
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {category}
                </p>
                {items.map((item) => {
                  const i = idx++;
                  return (
                    <button
                      key={item.key}
                      data-idx={i}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelected(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                        i === selected
                          ? "bg-[#d4a853]/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                          i === selected ? "bg-[#d4a853]/15" : "bg-muted/80"
                        )}
                      >
                        <item.icon className={cn("h-3.5 w-3.5", i === selected ? "text-[#d4a853]" : "")} />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-sm font-medium text-foreground">{item.label}</div>
                        {item.subtitle && (
                          <div className="truncate text-[11px] text-muted-foreground">{item.subtitle}</div>
                        )}
                      </div>
                      <ArrowRight className="h-3 w-3 shrink-0 opacity-40" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <p className="text-[10px] text-muted-foreground">↑↓ navigate · ↵ open · ESC close</p>
          <span className="text-[10px] font-mono text-muted-foreground/50">⌘K</span>
        </div>
      </div>
    </div>
  );
}
