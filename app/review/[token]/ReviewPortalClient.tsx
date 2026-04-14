"use client";

import { useEffect, useRef, useState } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Download,
  CheckCircle2, Circle, MessageSquare, Send, X, Package,
  Clock, Film, Check, ThumbsUp, AlertCircle, ChevronDown,
  Star, Loader2, ArrowRight,
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
  { key: "pre",        label: "Pre-Production", statuses: ["draft", "planning"] },
  { key: "production", label: "Production",      statuses: ["active", "shooting"] },
  { key: "post",       label: "Post-Production", statuses: ["review", "editing"] },
  { key: "delivery",  label: "Delivered",        statuses: ["delivered", "completed"] },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_review:            { label: "Awaiting Your Review", color: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  revisions_requested:  { label: "Changes Requested",    color: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  approved:             { label: "Approved ✓",           color: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  final:                { label: "Final Delivery",        color: "bg-purple-500/15 text-purple-300 border border-purple-500/30" },
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
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Approve Confirmation Modal ────────────────────────────────────────────────

function ApproveModal({
  revision,
  clientName,
  token,
  onSuccess,
  onClose,
}: {
  revision: Revision;
  clientName: string;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleApprove() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", revision_id: revision.id }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1800);
    } catch {
      setSubmitting(false);
      alert("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden">
        {done ? (
          <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Approved!</p>
              <p className="mt-1 text-sm text-zinc-400">Your production team has been notified.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
                  <ThumbsUp className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="font-semibold text-white">Approve this cut</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-xs text-zinc-500">v{revision.version_number}</span>
                  <span className="text-sm font-semibold text-white">{revision.title}</span>
                </div>
                <p className="text-xs text-zinc-500">Uploaded {formatDate(revision.created_at)}</p>
              </div>

              <p className="text-sm leading-relaxed text-zinc-400">
                By approving, you confirm that <span className="text-white font-medium">{revision.title}</span> meets your requirements. Your production team will be notified immediately and will prepare the final delivery.
              </p>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3">
                <p className="text-xs text-emerald-400">
                  <span className="font-semibold">This action cannot be undone.</span> Once approved, the revision is locked and the team proceeds to final delivery.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 border-t border-white/[0.07] px-5 py-4">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-60 transition-all active:scale-[0.98]"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><ThumbsUp className="h-4 w-4" /> Approve Cut</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Request Changes Modal ─────────────────────────────────────────────────────

function RequestChangesModal({
  revision,
  token,
  onSuccess,
  onClose,
}: {
  revision: Revision;
  token: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  async function handleSubmit() {
    if (!feedback.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/review/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_changes", revision_id: revision.id, feedback: feedback.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch {
      setSubmitting(false);
      alert("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden">
        {done ? (
          <div className="flex flex-col items-center gap-4 px-8 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15 ring-1 ring-sky-500/30">
              <Send className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">Feedback sent!</p>
              <p className="mt-1 text-sm text-zinc-400">Your production team will review your notes and get to work.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10">
                  <AlertCircle className="h-4 w-4 text-sky-400" />
                </div>
                <p className="font-semibold text-white">Request changes</p>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <span className="font-mono text-xs text-zinc-500">v{revision.version_number}</span>
                <span className="ml-2 text-sm font-semibold text-white">{revision.title}</span>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  What needs to change?
                </label>
                <textarea
                  ref={textareaRef}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Be as specific as possible — timecodes, scenes, wording changes, colour notes. Your team will see this exactly as you write it."
                  rows={6}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none leading-relaxed"
                />
                <p className="mt-1.5 text-right text-[11px] text-zinc-600">{feedback.length} / 3000</p>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed">
                Your feedback will be sent directly to your production team. They'll review your notes and reach out about next steps.
              </p>
            </div>

            <div className="flex gap-2.5 border-t border-white/[0.07] px-5 py-4">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !feedback.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-2.5 text-sm font-bold text-black hover:bg-[#c49843] disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {submitting
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Send className="h-3.5 w-3.5" /> Send Feedback</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────────────────────

export default function ReviewPortalClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);

  // Video player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Comment
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [noteTs, setNoteTs] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Action modals
  const [approveTarget, setApproveTarget] = useState<Revision | null>(null);
  const [changesTarget, setChangesTarget] = useState<Revision | null>(null);

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
        // Default to the first cut that needs review, else the latest
        const needsReview = d.revisions.find((r) => r.status === "in_review");
        setActiveRevisionId(needsReview?.id ?? d.revisions[0]?.id ?? null);
        fetch(`/api/review/${token}/deliverables`)
          .then((r) => r.ok ? r.json() : Promise.resolve([]))
          .then((rows: Deliverable[]) => setDeliverables(rows))
          .catch(() => {});
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
  const hasActionableRevision = revisions.some((r) => r.status === "in_review");

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
      alert("Couldn't submit your note. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    if ((video as any).webkitEnterFullscreen) {
      (video as any).webkitEnterFullscreen();
    } else if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => {});
    }
  }

  function captureTimestamp() {
    setNoteTs(videoRef.current ? Math.floor(videoRef.current.currentTime) : null);
    if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleDownload(revision: Revision) {
    if (!revision.file_url) return;
    try {
      const res = await fetch(revision.file_url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const ext = revision.file_type?.split("/")[1] ?? "mp4";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${revision.title}.${ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
  }

  function currentStageIndex(projectStatus: string) {
    return STAGES.findIndex((s) => s.statuses.includes(projectStatus));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070707]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/20" />
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
          </div>
          <p className="text-xs tracking-widest text-zinc-600 uppercase">Loading your project</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070707]">
        <div className="text-center max-w-sm px-6">
          <div className="mb-5 mx-auto h-14 w-14 rounded-2xl bg-zinc-900 border border-white/[0.06] flex items-center justify-center">
            <X className="h-6 w-6 text-zinc-600" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Link not found</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">{error ?? "This portal link may have expired or been revoked. Contact your production team."}</p>
        </div>
      </div>
    );
  }

  const { project, clientName } = data;
  const stageIdx = currentStageIndex(project.status);

  return (
    <>
      <div className="min-h-screen bg-[#070707] text-white">
        {/* ── Film grain overlay ── */}
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.035]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px", mixBlendMode: "overlay" }} />

        {/* ── Header ── */}
        <header className="sticky top-0 z-30 border-b border-white/[0.05] bg-[#070707]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
                <Film className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <span className="text-sm font-bold tracking-[0.15em] text-[#d4a853] uppercase">CineFlow</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600">Logged in as</p>
              <p className="text-sm font-semibold text-white">{clientName}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-5 py-10 space-y-10">

          {/* ── Hero ── */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d0d] px-6 py-7">
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-10 left-0 h-40 w-2/3 rounded-full bg-[#d4a853]/[0.04] blur-3xl" />
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Your Project</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{project.title}</h1>
            {project.client_name && (
              <p className="mt-1 text-sm font-medium text-[#d4a853]/70">{project.client_name}</p>
            )}
            {project.description && (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">{project.description}</p>
            )}
            {(project.shoot_date || project.due_date) && (
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {project.shoot_date && (
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <Clock className="h-3.5 w-3.5 text-[#d4a853]/60" />
                    Shoot date: <span className="text-zinc-300 font-medium">{formatDate(project.shoot_date)}</span>
                  </span>
                )}
                {project.due_date && (
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <Clock className="h-3.5 w-3.5 text-zinc-600" />
                    Delivery: <span className="text-zinc-300 font-medium">{formatDate(project.due_date)}</span>
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ── Production Timeline ── */}
          <section className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-6">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Production Status</p>
            <div className="flex items-center overflow-x-auto no-scrollbar pb-1">
              {STAGES.map((stage, i) => {
                const isActive = i === stageIdx;
                const isPast = i < stageIdx;
                return (
                  <div key={stage.key} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center flex-1 min-w-0 px-1">
                      <div className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 mb-2 transition-all ${
                        isPast ? "bg-[#d4a853] border-[#d4a853] shadow-[0_0_12px_rgba(212,168,83,0.35)]" :
                        isActive ? "border-[#d4a853] bg-[#d4a853]/10 shadow-[0_0_12px_rgba(212,168,83,0.2)]" :
                        "border-zinc-800 bg-transparent"
                      }`}>
                        {isPast
                          ? <Check className="h-3.5 w-3.5 text-black font-bold" strokeWidth={3} />
                          : isActive
                          ? <div className="h-2 w-2 rounded-full bg-[#d4a853] animate-pulse" />
                          : null
                        }
                      </div>
                      <span className={`text-[10px] text-center leading-tight ${
                        isPast ? "text-[#d4a853]/80 font-medium" :
                        isActive ? "text-white font-semibold" :
                        "text-zinc-700"
                      }`}>{stage.label}</span>
                    </div>
                    {i < STAGES.length - 1 && (
                      <div className={`h-px w-8 shrink-0 mx-1 transition-colors ${i < stageIdx ? "bg-[#d4a853]/40" : "bg-zinc-800"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Action Required Banner ── */}
          {hasActionableRevision && (
            <section className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-6 py-5">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
              <div className="flex items-start gap-4">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">Your review is needed</p>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {revisions.filter((r) => r.status === "in_review").length > 1
                      ? `${revisions.filter((r) => r.status === "in_review").length} cuts are waiting for your feedback.`
                      : "A cut is ready for your review. Watch it below and let the team know your thoughts."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const r = revisions.find((r) => r.status === "in_review");
                    if (r) setActiveRevisionId(r.id);
                    document.getElementById("cuts-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Review now <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </section>
          )}

          {/* ── Cuts ── */}
          <section id="cuts-section">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
              {revisions.length === 0 ? "Cuts" : `Cuts · ${revisions.length} version${revisions.length === 1 ? "" : "s"}`}
            </p>

            {revisions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0d0d0d] p-12 text-center">
                <Film className="mx-auto h-10 w-10 text-zinc-800 mb-3" />
                <p className="text-sm font-semibold text-zinc-500">Your first cut will appear here once it's ready.</p>
                <p className="mt-1 text-xs text-zinc-700">You'll receive an email notification when it's ready to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Version tabs if multiple */}
                {revisions.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {revisions.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setActiveRevisionId(r.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                          activeRevisionId === r.id
                            ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                            : "border-zinc-800 bg-[#0d0d0d] text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                        }`}
                      >
                        <span className="font-mono">v{r.version_number}</span>
                        <span>{r.title}</span>
                        {r.status === "in_review" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        {r.status === "approved" && (
                          <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {activeRevision && (
                  <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d0d0d]">
                    {/* Cut header */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-zinc-600">v{activeRevision.version_number}</span>
                          <span className="font-semibold text-white">{activeRevision.title}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_CONFIG[activeRevision.status]?.color ?? "bg-zinc-800/80 text-zinc-400"}`}>
                            {STATUS_CONFIG[activeRevision.status]?.label ?? activeRevision.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          {formatDate(activeRevision.created_at)}
                          {activeRevision.file_size ? ` · ${formatFileSize(activeRevision.file_size)}` : ""}
                        </p>
                      </div>
                      {(activeRevision.status === "approved" || activeRevision.status === "final") && activeRevision.file_url && (
                        <button
                          onClick={() => handleDownload(activeRevision)}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#d4a853] px-3.5 py-2 text-xs font-bold text-black hover:bg-[#c49843] transition-colors active:scale-95"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      )}
                    </div>

                    {/* Video player */}
                    {activeRevision.file_url && (
                      <div className="relative bg-black">
                        <video
                          ref={videoRef}
                          src={activeRevision.file_url}
                          playsInline
                          preload="metadata"
                          className="mx-auto block w-full"
                          style={{ maxHeight: "60vh", objectFit: "contain" }}
                          onClick={() => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); }}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                        />

                        {/* Big play overlay */}
                        {!isPlaying && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => videoRef.current?.play()}
                              className="pointer-events-auto flex h-18 w-18 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/20 backdrop-blur-sm transition-transform active:scale-95 h-16 w-16"
                            >
                              <Play className="h-7 w-7 translate-x-0.5 text-white" />
                            </button>
                          </div>
                        )}

                        {/* Controls */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-4 pb-3 pt-12">
                          {/* Scrubber */}
                          <div className="mb-2.5">
                            <div
                              className="relative h-1 w-full cursor-pointer rounded-full bg-white/15"
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
                              {/* Comment dots */}
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
                                  <div className="h-3 w-3 rounded-full bg-white/80 ring-1 ring-black/40 transition-transform group-hover/dot:scale-150" />
                                  <div className="pointer-events-none invisible absolute bottom-full left-1/2 mb-3 w-max max-w-[200px] -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900/98 px-3 py-2 shadow-xl group-hover/dot:visible z-50">
                                    <span className="block font-mono text-[10px] text-[#d4a853] mb-0.5">{formatTime(c.timestamp_seconds ?? 0)}</span>
                                    <span className="block text-[11px] leading-snug text-white/90">{c.content}</span>
                                  </div>
                                </button>
                              ))}
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); }} className="rounded-lg p-2 text-white/80 hover:bg-white/10 transition-colors">
                                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </button>
                              <button onClick={() => { const n = !isMuted; setIsMuted(n); if (videoRef.current) videoRef.current.muted = n; }} className="rounded-lg p-2 text-white/80 hover:bg-white/10 transition-colors">
                                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                              </button>
                              <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                                onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setIsMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                                className="h-1 w-16 cursor-pointer accent-[#d4a853]"
                              />
                              <span className="ml-2 font-mono text-[11px] text-white/50">{formatTime(currentTime)} / {formatTime(duration)}</span>
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
                              <button onClick={handleFullscreen} className="rounded-lg p-2 text-white/80 hover:bg-white/10 transition-colors">
                                <Maximize className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Client Action CTAs ── */}
                    {activeRevision.status === "in_review" && (
                      <div className="border-t border-white/[0.06] bg-[#0a0a0a] px-5 py-5">
                        <p className="mb-1 text-sm font-semibold text-white">What's your verdict?</p>
                        <p className="mb-4 text-xs text-zinc-500">Watch the full cut above, then let the team know.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => setChangesTarget(activeRevision)}
                            className="flex flex-1 items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-white/[0.07] hover:text-white transition-all active:scale-[0.98]"
                          >
                            <AlertCircle className="h-4 w-4 text-sky-400 shrink-0" />
                            Request Changes
                          </button>
                          <button
                            onClick={() => setApproveTarget(activeRevision)}
                            className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-black hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(52,211,153,0.2)]"
                          >
                            <ThumbsUp className="h-4 w-4 shrink-0" />
                            Approve This Cut
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approved state */}
                    {activeRevision.status === "approved" && (
                      <div className="border-t border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                            <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-emerald-300">Cut approved</p>
                            <p className="text-xs text-zinc-500">Your production team has been notified and is preparing final delivery.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Final delivery state */}
                    {activeRevision.status === "final" && activeRevision.file_url && (
                      <div className="border-t border-purple-500/20 bg-purple-500/[0.04] px-5 py-5">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/15">
                            <Star className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-white">Final delivery is ready</p>
                            <p className="mt-0.5 text-xs text-zinc-500">Your file is ready to download.</p>
                          </div>
                          <button
                            onClick={() => handleDownload(activeRevision)}
                            className="flex shrink-0 items-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#c49843] transition-colors"
                          >
                            <Download className="h-4 w-4" /> Download Final
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    <div className="px-5 py-5 space-y-5 border-t border-white/[0.05]">
                      {activeRevision.comments.length > 0 && (
                        <div>
                          <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Notes ({activeRevision.comments.length})
                          </h4>
                          <div className="space-y-2.5">
                            {activeRevision.comments.map((c) => (
                              <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                <div className="mb-1 flex items-center gap-2.5">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[9px] font-bold text-zinc-400">
                                    {(c.author_name ?? "T")[0].toUpperCase()}
                                  </div>
                                  <span className="text-xs font-semibold text-zinc-300">{c.author_name ?? "Team"}</span>
                                  {c.timestamp_seconds != null && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const t = c.timestamp_seconds!;
                                        setCurrentTime(t);
                                        if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); }
                                        setIsPlaying(true);
                                      }}
                                      className="font-mono text-[10px] text-[#d4a853] hover:underline"
                                    >
                                      {formatTime(c.timestamp_seconds)}
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{c.content}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add note */}
                      <div>
                        <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Leave a note</h4>
                        {noteTs !== null && (
                          <div className="mb-2.5 flex items-center gap-2">
                            <div className="flex items-center gap-1.5 rounded-full border border-[#d4a853]/25 bg-[#d4a853]/10 px-3 py-1 text-xs font-semibold text-[#d4a853]">
                              <Clock className="h-3 w-3" /> Stamped at {formatTime(noteTs)}
                            </div>
                            <button type="button" onClick={() => setNoteTs(null)} className="text-zinc-600 hover:text-zinc-400">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2.5 items-end">
                          <textarea
                            ref={textareaRef}
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder="Share your thoughts — be as specific as you like…"
                            rows={3}
                            className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:border-[#d4a853]/30 focus:outline-none leading-relaxed"
                          />
                          <button
                            type="button"
                            disabled={!commentDraft.trim() || submittingComment}
                            onClick={handleSubmitComment}
                            className="mb-0.5 shrink-0 rounded-xl bg-zinc-800 p-3 text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-40 transition-all active:scale-95"
                          >
                            {submittingComment
                              ? <span className="block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
                              : <Send className="h-4 w-4" />
                            }
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-zinc-700">
                          Press <span className="text-zinc-500">Note · {formatTime(currentTime)}</span> in the player to attach a timecode to your note.
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
            <section className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] p-6">
              <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                <Package className="h-3.5 w-3.5 text-[#d4a853]/60" /> Deliverables
              </p>
              <div className="space-y-2.5">
                {deliverables.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    {d.done
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      : <Circle className="h-4 w-4 shrink-0 text-zinc-700" />}
                    <span className={`flex-1 text-sm ${d.done ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{d.label}</span>
                    {d.done && <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">Ready</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="mt-16 border-t border-white/[0.04] py-8 text-center">
          <p className="text-xs text-zinc-800">Powered by <span className="text-[#d4a853]/40 font-semibold">CineFlow</span></p>
        </footer>
      </div>

      {/* ── Modals ── */}
      {approveTarget && (
        <ApproveModal
          revision={approveTarget}
          clientName={clientName}
          token={token}
          onSuccess={() => {
            setRevisions((prev) => prev.map((r) => r.id === approveTarget.id ? { ...r, status: "approved" } : r));
          }}
          onClose={() => setApproveTarget(null)}
        />
      )}
      {changesTarget && (
        <RequestChangesModal
          revision={changesTarget}
          token={token}
          onSuccess={() => {
            setRevisions((prev) => prev.map((r) => r.id === changesTarget.id ? { ...r, status: "revisions_requested" } : r));
          }}
          onClose={() => setChangesTarget(null)}
        />
      )}
    </>
  );
}
