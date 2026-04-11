"use client";

import { useEffect, useRef, useState } from "react";
import {
  Film,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  MessageSquare,
  X,
  Trash2,
  Upload,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjects,
  getProjectRevisions,
  createRevision,
  updateRevision,
  deleteRevision,
  createRevisionComment,
  deleteRevisionComment,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { Project, Revision, RevisionStatus } from "@/types";


const STATUS_CONFIG: Record<RevisionStatus, { label: string; color: string; description: string }> = {
  draft: {
    label: "Draft",
    color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    description: "Internal only — not ready for client",
  },
  in_review: {
    label: "In Review",
    color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    description: "Sent to client, awaiting feedback",
  },
  revisions_requested: {
    label: "Revisions Requested",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    description: "Client has left notes",
  },
  approved: {
    label: "Approved",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    description: "Client signed off",
  },
  final: {
    label: "Final",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    description: "Delivered and archived",
  },
};

const ALL_STATUSES: RevisionStatus[] = [
  "draft",
  "in_review",
  "revisions_requested",
  "approved",
  "final",
];

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatRelative(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RevisionsPage() {
  // ── Project / revision data ─────────────────────────────────────────────────
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");

  // ── Upload form ─────────────────────────────────────────────────────────────
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Comment form ────────────────────────────────────────────────────────────
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  // ── Revision ops ────────────────────────────────────────────────────────────
  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // ── Video player ────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // ── Load projects ───────────────────────────────────────────────────────────
  useEffect(() => {
    getProjects()
      .then((data) => {
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      })
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoadingProjects(false));
  }, []);

  // ── Load revisions when project changes ─────────────────────────────────────
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoadingRevisions(true);
    setRevisions([]);
    setActiveRevisionId(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setPlayerDuration(0);
    getProjectRevisions(selectedProjectId)
      .then(setRevisions)
      .catch(() => toast.error("Failed to load revisions"))
      .finally(() => setLoadingRevisions(false));
  }, [selectedProjectId]);

  // ── Reset player state when switching active revision ───────────────────────
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setPlayerDuration(0);
  }, [activeRevisionId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeRevision = revisions.find((r) => r.id === activeRevisionId);

  const filteredProjects = projectSearch.trim()
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
          p.client_name?.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects;

  // ── Upload handler ──────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !selectedProjectId) {
      toast.error("Please choose a video file");
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    const timer = setInterval(
      () => setUploadProgress((p) => Math.min(p + Math.random() * 18, 85)),
      400
    );

    try {
      const supabase = createClient();

      const sanitized = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${selectedProjectId}/revisions/${Date.now()}_${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, uploadFile, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(uploadError.message || JSON.stringify(uploadError));
      }

      const { data: urlData } = supabase.storage
        .from("project-files")
        .getPublicUrl(storagePath);

      const versionNumber = revisions.length + 1;
      const fallbackTitle = uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, "");
      const created = await createRevision({
        project_id: selectedProjectId,
        title: fallbackTitle,
        description: uploadDescription.trim() || undefined,
        status: "draft",
        version_number: versionNumber,
        file_url: urlData.publicUrl,
        file_type: uploadFile.type || "video/mp4",
        file_size: uploadFile.size,
      });

      clearInterval(timer);
      setUploadProgress(100);
      setRevisions((prev) => [created, ...prev]);
      setActiveRevisionId(created.id);
      setShowUploadForm(false);
      setUploadTitle("");
      setUploadDescription("");
      setUploadFile(null);
      toast.success(`v${versionNumber} uploaded`);
    } catch (err: unknown) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Upload failed";
      if (msg.toLowerCase().includes("maximum allowed size") || msg.toLowerCase().includes("payload too large")) {
        toast.error("File too large — increase the upload limit in your Supabase dashboard under Storage → Configuration");
      } else {
        toast.error(msg);
      }
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  }

  // ── Delete revision ─────────────────────────────────────────────────────────
  async function handleDeleteRevision(revision: Revision) {
    if (deletingRevisionId) return;
    setDeletingRevisionId(revision.id);
    try {
      if (revision.file_url) {
        const supabase = createClient();
        const url = new URL(revision.file_url);
        const parts = url.pathname.split("/project-files/");
        if (parts.length > 1) {
          await supabase.storage.from("project-files").remove([decodeURIComponent(parts[1])]);
        }
      }
      await deleteRevision(revision.id);
      setRevisions((prev) => prev.filter((r) => r.id !== revision.id));
      if (activeRevisionId === revision.id) setActiveRevisionId(null);
      toast.success("Revision deleted");
    } catch {
      toast.error("Failed to delete revision");
    } finally {
      setDeletingRevisionId(null);
    }
  }

  // ── Update status ────────────────────────────────────────────────────────────
  async function handleUpdateStatus(revision: Revision, status: RevisionStatus) {
    if (updatingStatusId) return;
    setUpdatingStatusId(revision.id);
    // Optimistic update
    setRevisions((prev) =>
      prev.map((r) => (r.id === revision.id ? { ...r, status } : r))
    );
    try {
      await updateRevision(revision.id, { status });
      toast.success(STATUS_CONFIG[status].label);
    } catch {
      // Revert
      setRevisions((prev) =>
        prev.map((r) => (r.id === revision.id ? { ...r, status: revision.status } : r))
      );
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatusId(null);
    }
  }

  // ── Add comment ──────────────────────────────────────────────────────────────
  async function handleAddComment() {
    if (!commentDraft.trim() || !activeRevision) return;
    setSavingComment(true);
    try {
      const created = await createRevisionComment({
        revision_id: activeRevision.id,
        content: commentDraft.trim(),
        timestamp_seconds: videoRef.current
          ? Math.floor(videoRef.current.currentTime)
          : undefined,
        author_name: "You",
      });
      setRevisions((prev) =>
        prev.map((r) =>
          r.id === activeRevision.id
            ? {
                ...r,
                comments: [...(r.comments ?? []), created].sort(
                  (a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
                ),
              }
            : r
        )
      );
      setCommentDraft("");
    } catch {
      toast.error("Failed to save comment");
    } finally {
      setSavingComment(false);
    }
  }

  // ── Delete comment ───────────────────────────────────────────────────────────
  async function handleDeleteComment(revisionId: string, commentId: string) {
    setDeletingCommentId(commentId);
    try {
      await deleteRevisionComment(commentId);
      setRevisions((prev) =>
        prev.map((r) =>
          r.id === revisionId
            ? { ...r, comments: r.comments?.filter((c) => c.id !== commentId) }
            : r
        )
      );
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* ── Page header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Film className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">
            Revisions
          </h1>
          {selectedProject && (
            <span className="hidden sm:inline text-sm text-muted-foreground">
              ·{" "}
              <span className="text-foreground font-medium">
                {selectedProject.client_name
                  ? `${selectedProject.client_name} — `
                  : ""}
                {selectedProject.title}
              </span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({revisions.length} revision{revisions.length === 1 ? "" : "s"})
              </span>
            </span>
          )}
        </div>
        {selectedProject && (
          <button
            onClick={() => setShowUploadForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#c49843]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload revision
          </button>
        )}
      </div>

      {/* ── Upload form panel ── */}
      {showUploadForm && selectedProject && (
        <form
          onSubmit={handleUpload}
          className="shrink-0 border-b border-border bg-card/60 px-5 py-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              New revision for{" "}
              <span className="text-[#d4a853]">{selectedProject.title}</span>
            </p>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Title (optional — defaults to filename)"
              className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
            />
            <input
              type="text"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Notes (optional)"
              className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground transition-colors hover:border-[#d4a853]/40 hover:text-foreground"
            >
              {uploadFile ? uploadFile.name : "Choose video file…"}
            </button>
            {uploadFile && (
              <span className="text-xs text-muted-foreground">
                {formatFileSize(uploadFile.size)}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#d4a853] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
              )}
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#c49843] disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border sm:flex overflow-hidden">
          <div className="border-b border-border px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5">
            {loadingProjects ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No projects found
              </p>
            ) : (
              filteredProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    project.id === selectedProjectId
                      ? "bg-[#d4a853]/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      project.id === selectedProjectId
                        ? "bg-[#d4a853]"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium leading-tight">
                      {project.title}
                    </p>
                    {project.client_name && (
                      <p className="truncate text-[10px] text-muted-foreground">
                        {project.client_name}
                      </p>
                    )}
                  </div>
                  {project.id === selectedProjectId && revisions.length > 0 && (
                    <span className="shrink-0 rounded-full bg-[#d4a853]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#d4a853]">
                      {revisions.length}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {!selectedProjectId ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Film className="mb-4 h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm font-semibold text-foreground">Select a project</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a project from the sidebar to view its revisions
              </p>
            </div>
          ) : loadingRevisions ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border">
                <Film className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  No revisions yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a cut for{" "}
                  <span className="text-foreground">{selectedProject?.title}</span> to
                  start reviewing
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUploadForm(true);
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#c49843]"
              >
                <Upload className="h-4 w-4" />
                Upload first revision
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {revisions.map((revision) => {
                const isActive = activeRevisionId === revision.id;
                const comments = revision.comments ?? [];
                const statusCfg =
                  STATUS_CONFIG[revision.status] ?? STATUS_CONFIG.draft;

                return (
                  <div key={revision.id}>
                    {/* ── Revision row ── */}
                    <div
                      className="flex cursor-pointer items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/10"
                      onClick={() =>
                        setActiveRevisionId(isActive ? null : revision.id)
                      }
                    >
                      {/* Version badge */}
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-muted-foreground">
                        v{revision.version_number}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {revision.title}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}
                          >
                            {statusCfg.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          {revision.file_size != null && (
                            <span>{formatFileSize(revision.file_size)}</span>
                          )}
                          <span>·</span>
                          <span>{formatRelative(revision.created_at)}</span>
                          {comments.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-3 w-3" />
                                {comments.length}
                              </span>
                            </>
                          )}
                          {revision.description && (
                            <>
                              <span>·</span>
                              <span className="italic">{revision.description}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRevision(revision);
                          }}
                          disabled={deletingRevisionId === revision.id}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                          title="Delete revision"
                        >
                          {deletingRevisionId === revision.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                            isActive ? "rotate-90" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {/* ── Expanded player + controls ── */}
                    {isActive && (
                      <div className="border-t border-border bg-card/30">
                        {revision.file_url ? (
                          <>
                            {/* Video player */}
                            <div className="w-full bg-black flex justify-center">
                              <div className="relative">
                              <video
                                ref={videoRef}
                                src={revision.file_url}
                                className="block max-w-full max-h-[52vh]"
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                onTimeUpdate={(e) =>
                                  setCurrentTime(e.currentTarget.currentTime)
                                }
                                onLoadedMetadata={(e) =>
                                  setPlayerDuration(e.currentTarget.duration)
                                }
                              />

                              {/* Controls overlay */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10">
                                {/* Scrubber */}
                                <div className="mb-2.5 flex items-center gap-2">
                                  <div className="relative flex-1 group">
                                    {/* Track */}
                                    <div
                                      className="relative h-1 cursor-pointer rounded-full bg-white/20"
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const t = ((e.clientX - rect.left) / rect.width) * (playerDuration || 0);
                                        setCurrentTime(t);
                                        if (videoRef.current) videoRef.current.currentTime = t;
                                      }}
                                    >
                                      {/* Filled portion */}
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full bg-[#d4a853]"
                                        style={{ width: `${playerDuration ? (currentTime / playerDuration) * 100 : 0}%` }}
                                      />
                                      {/* Comment markers */}
                                      {playerDuration > 0 && comments.map((c) => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const t = c.timestamp_seconds ?? 0;
                                            setCurrentTime(t);
                                            if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); }
                                            setIsPlaying(true);
                                          }}
                                          className="group/dot absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                                          style={{ left: `${((c.timestamp_seconds ?? 0) / playerDuration) * 100}%` }}
                                        >
                                          <div className="h-[11px] w-[11px] rounded-full ring-2 ring-black/60 transition-transform group-hover/dot:scale-150 dot-silver-shimmer" />
                                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max max-w-[180px] rounded-lg bg-zinc-900/95 border border-white/10 px-2.5 py-1.5 invisible group-hover/dot:visible z-50 shadow-lg">
                                            <span className="block font-mono text-[10px] text-[#d4a853] mb-0.5">{formatTime(c.timestamp_seconds ?? 0)}</span>
                                            <span className="block text-[11px] leading-snug text-white/90">{c.content}</span>
                                          </div>
                                        </button>
                                      ))}
                                      {/* Thumb */}
                                      <div
                                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#d4a853] shadow ring-2 ring-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{ left: `${playerDuration ? (currentTime / playerDuration) * 100 : 0}%` }}
                                      />
                                      {/* Hidden range input for drag support */}
                                      <input
                                        type="range"
                                        min={0}
                                        max={playerDuration || 0}
                                        step={0.1}
                                        value={currentTime}
                                        onChange={(e) => {
                                          const t = parseFloat(e.target.value);
                                          setCurrentTime(t);
                                          if (videoRef.current) videoRef.current.currentTime = t;
                                        }}
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                      />
                                    </div>
                                  </div>
                                  <span className="font-mono text-[11px] text-white/70">
                                    {formatTime(currentTime)} /{" "}
                                    {formatTime(playerDuration)}
                                  </span>
                                </div>

                                {/* Controls row */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      onClick={() => {
                                        if (!videoRef.current) return;
                                        if (isPlaying) videoRef.current.pause();
                                        else videoRef.current.play();
                                      }}
                                      className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
                                    >
                                      {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const next = !isMuted;
                                        setIsMuted(next);
                                        if (videoRef.current)
                                          videoRef.current.muted = next;
                                      }}
                                      className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
                                    >
                                      {isMuted ? (
                                        <VolumeX className="h-4 w-4" />
                                      ) : (
                                        <Volume2 className="h-4 w-4" />
                                      )}
                                    </button>
                                    <input
                                      type="range"
                                      min={0}
                                      max={1}
                                      step={0.05}
                                      value={isMuted ? 0 : volume}
                                      onChange={(e) => {
                                        const v = parseFloat(e.target.value);
                                        setVolume(v);
                                        setIsMuted(v === 0);
                                        if (videoRef.current) {
                                          videoRef.current.volume = v;
                                          videoRef.current.muted = v === 0;
                                        }
                                      }}
                                      className="h-1 w-20 cursor-pointer accent-[#d4a853]"
                                    />
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    {revision.file_url && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!revision.file_url) return;
                                          try {
                                            toast.loading("Preparing download…", { id: "dl" });
                                            const res = await fetch(revision.file_url);
                                            if (!res.ok) throw new Error("Fetch failed");
                                            const blob = await res.blob();
                                            const ext = revision.file_type?.split("/")[1] ?? "mp4";
                                            const filename = `${revision.title ?? "revision"}.${ext}`;
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = filename;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                            toast.success("Download saved", { id: "dl" });
                                          } catch {
                                            toast.error("Download failed — try again", { id: "dl" });
                                          }
                                        }}
                                        className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
                                        title="Download"
                                      >
                                        <Download className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        videoRef.current?.requestFullscreen()
                                      }
                                      className="rounded-lg p-2 text-white transition-colors hover:bg-white/15"
                                      title="Fullscreen"
                                    >
                                      <Maximize className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              </div>
                            </div>

                            {/* Status + comments */}
                            <div className="px-5 py-4 space-y-4">
                              {/* Status controls */}
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  Status:
                                </span>
                                {ALL_STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    onClick={() =>
                                      handleUpdateStatus(revision, s)
                                    }
                                    disabled={
                                      revision.status === s ||
                                      updatingStatusId === revision.id
                                    }
                                    title={STATUS_CONFIG[s].description}
                                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      revision.status === s
                                        ? STATUS_CONFIG[s].color
                                        : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {updatingStatusId === revision.id &&
                                    revision.status !== s ? (
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    ) : null}
                                    {STATUS_CONFIG[s].label}
                                  </button>
                                ))}
                              </div>

                              {/* Timestamp comments */}
                              <div>
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  Timestamp notes ({comments.length})
                                </p>

                                {comments.length > 0 && (
                                  <div className="mb-3 space-y-1.5">
                                    {comments.map((comment) => (
                                      <div
                                        key={comment.id}
                                        className="group flex items-start gap-3 rounded-xl bg-muted/30 px-3 py-2.5"
                                      >
                                        <button
                                          onClick={() => {
                                            if (!videoRef.current) return;
                                            videoRef.current.currentTime =
                                              comment.timestamp_seconds ?? 0;
                                            videoRef.current.play();
                                            setIsPlaying(true);
                                          }}
                                          className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-[#d4a853]"
                                          title="Seek to this timestamp"
                                        >
                                          {formatTime(
                                            comment.timestamp_seconds ?? 0
                                          )}
                                        </button>
                                        <p className="flex-1 text-xs leading-relaxed text-foreground">
                                          {comment.content}
                                        </p>
                                        <button
                                          onClick={() =>
                                            handleDeleteComment(
                                              revision.id,
                                              comment.id
                                            )
                                          }
                                          disabled={
                                            deletingCommentId === comment.id
                                          }
                                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:text-red-400 disabled:opacity-50"
                                        >
                                          {deletingCommentId === comment.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <X className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Add comment */}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={commentDraft}
                                    onChange={(e) =>
                                      setCommentDraft(e.target.value)
                                    }
                                    placeholder={`Note at ${formatTime(currentTime)}…`}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleAddComment();
                                    }}
                                    className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
                                  />
                                  <button
                                    onClick={handleAddComment}
                                    disabled={
                                      savingComment || !commentDraft.trim()
                                    }
                                    className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#c49843] disabled:opacity-50"
                                  >
                                    {savingComment ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      "Add"
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                            Video file is no longer available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

