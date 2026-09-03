"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

// The "which project does this belong to" dropdown — shared by the
// standalone transcript Save button and the AI panel's cut-list Save
// button, so the two pickers can't quietly drift apart from each other.
interface Props {
  projects: Project[];
  heading: string;
  onPick: (project: Project | null) => void;
  onClose: () => void;
  className?: string;
}

export function ProjectPicker({ projects, heading, onPick, onClose, className }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={cn("absolute right-0 z-50 w-64 overflow-hidden rounded-xl border border-border bg-[#111] shadow-2xl", className)}>
        <p className="border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </p>
        <button
          onClick={() => onPick(null)}
          className="flex w-full items-center border-b border-border/50 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
        >
          Personal (no project)
        </button>
        {projects.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p)}
                className="flex w-full items-center px-4 py-2.5 text-left text-sm text-foreground hover:bg-white/[0.05] transition-colors"
              >
                <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
