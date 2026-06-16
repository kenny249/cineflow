"use client";

import { useState } from "react";
import { X, Loader2, LayoutGrid, Sparkles, MapPin, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { BOARD_TEMPLATES, createBoardFromTemplate } from "@/lib/boards";
import type { Board } from "@/lib/boards";
import type { Project } from "@/types";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  blank:            <LayoutGrid className="h-5 w-5" />,
  preproduction:    <LayoutGrid className="h-5 w-5" />,
  script_breakdown: <Sparkles   className="h-5 w-5" />,
  location_scout:   <MapPin     className="h-5 w-5" />,
};

const TEMPLATE_COLOR: Record<string, string> = {
  blank:            "text-muted-foreground/60",
  preproduction:    "text-blue-400",
  script_breakdown: "text-[#d4a853]",
  location_scout:   "text-emerald-400",
};

interface TemplatePickerProps {
  onClose: () => void;
  onCreated: (board: Board) => void;
  /** Pass when creating from inside a project — locks the board to that project */
  projectId?: string;
  /** Pass from the global /boards page to let users optionally pick a project */
  projects?: Project[];
  defaultTitle?: string;
}

export function TemplatePicker({ onClose, onCreated, projectId, projects, defaultTitle = "New Board" }: TemplatePickerProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId ?? "");
  const [creating, setCreating] = useState(false);

  const resolvedProjectId = projectId ?? (selectedProjectId || undefined);

  async function handleCreate() {
    if (!selected) return;
    setCreating(true);
    try {
      const board = await createBoardFromTemplate(title.trim() || defaultTitle, selected, resolvedProjectId);
      onCreated(board);
      toast.success("Board created");
    } catch {
      toast.error("Failed to create board");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">New Board</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose a starting template</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Title + optional project picker */}
        <div className="px-5 pt-4 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Board title…"
            className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/40"
          />

          {/* Project link — only shown from global /boards page (projects prop present, no locked projectId) */}
          {!projectId && projects && projects.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground outline-none"
              >
                <option value="">No project (standalone)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Show locked project context */}
          {projectId && projects && (
            <div className="flex items-center gap-2 rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 px-3 py-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-[#d4a853]/70" />
              <span className="text-xs text-[#d4a853]/80">
                Linked to: <span className="font-semibold">{projects.find((p) => p.id === projectId)?.title ?? "this project"}</span>
              </span>
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="p-5 grid grid-cols-2 gap-2.5">
          {Object.entries(BOARD_TEMPLATES).map(([key, tmpl]) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`text-left p-3.5 rounded-xl border transition-all ${
                selected === key
                  ? "border-[#d4a853]/60 bg-[#d4a853]/5"
                  : "border-border hover:border-border/80 hover:bg-accent/50"
              }`}
            >
              <div className={`mb-2 ${TEMPLATE_COLOR[key]}`}>
                {TEMPLATE_ICONS[key]}
              </div>
              <p className="text-xs font-semibold text-foreground mb-0.5">{tmpl.name}</p>
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{tmpl.description}</p>
              {tmpl.cards.length > 0 && (
                <p className="mt-1.5 text-[9px] text-muted-foreground/40">{tmpl.cards.length} starter cards</p>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || creating}
            className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create Board
          </button>
        </div>
      </div>
    </div>
  );
}
