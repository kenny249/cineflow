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

function canPreviewFile(mime?: string, name?: string): "pdf" | "image" | "text" | null {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (mime?.includes("pdf") || ext === "pdf") return "pdf";
  if (mime?.includes("image") || ["png","jpg","jpeg","gif","webp"].includes(ext ?? "")) return "image";
  if (mime?.includes("text") || ["txt","fountain","fdx"].includes(ext ?? "")) return "text";
  return null;
}

function PreviewModal({ file, onClose }: { file: ProjectFile; onClose: () => void }) {
  const kind = canPreviewFile(file.mime_type, file.name);
  const url = file.public_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <File className="h-4 w-4 shrink-0 text-[#d4a853]" />
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{file.name}</p>
          {url && (
            <button
              onClick={() => window.open(url, "_blank")}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {kind === "pdf" && url && (
            <iframe src={url} className="h-full w-full bg-white" title={file.name} />
          )}
          {kind === "image" && url && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          )}
          {kind === "text" && url && <TextPreview url={url} />}
          {!kind && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <File className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="mt-1 text-xs text-muted-foreground">Download to open this file.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useState(() => {
    fetch(url, { cache: "no-store" })
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText("(Could not load)"))
      .finally(() => setLoading(false));
  });
  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
    </div>
  );
  return (
    <div className="h-full overflow-y-auto p-6">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">{text}</pre>
    </div>
  );
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
  const [previewFile, setPreviewFile] = useState<ProjectFile | null>(null);

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
      let url = file.public_url;
      if (!url) {
        const client = createClient();
        const { data, error } = await client.storage.from("project-files").createSignedUrl(file.storage_path, 3600);
        if (error) throw error;
        url = data.signedUrl;
      }
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("Could not download file");
    }
  }

  return (
    <>
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
              onClick={() => canPreviewFile(file.mime_type, file.name) ? setPreviewFile(file) : handleDownload(file)}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 transition-colors hover:bg-card hover:border-[#d4a853]/30"
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
              <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(file); }}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {!readOnly && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(file); }}
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
    {previewFile && <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </>
  );
}
