"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Download,
  CheckCircle2, Circle, MessageSquare, Send, X, Package,
  Clock, Film, Check,
} from "lucide-react";

interface Comment {
  id: string;
  content: string;
  timestamp_seconds: number | null;
  author_name?: string;
  created_at: string;
}

interface Revision {
  id: string;
  title: string;
  version_number: number;
  status: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  comments: Comment[];
}

interface Deliverable {
  id: string;
  label: string;
  done: boolean;
}

interface Project {
  id: string;
  title: string;
  description?: string;
  client_name?: string;
  status: string;
  shoot_date?: string;
  due_date?: string;
  thumbnail_url?: string;
}

interface PortalData {
  project: Project;
  revisions: Revision[];
  clientName: string;
  clientEmail: string;
  tokenId: string;
}

const STAGES = [
  { key: "pre", label: "Pre-Production", statuses: ["draft"] },
  { key: "production", label: "Production", statuses: ["active"] },
  { key: "post", label: "Post-Production", statuses: ["review"] },
  { key: "delivery", label: "Delivered", statuses: ["delivered", "completed"] },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_review: { label: "In Review", color: "bg-sky-500/10 text-sky-400 border border-sky-500/20" },
  revisions_requested: { label: "Revisions Requested", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  final: { label: "Final", color: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReviewPortalClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  // Player state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Comment state
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [noteTs, setNoteTs] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Deliverables
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Invalid link");
        }
        return res.json();
      })
      .then((d: PortalData) => {
        setData(d);
        setRevisions(d.revisions);
        if (d.revisions.length > 0) setActiveRevisionId(d.revisions[0].id);
        // Load deliverables from localStorage (set by team in portal tab)
        try {
          const raw = localStorage.getItem(`cf_deliverables_${d.project.id}`);
          if (raw) setDeliverables(JSON.parse(raw));
        } catch {}
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    setDuration(0);
  }, [activeRevisionId]);

  const activeRevision = revisions.find((r) => r.id === activeRevisionId) ?? null;

  async function handleSubmitComment() {
    if (!activeRevision || !commentDraft.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision_id: activeRevision.id,
          content: commentDraft.trim(),
          timestamp_seconds: noteTs,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      const { comment } = await res.json();
      setRevisions((prev) =>
        prev.map((r) =>
          r.id === activeRevision.id
            ? { ...r, status: r.status === "in_review" ? "revisions_requested" : r.status, comments: [...r.comments, comment] }
            : r
        )
      );
      setCommentDraft(""); setNoteTs(null);
    } catch {
      alert("Couldn't submit your note — please try again.");
    } finally {
      setSubmittingComment(false);
    }
  }

  function captureTimestamp() {
    setNoteTs(videoRef.current ? Math.floor(videoRef.current.currentTime) : null);
    if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleDownload() {
    if (!activeRevision?.file_url) return;
    try {
      const res = await fetch(activeRevision.file_url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const ext = activeRevision.file_type?.split("/")[1] ?? "mp4";
      const filename = `${activeRevision.title}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed — please try again.");
    }
  }

  function currentStageIndex(projectStatus: string) {
    return STAGES.findIndex((s) => s.statuses.includes(projectStatus));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
          <p className="text-xs text-zinc-500">Loading your project…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080808]">
        <div className="text-center max-w-sm px-6">
          <div className="mb-4 mx-auto h-12 w-12 rounded-full bg-zinc-900 flex items-center justify-center">
            <X className="h-5 w-5 text-zinc-500" />
          </div>
          <h1 className="text-lg font-semibold text-white mb-2">Link not found</h1>
          <p className="text-sm text-zinc-500">{error ?? "This portal link may have expired or been revoked. Contact your production team."}</p>
        </div>
      </div>
    );
  }

  const { project, clientName } = data;
  const stageIdx = currentStageIndex(project.status);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#080808]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
          <span className="text-sm font-bold tracking-widest text-[#d4a853] uppercase">CineFlow</span>
          <div className="text-right">
            <p className="text-xs text-zinc-400">Welcome back,</p>
            <p className="text-sm font-medium text-white">{clientName}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-8">
        {/* ── Project title ── */}
        <section>
          <p className="text-[11px] uppercase tracking-widest text-zinc-600 mb-1">Your Project</p>
          <h1 className="text-2xl font-bold tracking-tight text-white">{project.title}</h1>
          {project.client_name && <p className="text-sm text-zinc-500 mt-1">{project.client_name}</p>}
          {project.description && <p className="mt-2 text-sm text-zinc-400 leading-relaxed max-w-xl">{project.description}</p>}
        </section>

        {/* ── Production Stage Timeline ── */}
        <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">Production Status</h2>
          <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
            {STAGES.map((stage, i) => {
              const isActive = i === stageIdx;
              const isPast = i < stageIdx;
              return (
                <div key={stage.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center flex-1 min-w-0">
                    <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 mb-1.5 transition-all ${
                      isPast ? "bg-[#d4a853] border-[#d4a853]" :
                      isActive ? "border-[#d4a853] bg-[#d4a853]/10" :
                      "border-zinc-700 bg-transparent"
                    }`}>
                      {isPast
                        ? <Check className="h-3 w-3 text-black" />
                        : isActive
                        ? <div className="h-2 w-2 rounded-full bg-[#d4a853] animate-pulse" />
                        : null
                      }
                    </div>
                    <span className={`text-[10px] text-center leading-tight whitespace-nowrap ${
                      isPast ? "text-[#d4a853]" : isActive ? "text-white font-semibold" : "text-zinc-600"
                    }`}>{stage.label}</span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={`h-px flex-1 mx-2 min-w-[16px] transition-colors ${i < stageIdx ? "bg-[#d4a853]/60" : "bg-zinc-800"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
            {project.shoot_date && (
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-[#d4a853]" /> Shoot: {formatDate(project.shoot_date)}</span>
            )}
            {project.due_date && (
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-zinc-600" /> Est. Delivery: {formatDate(project.due_date)}</span>
            )}
          </div>
        </section>

        {/* ── Revisions ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">Revisions</h2>
          {revisions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
              <Film className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">Your first cut will appear here once it's ready for review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Revision picker if multiple */}
              {revisions.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {revisions.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRevisionId(r.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        activeRevisionId === r.id
                          ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      v{r.version_number} — {r.title}
                    </button>
                  ))}
                </div>
              )}

              {activeRevision && (
                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-900/50">
                  {/* Revision header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-500">v{activeRevision.version_number}</span>
                        <span className="text-sm font-semibold text-white">{activeRevision.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[activeRevision.status]?.color ?? "bg-zinc-800 text-zinc-400"}`}>
                          {STATUS_CONFIG[activeRevision.status]?.label ?? activeRevision.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {formatDate(activeRevision.created_at)}
                        {activeRevision.file_size ? ` · ${formatFileSize(activeRevision.file_size)}` : ""}
                      </p>
                    </div>
                    {(activeRevision.status === "approved" || activeRevision.status === "final") && activeRevision.file_url && (
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#c49843] transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                    )}
                  </div>

                  {/* Video player */}
                  {activeRevision.file_url && (
                    <div className="relative bg-black overflow-hidden">
                      <div className="relative w-full">
                        <video
                          ref={videoRef}
                          src={activeRevision.file_url}
                          playsInline
                          preload="metadata"
                          className="mx-auto block w-full"
                          style={{ maxHeight: "62vh", objectFit: "contain" }}
                          onClick={() => { if (!videoRef.current) return; if (isPlaying) videoRef.current.pause(); else videoRef.current.play(); }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        />
                        {/* Big play overlay — shows when paused */}
                        {!isPlaying && (
                          <button
                            type="button"
                            onClick={() => videoRef.current?.play()}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                          >
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm ring-1 ring-white/20">
                              <Play className="h-7 w-7 translate-x-0.5 text-white" />
                            </div>
                          </button>
                        )}
                        {/* Controls overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10">
                          {/* Scrubber */}
                          <div className="mb-2.5 flex items-center gap-2">
                            <div className="relative flex-1 group">
                              <div
                                className="relative h-1 rounded-full bg-white/20 cursor-pointer"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const t = ((e.clientX - rect.left) / rect.width) * (duration || 0);
                                  setCurrentTime(t);
                                  if (videoRef.current) videoRef.current.currentTime = t;
                                }}
                              >
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full bg-[#d4a853]"
                                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                                {/* Timestamp comment dots */}
                                {duration > 0 && activeRevision.comments.map((c) => (
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
                                    style={{ left: `${((c.timestamp_seconds ?? 0) / duration) * 100}%` }}
                                  >
                                    <div className="h-[11px] w-[11px] rounded-full ring-2 ring-black/60 transition-transform group-hover/dot:scale-150 dot-silver-shimmer" />
                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-max max-w-[180px] rounded-lg bg-zinc-900/95 border border-white/10 px-2.5 py-1.5 invisible group-hover/dot:visible z-50 shadow-lg">
                                      <span className="block font-mono text-[10px] text-[#d4a853] mb-0.5">{formatTime(c.timestamp_seconds ?? 0)}</span>
                                      <span className="block text-[11px] leading-snug text-white/90">{c.content}</span>
                                    </div>
                                  </button>
                                ))}
                                <div
                                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-[#d4a853] shadow ring-2 ring-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                                />
                                <input
                                  type="range" min={0} max={duration || 0} step={0.1} value={currentTime}
                                  onChange={(e) => {
                                    const t = parseFloat(e.target.value);
                                    setCurrentTime(t);
                                    if (videoRef.current) videoRef.current.currentTime = t;
                                  }}
                                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                              </div>
                            </div>
                            <span className="font-mono text-[11px] text-white/70">{formatTime(currentTime)} / {formatTime(duration)}</span>
                          </div>
                          {/* Buttons row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => { if (!videoRef.current) return; if (isPlaying) videoRef.current.pause(); else videoRef.current.play(); }} className="rounded-lg p-2 text-white hover:bg-white/15 transition-colors">
                                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </button>
                              <button onClick={() => { const n = !isMuted; setIsMuted(n); if (videoRef.current) videoRef.current.muted = n; }} className="rounded-lg p-2 text-white hover:bg-white/15 transition-colors">
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </button>
                              <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setIsMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                                className="h-1 w-20 cursor-pointer accent-[#d4a853]"
                              />
                            </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={captureTimestamp}
                                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 transition-colors active:scale-95"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Note · {formatTime(currentTime)}
                              </button>
                              <button onClick={() => videoRef.current?.requestFullscreen()} className="rounded-lg p-2 text-white hover:bg-white/15 transition-colors">
                                <Maximize className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Comments section */}
                  <div className="px-5 py-4 space-y-4">
                    {/* Existing comments */}
                    {activeRevision.comments.length > 0 && (
                      <div>
                        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          <MessageSquare className="h-3.5 w-3.5" /> Notes ({activeRevision.comments.length})
                        </h4>
                        <div className="space-y-2">
                          {activeRevision.comments.map((c) => (
                            <div key={c.id} className="flex gap-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium text-white">{c.author_name ?? "Team"}</span>
                                  {c.timestamp_seconds != null && (
                                    <button
                                      type="button"
                                      className="font-mono text-[10px] text-[#d4a853] hover:underline"
                                      onClick={() => {
                                        const t = c.timestamp_seconds!;
                                        setCurrentTime(t);
                                        if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); }
                                        setIsPlaying(true);
                                      }}
                                    >
                                      {formatTime(c.timestamp_seconds)}
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-300 leading-snug">{c.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add comment */}
                    <div className="space-y-2.5">
                      <h4 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Leave a note</h4>
                      {/* Timestamp badge */}
                      {noteTs !== null && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 px-2.5 py-1 text-xs font-medium text-[#d4a853]">
                            <Clock className="h-3 w-3" /> Stamped at {formatTime(noteTs)}
                          </div>
                          <button type="button" onClick={() => setNoteTs(null)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2.5 items-end">
                        <textarea
                          ref={textareaRef}
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          placeholder="Share your thoughts on this cut…"
                          rows={3}
                          className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none leading-relaxed"
                        />
                        <button
                          type="button"
                          disabled={!commentDraft.trim() || submittingComment}
                          onClick={handleSubmitComment}
                          className="shrink-0 mb-0.5 rounded-xl bg-[#d4a853] p-3 text-black hover:bg-[#c49843] disabled:opacity-40 transition-all active:scale-95"
                        >
                          {submittingComment
                            ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                            : <Send className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        Tap <span className="text-zinc-400 font-medium">Note · {formatTime(currentTime)}</span> in the player to stamp a timestamp on your note.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Deliverables ── */}
        {deliverables.length > 0 && (
          <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/50 p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              <Package className="h-3.5 w-3.5 text-[#d4a853]" /> Deliverables
            </h2>
            <div className="space-y-2">
              {deliverables.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5">
                  {d.done
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    : <Circle className="h-4 w-4 shrink-0 text-zinc-600" />}
                  <span className={`text-sm ${d.done ? "line-through text-zinc-500" : "text-zinc-200"}`}>{d.label}</span>
                  {d.done && <span className="ml-auto text-[10px] text-emerald-400 font-medium">Ready</span>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="mt-16 border-t border-white/[0.05] py-8 text-center">
        <p className="text-xs text-zinc-700">Powered by <span className="text-[#d4a853]/60">CineFlow</span></p>
      </footer>
    </div>
  );
}
