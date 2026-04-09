"use client";

import { FolderPlus, List, UploadCloud, ArrowRight } from "lucide-react";

const ACTIONS = [
  {
    icon: FolderPlus,
    label: "New Project",
    description: "Start a new production",
    color: "text-[#d4a853]",
    bg: "bg-[#d4a853]/10",
    border: "border-[#d4a853]/15",
    hoverBorder: "hover:border-[#d4a853]/30",
  },
  {
    icon: List,
    label: "Add Shot List",
    description: "Plan your next shoot",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/15",
    hoverBorder: "hover:border-blue-500/30",
  },
  {
    icon: UploadCloud,
    label: "Upload Revision",
    description: "Share a new cut",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/15",
    hoverBorder: "hover:border-emerald-500/30",
  },
];

interface QuickActionsProps {
  onNewProject?: () => void;
  onAddShotList?: () => void;
  onUploadRevision?: () => void;
}

export function QuickActions({ onNewProject, onAddShotList, onUploadRevision }: QuickActionsProps) {
  const handleAction = (label: string) => {
    if (label === "New Project") return onNewProject?.();
    if (label === "Add Shot List") return onAddShotList?.();
    if (label === "Upload Revision") return onUploadRevision?.();
  };

  return (
    <div className="flex flex-col gap-2">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => handleAction(action.label)}
          className={`group flex items-center gap-3 rounded-xl border ${action.border} ${action.hoverBorder} bg-card p-3.5 text-left transition-all duration-150 hover:bg-accent/30`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.bg} transition-transform duration-200 group-hover:scale-110`}>
            <action.icon className={`h-4 w-4 ${action.color}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">{action.label}</p>
            <p className="text-[10px] text-muted-foreground">{action.description}</p>
          </div>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
        </button>
      ))}
    </div>
  );
}
