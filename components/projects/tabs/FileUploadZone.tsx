"use client";

import { useRef, useState } from "react";
import { Upload, File, X, Loader2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createProjectFile, deleteProjectFile } from "@/lib/supabase/queries";
import type { ProjectFile, ProjectFileTab } from "@/types";
import { formatFileSize } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploadZoneProps {
  projectId: string;
  tab: ProjectFileTab;
  category?: string;
  files: ProjectFile[];
  onFilesChange: (files: ProjectFile[]) => void;
  readOnly?: boolean;
  accept?: string;
  label?: string;
  compact?: boolean;
}

function fileIcon(mime?: string): string {
  if (!mime) return "📄";
  if (mime.includes("pdf")) return "📑";
  if (mime.includes("script") || mime.includes("fountain") || mime.includes("fdx")) return "🎬";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("video")) return "🎥";
  if (mime.includes("audio")) return "🎵";
  if (mime.includes("zip") || mime.includes("rar")) return "📦";
  return "📄";
}

export function FileUploadZone({
  projectId,
  tab,
  category,
  files,
  onFilesChange,
  readOnly = false,
  accept,
  label = "Drop files here or click to upload",
  compact = false,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]); // file names in progress
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function uploadFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList);
    if (!arr.length) return;
    const client = createClient();
    const { data: { user } } = await client.auth.getUser();

    for (const file of arr) {
      setUploading((prev) => [...prev, file.name]);
      try {
        // Use chunked multipart upload via Supabase storage
        const storagePath = `${projectId}/${tab}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await client.storage
          .from("project-files")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = client.storage
          .from("project-files")
          .getPublicUrl(storagePath);

        const created = await createProjectFile({
          project_id: projectId,
          tab,
          category: category ?? undefined,
          name: file.name,
          storage_path: storagePath,
          public_url: urlData?.publicUrl,
          size: file.size,
          mime_type: file.type || undefined,
          uploaded_by: user?.id,
        });

        onFilesChange([created, ...files]);
        toast.success(`${file.name} uploaded`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Failed to upload ${file.name}: ${msg}`);
      } finally {
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }
  }

  async function handleDelete(file: ProjectFile) {
    setDeletingId(file.id);
    try {
      const client = createClient();
      await client.storage.from("project-files").remove([file.storage_path]);
      await deleteProjectFile(file.id);
      onFilesChange(files.filter((f) => f.id !== file.id));
      toast.success("File removed");
    } catch {
      toast.error("Failed to delete file");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(file: ProjectFile) {
    try {
      if (file.public_url) {
        window.open(file.public_url, "_blank");
        return;
      }
      const client = createClient();
      const { data, error } = await client.storage.from("project-files").createSignedUrl(file.storage_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Could not get download link");
    }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {!readOnly && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={compact
            ? `flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 transition-colors ${dragging ? "border-[#d4a853]/60 bg-[#d4a853]/10" : "border-border hover:border-[#d4a853]/30 hover:bg-[#d4a853]/5"}`
            : `flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? "border-[#d4a853]/60 bg-[#d4a853]/10" : "border-border hover:border-[#d4a853]/30 hover:bg-[#d4a853]/5"}`
          }
        >
          {uploading.length > 0
            ? <Loader2 className={`shrink-0 animate-spin text-[#d4a853] ${compact ? "h-3.5 w-3.5" : "h-6 w-6"}`} />
            : <Upload className={`shrink-0 text-muted-foreground ${compact ? "h-3.5 w-3.5" : "h-6 w-6"}`} />
          }
          {compact ? (
            <span className="text-xs text-muted-foreground">
              {uploading.length > 0 ? `Uploading ${uploading.join(", ")}…` : label}
            </span>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">All file types supported · Up to 5 GB per file</p>
              {uploading.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-[#d4a853]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading {uploading.join(", ")}…
                </div>
              )}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition-colors hover:bg-card"
            >
              <span className="text-xl leading-none">{fileIcon(file.mime_type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {file.size ? formatFileSize(file.size) : ""}
                  {file.size && file.created_at ? " · " : ""}
                  {file.created_at ? new Date(file.created_at).toLocaleDateString() : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleDownload(file)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(file)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    {deletingId === file.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <X className="h-3.5 w-3.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && readOnly && (
        <div className="flex flex-col items-center justify-center py-10">
          <File className="mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No files uploaded yet</p>
        </div>
      )}
    </div>
  );
}
