"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { getProjectFiles } from "@/lib/supabase/queries";
import type { ProjectFile } from "@/types";
import { FileUploadZone } from "./FileUploadZone";

const DOC_CATEGORIES = [
  { key: "call-sheets",  label: "Call Sheets" },
  { key: "breakdowns",   label: "Breakdowns" },
  { key: "deal-memos",   label: "Deal Memos" },
  { key: "contracts",    label: "Contracts" },
  { key: "schedules",    label: "Schedules" },
  { key: "notes",        label: "Production Notes" },
  { key: "other",        label: "Other" },
];

interface ProductionDocsTabProps {
  projectId: string;
  canEdit: boolean;
}

export function ProductionDocsTab({ projectId, canEdit }: ProductionDocsTabProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    getProjectFiles(projectId, "docs").then(setFiles).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  function toggle(key: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto custom-scrollbar px-4 sm:px-5 py-3 space-y-1.5">
      {DOC_CATEGORIES.map(({ key, label }) => {
        const catFiles = files.filter((f) => (f.category || "other") === key);
        const isOpen = openCategories.has(key);

        return (
          <div key={key} className="overflow-hidden rounded-xl border border-border bg-card/50">
            <button
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-card transition-colors"
              onClick={() => toggle(key)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
              <span className="mr-2 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">{catFiles.length}</span>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-2.5 space-y-2">
                <FileUploadZone
                  projectId={projectId}
                  tab="docs"
                  category={key}
                  files={catFiles}
                  onFilesChange={(updated) => {
                    setFiles((prev) => [
                      ...prev.filter((f) => (f.category || "other") !== key),
                      ...updated,
                    ]);
                  }}
                  readOnly={!canEdit}
                  compact
                  label={`Upload ${label.toLowerCase()}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
