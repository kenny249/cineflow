"use client";

import { useEffect, useState } from "react";
import { ScrollText, Plus, Trash2, FileText } from "lucide-react";
import { getProjectFiles } from "@/lib/supabase/queries";
import type { ProjectFile } from "@/types";
import { FileUploadZone } from "./FileUploadZone";

interface ScriptsTabProps {
  projectId: string;
  canEdit: boolean;
}

export function ScriptsTab({ projectId, canEdit }: ScriptsTabProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectFiles(projectId, "scripts").then(setFiles).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border px-4 sm:px-5 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{files.length} script file{files.length !== 1 ? "s" : ""}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">Upload PDFs, Final Draft (.fdx), Fountain, or any script format. Files stored as-is, up to 5 GB.</p>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-4">
        {files.length === 0 && !canEdit ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="font-display font-semibold">No scripts uploaded</p>
            <p className="mt-1 text-sm text-muted-foreground">Script files will appear here once uploaded</p>
          </div>
        ) : (
          <FileUploadZone
            projectId={projectId}
            tab="scripts"
            files={files}
            onFilesChange={setFiles}
            readOnly={!canEdit}
            accept=".pdf,.fdx,.fountain,.txt,.rtf,.docx,.doc"
            label="Upload script files (PDF, FDX, Fountain…)"
          />
        )}
      </div>
    </div>
  );
}
