"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderPlus, List, UploadCloud, FileText, Repeat2, FileSignature,
  CalendarDays, ArrowRight, Settings2, X, Check, ClipboardList,
} from "lucide-react";
import { updateProfile } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

// ── Full action catalog ───────────────────────────────────────────────────────

export const ACTION_CATALOG = [
  {
    key: "new_project",
    label: "New Project",
    description: "Start a new production",
    icon: FolderPlus,
    color: "text-[#d4a853]",
    bg: "bg-[#d4a853]/10",
    border: "border-[#d4a853]/15",
    hoverBorder: "hover:border-[#d4a853]/30",
    route: null, // handled by callback
  },
  {
    key: "shot_list",
    label: "Add Shot List",
    description: "Plan your next shoot",
    icon: List,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/15",
    hoverBorder: "hover:border-blue-500/30",
    route: "/shot-lists",
  },
  {
    key: "revision",
    label: "Upload Revision",
    description: "Share a new cut",
    icon: UploadCloud,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/15",
    hoverBorder: "hover:border-emerald-500/30",
    route: "/revisions",
  },
  {
    key: "new_invoice",
    label: "New Invoice",
    description: "Create a draft invoice",
    icon: FileText,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/15",
    hoverBorder: "hover:border-violet-500/30",
    route: "/finance",
  },
  {
    key: "new_retainer",
    label: "New Retainer",
    description: "Set up a monthly client",
    icon: Repeat2,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/15",
    hoverBorder: "hover:border-amber-500/30",
    route: "/retainers",
  },
  {
    key: "new_contract",
    label: "New Contract",
    description: "Draft a client agreement",
    icon: FileSignature,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/15",
    hoverBorder: "hover:border-rose-500/30",
    route: "/contracts",
  },
  {
    key: "new_task",
    label: "Add Task",
    description: "Track something to do",
    icon: ClipboardList,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/15",
    hoverBorder: "hover:border-cyan-500/30",
    route: "/tasks",
  },
  {
    key: "calendar",
    label: "Open Calendar",
    description: "View your schedule",
    icon: CalendarDays,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/15",
    hoverBorder: "hover:border-indigo-500/30",
    route: "/calendar",
  },
] as const;

export type ActionKey = typeof ACTION_CATALOG[number]["key"];

const DEFAULT_KEYS: ActionKey[] = ["new_project", "shot_list", "revision"];
const MAX_ACTIONS = 4;

// ── Component ─────────────────────────────────────────────────────────────────

interface QuickActionsProps {
  savedKeys?: string[] | null;
  onNewProject?: () => void;
}

export function QuickActions({ savedKeys, onNewProject }: QuickActionsProps) {
  const router = useRouter();
  const [customizing, setCustomizing] = useState(false);
  const [selected, setSelected] = useState<ActionKey[]>(
    (savedKeys?.length ? savedKeys : DEFAULT_KEYS) as ActionKey[]
  );
  const [saving, setSaving] = useState(false);

  const activeActions = ACTION_CATALOG.filter((a) => selected.includes(a.key));

  function toggle(key: ActionKey) {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_ACTIONS) return prev;
      return [...prev, key];
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({ quick_actions: selected });
    } catch { /* best-effort */ }
    setSaving(false);
    setCustomizing(false);
  }

  function handleCancel() {
    setSelected((savedKeys?.length ? savedKeys : DEFAULT_KEYS) as ActionKey[]);
    setCustomizing(false);
  }

  function handleAction(key: ActionKey) {
    if (customizing) return;
    if (key === "new_project") { onNewProject?.(); return; }
    const action = ACTION_CATALOG.find((a) => a.key === key);
    if (action?.route) router.push(action.route);
  }

  // ── Customize picker ───────────────────────────────────────────────────────

  if (customizing) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Choose up to {MAX_ACTIONS}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selected.length === 0}
              className="flex items-center gap-1 rounded-md bg-[#d4a853] px-2.5 py-1 text-[11px] font-semibold text-black disabled:opacity-50 hover:bg-[#c49843] transition-colors"
            >
              {saving ? "Saving…" : <><Check className="h-3 w-3" /> Save</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {ACTION_CATALOG.map((action) => {
            const isSelected = selected.includes(action.key);
            const isDisabled = !isSelected && selected.length >= MAX_ACTIONS;
            return (
              <button
                key={action.key}
                onClick={() => toggle(action.key)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-150",
                  isSelected
                    ? `${action.border} ${action.bg}`
                    : "border-border bg-muted/20 hover:bg-muted/40",
                  isDisabled && "opacity-30 cursor-not-allowed"
                )}
              >
                <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", isSelected ? action.bg : "bg-muted")}>
                  <action.icon className={cn("h-3.5 w-3.5", isSelected ? action.color : "text-muted-foreground/50")} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[11px] font-medium truncate", isSelected ? "text-foreground" : "text-muted-foreground")}>{action.label}</p>
                </div>
                {isSelected && <Check className={cn("h-3 w-3 shrink-0", action.color)} />}
              </button>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center">
          {selected.length}/{MAX_ACTIONS} selected
        </p>
      </div>
    );
  }

  // ── Normal view ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2">
      {activeActions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={() => handleAction(action.key)}
          className={cn(
            "group flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition-all duration-150 hover:bg-accent/30",
            action.border, action.hoverBorder
          )}
        >
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", action.bg)}>
            <action.icon className={cn("h-4 w-4", action.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">{action.label}</p>
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
        </button>
      ))}

      <button
        onClick={() => setCustomizing(true)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:border-border/80 transition-colors"
      >
        <Settings2 className="h-3 w-3" />
        Customize
      </button>
    </div>
  );
}
