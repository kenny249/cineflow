"use client";

import { useEffect, useState } from "react";
import { ScrollText, Search, Film, FileText, Download, Eye, X, FolderKanban } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getProjects } from "@/lib/supabase/queries";
import { formatFileSize } from "@/lib/utils";
import type { Project, ProjectFile } from "@/types";

interface ScriptFile extends ProjectFile {
  projectTitle?: string;
  projectId?: string;
}

function fileTypeLabel(mime?: string, name?: string): string {
  const ext = name?.split(".").pop()?.toLowerCase();
  if (mime?.includes("pdf") || ext === "pdf") return "PDF";
  if (ext === "fdx") return "Final Draft";
  if (ext === "fountain") return "Fountain";
  if (ext === "txt") return "Text";
  if (ext === "rtf") return "RTF";
  if (mime?.includes("word") || ext === "docx" || ext === "doc") return "Word";
  return "Script";
}

function canPreview(mime?: string, name?: string): boolean {
  const ext = name?.split(".").pop()?.toLowerCase();
  return !!(mime?.includes("pdf") || ext === "pdf" || mime?.includes("image") || ["png","jpg","jpeg","gif","webp"].includes(ext ?? ""));
}

function isTextFile(mime?: string, name?: string): boolean {
  const ext = name?.split(".").pop()?.toLowerCase();
  return !!(mime?.includes("text") || ["txt","fountain"].includes(ext ?? ""));
}

function FileTypeTag({ mime, name }: { mime?: string; name?: string }) {
  const label = fileTypeLabel(mime, name);
  const colorMap: Record<string, string> = {
    PDF: "bg-red-500/10 text-red-400",
    "Final Draft": "bg-blue-500/10 text-blue-400",
    Fountain: "bg-purple-500/10 text-purple-400",
    Text: "bg-muted/50 text-muted-foreground",
    RTF: "bg-muted/50 text-muted-foreground",
    Word: "bg-blue-600/10 text-blue-400",
    Script: "bg-muted/50 text-muted-foreground",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorMap[label] ?? "bg-muted/50 text-muted-foreground"}`}>
      {label}
    </span>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────────

function PreviewModal({ file, onClose }: { file: ScriptFile; onClose: () => void }) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const ext = file.name?.split(".").pop()?.toLowerCase();
  const isPdf = file.mime_type?.includes("pdf") || ext === "pdf";
  const isImg = file.mime_type?.includes("image") || ["png","jpg","jpeg","gif","webp"].includes(ext ?? "");
  const isText = isTextFile(file.mime_type, file.name);
  const url = file.public_url;

  useEffect(() => {
    if (isText && url && !textContent) {
      setLoadingText(true);
      fetch(url, { cache: "no-store" })
        .then((r) => r.text())
        .then(setTextContent)
        .catch(() => setTextContent("(Could not load file content)"))
        .finally(() => setLoadingText(false));
    }
  }, [isText, url]);

  async function handleDownload() {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-[#d4a853]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
            {file.projectTitle && (
              <p className="truncate text-[11px] text-muted-foreground">{file.projectTitle}</p>
            )}
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isPdf && url && (
            <iframe src={url} className="h-full w-full bg-white" title={file.name} />
          )}
          {isImg && url && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain" />
            </div>
          )}
          {isText && (
            <div className="h-full overflow-y-auto p-6">
              {loadingText ? (
                <div className="flex items-center justify-center py-20">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground">{textContent}</pre>
              )}
            </div>
          )}
          {!isPdf && !isImg && !isText && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-foreground">Preview not available</p>
                <p className="mt-1 text-xs text-muted-foreground">Download the file to open it.</p>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScriptsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<ScriptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ScriptFile | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const projs = await getProjects();
        setProjects(projs);

        if (projs.length === 0) { setLoading(false); return; }

        const projectIds = projs.map((p) => p.id);
        const { data } = await supabase
          .from("project_files")
          .select("*")
          .in("project_id", projectIds)
          .eq("tab", "scripts")
          .neq("name", "script.fountain")
          .order("created_at", { ascending: false });

        const projectMap = Object.fromEntries(projs.map((p) => [p.id, p]));
        const enriched: ScriptFile[] = (data ?? []).map((f) => ({
          ...f,
          projectTitle: projectMap[f.project_id]?.title,
          projectId: f.project_id,
        }));
        setFiles(enriched);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = files.filter((f) => {
    const q = search.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.projectTitle ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <ScrollText className="h-4 w-4 text-[#d4a853]" />
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Scripts</h1>
            {!loading && files.length > 0 && (
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">{files.length}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="border-b border-border px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scripts or projects…"
                className="w-full rounded-lg border border-border bg-muted/30 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
              />
            </div>
          </div>

          {/* File list */}
          <div className="px-4 py-3 space-y-1.5">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
              </div>
            )}

            {!loading && filtered.length === 0 && files.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <ScrollText className="h-10 w-10 text-muted-foreground/20" />
                <div>
                  <p className="font-display font-semibold text-foreground">No scripts yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Upload scripts from the Scripts tab inside any project.</p>
                </div>
                {projects.length > 0 && (
                  <Link
                    href={`/projects/${projects[0].id}?tab=scripts`}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Go to {projects[0].title}
                  </Link>
                )}
              </div>
            )}

            {!loading && filtered.length === 0 && files.length > 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Film className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
              </div>
            )}

            {filtered.map((file) => (
              <div
                key={file.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-[#d4a853]/30 hover:bg-card"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <FileTypeTag mime={file.mime_type} name={file.name} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {file.projectTitle && (
                      <>
                        <FolderKanban className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.projectTitle}</span>
                        <span className="text-muted-foreground/30">·</span>
                      </>
                    )}
                    {file.size ? <span>{formatFileSize(file.size)}</span> : null}
                    {file.created_at && (
                      <span>{new Date(file.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(canPreview(file.mime_type, file.name) || isTextFile(file.mime_type, file.name)) && (
                    <button
                      onClick={() => setPreview(file)}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!file.public_url) return;
                      try {
                        const res = await fetch(file.public_url);
                        const blob = await res.blob();
                        const objectUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = objectUrl;
                        a.download = file.name;
                        a.click();
                        URL.revokeObjectURL(objectUrl);
                      } catch {
                        window.open(file.public_url, "_blank");
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  {file.projectId && (
                    <Link
                      href={`/projects/${file.projectId}?tab=scripts`}
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <FolderKanban className="h-3.5 w-3.5" />
                      Project
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
