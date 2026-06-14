"use client";

import { useEffect, useState } from "react";
import { FileText, Plus, ChevronDown, ChevronUp, Calendar, Edit3, Trash2 } from "lucide-react";
import { getProjectFiles } from "@/lib/supabase/queries";
import type { ProjectFile } from "@/types";
import { FileUploadZone } from "./FileUploadZone";
import { toast } from "sonner";

const DOC_CATEGORIES = [
  { key: "call-sheets",  label: "Call Sheets" },
  { key: "breakdowns",   label: "Breakdowns" },
  { key: "deal-memos",   label: "Deal Memos" },
  { key: "contracts",    label: "Contracts" },
  { key: "schedules",    label: "Schedules" },
  { key: "notes",        label: "Production Notes" },
  { key: "other",        label: "Other" },
];

interface SavedCallSheet {
  id: string;
  title: string;
  shoot_date: string | null;
  updated_at: string;
}

interface ProductionDocsTabProps {
  projectId: string;
  canEdit: boolean;
  onOpenCallSheet?: (sheetId?: string) => void;
}

export function ProductionDocsTab({ projectId, canEdit, onOpenCallSheet }: ProductionDocsTabProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [callSheets, setCallSheets] = useState<SavedCallSheet[]>([]);

  useEffect(() => {
    Promise.all([
      getProjectFiles(projectId, "docs"),
      fetch(`/api/call-sheets?project_id=${projectId}`).then((r) => r.json()),
    ])
      .then(([filesData, sheetsData]) => {
        setFiles(filesData);
        setCallSheets(Array.isArray(sheetsData) ? sheetsData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function deleteCallSheet(id: string) {
    if (!confirm("Delete this call sheet?")) return;
    const res = await fetch(`/api/call-sheets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCallSheets((prev) => prev.filter((s) => s.id !== id));
      toast.success("Call sheet deleted");
    } else {
      toast.error("Failed to delete call sheet");
    }
  }

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
    <div className="flex flex-col px-4 sm:px-5 py-3 space-y-1.5">
      {DOC_CATEGORIES.map(({ key, label }) => {
        const catFiles = files.filter((f) => (f.category || "other") === key);
        const isOpen = openCategories.has(key);

        if (key === "call-sheets") {
          return (
            <div key={key} className="overflow-hidden rounded-xl border border-border bg-card/50">
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-card transition-colors"
                onClick={() => toggle(key)}
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                <span className="mr-2 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {callSheets.length + catFiles.length}
                </span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="border-t border-border px-3 py-2.5 space-y-2">
                  {/* New call sheet button */}
                  {canEdit && onOpenCallSheet && (
                    <button
                      onClick={() => onOpenCallSheet(undefined)}
                      className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-2 text-left text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New Call Sheet
                    </button>
                  )}

                  {/* Saved interactive call sheets */}
                  {callSheets.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Edited {new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenCallSheet && (
                          <button
                            onClick={() => onOpenCallSheet(s.id)}
                            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-accent transition-colors"
                          >
                            <Edit3 className="h-3 w-3" /> Open
                          </button>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => deleteCallSheet(s.id)}
                            className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* PDF uploads */}
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
                    label="Upload call sheet PDF"
                  />
                </div>
              )}
            </div>
          );
        }

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
