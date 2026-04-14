"use client";

import { useEffect, useRef, useState } from "react";
import {
  Film, Play, Pause, Volume2, VolumeX, Maximize, Download,
  MessageSquare, X, Trash2, Upload, Search, Loader2,
  Copy, Check, Send, ChevronDown, ExternalLink, Rocket,
  Users, AlertCircle, CheckCircle2, Clock, Eye, Plus,
  ArrowRight, Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjects,
  getProjectRevisions,
  createRevision,
  updateRevision,
  updateProject,
  deleteRevision,
  createRevisionComment,
  deleteRevisionComment,
  getProjectReviewToken,
  createReviewToken,
  getClientContacts,
  type ClientContact,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { Project, Revision, RevisionStatus, ReviewToken } from "@/types";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RevisionStatus, { label: string; color: string; dot: string; description: string }> = {
  draft:               { label: "In House",         color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",         dot: "bg-zinc-500",    description: "Internal review" },
  in_review:           { label: "With Client",      color: "bg-amber-500/10 text-amber-400 border-amber-500/20",      dot: "bg-amber-400",   description: "Awaiting client feedback" },
  revisions_requested: { label: "Revision Needed",  color: "bg-sky-500/10 text-sky-400 border-sky-500/20",            dot: "bg-sky-400",     description: "Client left feedback" },
  approved:            { label: "Approved",         color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-400", description: "Client signed off" },
  final:               { label: "Delivered",        color: "bg-purple-500/10 text-purple-400 border-purple-500/20",   dot: "bg-purple-400",  description: "Project complete" },
};

const ALL_STATUSES: RevisionStatus[] = ["draft", "in_review", "revisions_requested", "approved", "final"];

const PIPELINE: { status: RevisionStatus; icon: React.FC<{ className?: string }> }[] = [
  { status: "draft",               icon: Layers },
  { status: "in_review",           icon: Eye },
  { status: "revisions_requested", icon: AlertCircle },
  { status: "approved",            icon: CheckCircle2 },
  { status: "final",               icon: Film },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Deploy Modal ──────────────────────────────────────────────────────────────

function DeployModal({
  revision,
  project,
  portalToken,
  clients,
  onDeployed,
  onClose,
}: {
  revision: Revision;
  project: Project;
  portalToken: ReviewToken | null;
  clients: ClientContact[];
  onDeployed: (token: ReviewToken) => void;
  onClose: () => void;
}) {
  // CRM auto-fill: find a contact matching the project's client name
  const crmMatch = clients.find(
    (c) => c.client_name.toLowerCase() === (project.client_name ?? "").toLowerCase()
  );
  const [step, setStep] = useState<"setup" | "compose">(portalToken ? "compose" : "setup");
  const [clientName, setClientName] = useState(portalToken?.client_name ?? project.client_name ?? "");
  const [clientEmail, setClientEmail] = useState(portalToken?.client_email ?? crmMatch?.email ?? "");
  const crmAutoFilled = !portalToken && !!crmMatch?.email;
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (step === "setup" && (!clientName.trim() || !clientEmail.trim())) {
      toast.error("Client name and email are required");
      return;
    }
    setSending(true);
    try {
      let token = portalToken;

      // Step 1: Create portal token if first time
      if (!token) {
        token = await createReviewToken({
          project_id: project.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
        });
        // Send portal_live email
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "portal_live",
            clientName: token.client_name,
            clientEmail: token.client_email,
            projectTitle: project.title,
            portalUrl: `${window.location.origin}/review/${token.token}`,
          }),
        });
      }

      // Step 2: Update revision to in_review
      await updateRevision(revision.id, { status: "in_review" });

      // Step 3: Send revision_ready email
      const portalUrl = `${window.location.origin}/review/${token.token}`;
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "revision_ready",
          clientName: token.client_name,
          clientEmail: token.client_email,
          projectTitle: project.title,
          revisionTitle: revision.title + (note.trim() ? `\n\n${note.trim()}` : ""),
          versionNumber: revision.version_number,
          portalUrl,
        }),
      });

      onDeployed(token);
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy");
      setSending(false);
    }
  }

  const portalPreviewUrl = portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/review/${portalToken.token}`
    : null;

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#d4a853]/10 ring-1 ring-[#d4a853]/30 shadow-[0_0_30px_rgba(212,168,83,0.15)]">
            <Rocket className="h-7 w-7 text-[#d4a853]" />
          </div>
          <p className="text-lg font-bold text-white">Deployed to client</p>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="text-white font-medium">{portalToken?.client_name ?? clientName}</span> has been notified by email.
          </p>
          <button
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-white/[0.07] py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/[0.1] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4a853]/10 border border-[#d4a853]/20">
              <Rocket className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <p className="font-semibold text-white">Deploy to Client</p>
              <p className="text-[11px] text-zinc-500">
                v{revision.version_number} · {revision.title}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Client info */}
          {step === "setup" ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Client details</p>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none"
              />
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Client email"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-[#d4a853]/40 focus:outline-none"
              />
              {crmAutoFilled && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                  <Check className="h-3 w-3" />
                  Auto-filled from your Clients
                </p>
              )}
              {!crmAutoFilled && clients.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Quick select from CRM</p>
                  <div className="flex flex-wrap gap-1.5">
                    {clients.slice(0, 5).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClientName(c.client_name); if (c.email) setClientEmail(c.email); }}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 hover:border-[#d4a853]/30 hover:text-[#d4a853] transition-colors"
                      >
                        {c.client_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => { if (clientName.trim() && clientEmail.trim()) setStep("compose"); }}
                disabled={!clientName.trim() || !clientEmail.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4a853]/10 border border-[#d4a853]/20 py-2.5 text-sm font-semibold text-[#d4a853] hover:bg-[#d4a853]/15 disabled:opacity-40 transition-colors"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Client confirmation */}
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
                  {(portalToken?.client_name ?? clientName)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{portalToken?.client_name ?? clientName}</p>
                  <p className="text-xs text-zinc-500">{portalToken?.client_email ?? clientEmail}</p>
                </div>
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              </div>

              {/* Personal note */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Add a personal note <span className="normal-case font-normal text-zinc-700">(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`Hi ${(portalToken?.client_name ?? clientName).split(" ")[0]}, here's the latest cut — would love your thoughts on the pacing in the second half.`}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-zinc-700 focus:border-[#d4a853]/30 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Email preview card */}
              <div className="rounded-xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                <div className="border-b border-white/[0.05] px-4 py-2.5 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-zinc-700" />
                  <p className="text-[11px] text-zinc-600">Email preview</p>
                </div>
                <div className="px-4 py-3.5 space-y-1.5">
                  <p className="text-[11px] text-zinc-600">
                    <span className="text-zinc-500 font-medium">To:</span> {portalToken?.client_email ?? clientEmail}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    <span className="text-zinc-500 font-medium">Subject:</span>{" "}
                    <span className="text-zinc-400">{project.title} — Your cut is ready to review</span>
                  </p>
                  <div className="mt-2 pt-2 border-t border-white/[0.05]">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Hi {(portalToken?.client_name ?? clientName).split(" ")[0]}, a new revision of <span className="text-zinc-300 font-medium">{project.title}</span> is ready for your feedback
                      {note.trim() ? ` — ${note.slice(0, 60)}${note.length > 60 ? "…" : ""}` : "."}
                    </p>
                  </div>
                  {portalPreviewUrl && (
                    <a
                      href={portalPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-[11px] text-[#d4a853]/60 hover:text-[#d4a853] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Preview portal link
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === "compose" && (
          <div className="flex gap-2.5 border-t border-white/[0.07] px-5 py-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-zinc-500 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-2.5 text-sm font-bold text-black hover:bg-[#c49843] disabled:opacity-60 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(212,168,83,0.2)]"
            >
              {sending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Rocket className="h-4 w-4" /> Send to Client</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RevisionCard ─────────────────────────────────────────────────────────────

function RevisionCard({
  revision,
  isActive,
  onSelect,
  onDeploy,
  onUpdateStatus,
  updatingStatusId,
}: {
  revision: Revision;
  isActive: boolean;
  onSelect: () => void;
  onDeploy: () => void;
  onUpdateStatus: (s: RevisionStatus) => void;
  updatingStatusId: string | null;
}) {
  const thumbRef = useRef<HTMLVideoElement>(null);
  const [thumbDuration, setThumbDuration] = useState(0);
  const cfg = STATUS_CONFIG[revision.status as RevisionStatus] ?? STATUS_CONFIG.draft;
  const commentCount = revision.comments?.length ?? 0;

  return (
    <div className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all cursor-pointer ${
      isActive ? "border-[#d4a853]/60 shadow-[0_0_0_1px_rgba(212,168,83,0.2)]" : "border-border hover:border-border/80"
    }`}>
      {/* Thumbnail / scrub zone */}
      <div
        className="relative aspect-video overflow-hidden bg-zinc-900/80 select-none"
        onClick={onSelect}
        onMouseMove={(e) => {
          const el = thumbRef.current;
          if (!el || !thumbDuration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          el.currentTime = Math.max(0, Math.min(pct * thumbDuration, thumbDuration - 0.1));
        }}
        onMouseLeave={() => {
          if (thumbRef.current && thumbDuration) thumbRef.current.currentTime = thumbDuration * 0.1;
        }}
      >
        {revision.file_url ? (
          <video
            ref={thumbRef}
            src={revision.file_url}
            muted
            preload="metadata"
            playsInline
            className="h-full w-full object-cover"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setThumbDuration(v.duration);
              v.currentTime = v.duration * 0.1;
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Film className="h-10 w-10 text-white/20" />
          </div>
        )}

        {/* Duration badge */}
        {thumbDuration > 0 && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur-sm">
            {formatTime(thumbDuration)}
          </div>
        )}

        {/* Status dot */}
        <div className="absolute left-2 top-2">
          <span className={`inline-block h-2 w-2 rounded-full ring-1 ring-black/30 ${cfg.dot}`} />
        </div>

        {/* Comment count */}
        {commentCount > 0 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
            <MessageSquare className="h-2.5 w-2.5" />
            {commentCount}
          </div>
        )}

        {/* Hover scrub hint gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Active ring */}
        {isActive && (
          <div className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[#d4a853]/70" />
        )}
      </div>

      {/* Card footer */}
      <div className="space-y-2 bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-foreground">{revision.title}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              <span className="font-mono">v{revision.version_number}</span>
              <span>·</span>
              <span>{formatRelative(revision.created_at)}</span>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {revision.status === "draft" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeploy(); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#c49843]"
          >
            <Rocket className="h-3.5 w-3.5" /> Send for Review
          </button>
        )}
        {revision.status === "revisions_requested" && (
          <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-2">
            <p className="text-[11px] font-semibold text-sky-400">Client left feedback — upload a revision</p>
          </div>
        )}
        {revision.status === "approved" && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus("final"); }}
            disabled={updatingStatusId === revision.id}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/[0.1] disabled:opacity-60"
          >
            {updatingStatusId === revision.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><CheckCircle2 className="h-3.5 w-3.5" /> Mark as Final</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  // Read ?project= deep-link after mount (avoids Suspense requirement)
  const deepLinkProjectId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project")
      : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(deepLinkProjectId);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RevisionStatus | "all">("all");
  const [clients, setClients] = useState<ClientContact[]>([]);

  // Upload
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments
  const [commentDraft, setCommentDraft] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deletingRevisionId, setDeletingRevisionId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Portal token
  const [portalToken, setPortalToken] = useState<ReviewToken | null>(null);
  const [copiedPortal, setCopiedPortal] = useState(false);

  // Deploy modal
  const [deployTarget, setDeployTarget] = useState<Revision | null>(null);

  // Video player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Load projects + CRM contacts
  useEffect(() => {
    getProjects()
      .then((data) => {
        setProjects(data);
        // Only auto-select first project if no deep-link was provided
        if (!deepLinkProjectId && data.length > 0) setSelectedProjectId(data[0].id);
      })
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoadingProjects(false));
    getClientContacts().then(setClients).catch(() => {});
  }, [deepLinkProjectId]);

  // Load revisions
  useEffect(() => {
    if (!selectedProjectId) return;
    setLoadingRevisions(true);
    setRevisions([]);
    setActiveRevisionId(null);
    setCurrentTime(0); setIsPlaying(false); setPlayerDuration(0);
    setStatusFilter("all");
    getProjectRevisions(selectedProjectId)
      .then(setRevisions)
      .catch(() => toast.error("Failed to load cuts"))
      .finally(() => setLoadingRevisions(false));
  }, [selectedProjectId]);

  // Reset player on revision switch
  useEffect(() => {
    setCurrentTime(0); setIsPlaying(false); setPlayerDuration(0);
  }, [activeRevisionId]);

  // Fetch portal token
  useEffect(() => {
    if (!selectedProjectId) { setPortalToken(null); return; }
    getProjectReviewToken(selectedProjectId).then((t) => setPortalToken(t));
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeRevision = revisions.find((r) => r.id === activeRevisionId);

  const filteredProjects = projectSearch.trim()
    ? projects.filter((p) =>
        p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(projectSearch.toLowerCase())
      )
    : projects;

  const displayedRevisions = statusFilter === "all"
    ? revisions
    : revisions.filter((r) => r.status === statusFilter);

  // Pipeline counts across selected project
  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = revisions.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<RevisionStatus, number>);

  const portalUrl = portalToken
    ? `${typeof window !== "undefined" ? window.location.origin : "https://www.usecineflow.com"}/review/${portalToken.token}`
    : null;

  // Upload
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !selectedProjectId) { toast.error("Choose a video file"); return; }
    setUploading(true); setUploadProgress(0);
    const timer = setInterval(() => setUploadProgress((p) => Math.min(p + Math.random() * 18, 85)), 400);
    try {
      const supabase = createClient();
      const sanitized = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${selectedProjectId}/revisions/${Date.now()}_${sanitized}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(storagePath, uploadFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("project-files").getPublicUrl(storagePath);
      const versionNumber = revisions.length + 1;
      const created = await createRevision({
        project_id: selectedProjectId,
        title: uploadTitle.trim() || uploadFile.name.replace(/\.[^/.]+$/, ""),
        status: "draft",
        version_number: versionNumber,
        file_url: urlData.publicUrl,
        file_type: uploadFile.type || "video/mp4",
        file_size: uploadFile.size,
      });
      clearInterval(timer); setUploadProgress(100);
      setRevisions((prev) => [created, ...prev]);
      setActiveRevisionId(created.id);
      setShowUploadForm(false); setUploadTitle(""); setUploadFile(null);
      toast.success(`v${versionNumber} uploaded`);
    } catch (err) {
      clearInterval(timer);
      const msg = err instanceof Error ? err.message : "Upload failed";
      if (msg.toLowerCase().includes("maximum allowed size") || msg.toLowerCase().includes("payload too large")) {
        toast.error("File too large — increase limit in Supabase Storage settings");
      } else {
        toast.error(msg);
      }
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 500);
    }
  }

  // Delete revision
  async function handleDeleteRevision(revision: Revision) {
    if (deletingRevisionId) return;
    if (!confirm(`Delete "${revision.title}"? This cannot be undone.`)) return;
    setDeletingRevisionId(revision.id);
    try {
      if (revision.file_url) {
        const supabase = createClient();
        const url = new URL(revision.file_url);
        const parts = url.pathname.split("/project-files/");
        if (parts.length > 1) await supabase.storage.from("project-files").remove([decodeURIComponent(parts[1])]);
      }
      await deleteRevision(revision.id);
      setRevisions((prev) => prev.filter((r) => r.id !== revision.id));
      if (activeRevisionId === revision.id) setActiveRevisionId(null);
      toast.success("Revision deleted");
    } catch { toast.error("Failed to delete revision"); }
    finally { setDeletingRevisionId(null); }
  }

  // Update status — with project status auto-sync
  async function handleUpdateStatus(revision: Revision, status: RevisionStatus) {
    if (updatingStatusId) return;
    setUpdatingStatusId(revision.id);
    setRevisions((prev) => prev.map((r) => r.id === revision.id ? { ...r, status } : r));
    try {
      await updateRevision(revision.id, { status });
      toast.success(STATUS_CONFIG[status].label);

      // Auto-sync project status
      if (selectedProjectId) {
        if (status === "final") {
          // Revision finalised → mark project as delivered
          updateProject(selectedProjectId, { status: "delivered" }).catch(() => {});
        } else if (status === "approved") {
          // Client approved → project still in post, but mark active
          updateProject(selectedProjectId, { status: "active" }).catch(() => {});
        }
      }

      // If marking final, send final delivery email
      if (status === "final" && portalToken) {
        fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "final_delivery",
            clientName: portalToken.client_name,
            clientEmail: portalToken.client_email,
            projectTitle: selectedProject?.title ?? "",
            portalUrl: `${window.location.origin}/review/${portalToken.token}`,
          }),
        });
      }
    } catch {
      setRevisions((prev) => prev.map((r) => r.id === revision.id ? { ...r, status: revision.status } : r));
      toast.error("Failed to update status");
    } finally { setUpdatingStatusId(null); }
  }

  // Comments
  async function handleAddComment() {
    if (!commentDraft.trim() || !activeRevision) return;
    setSavingComment(true);
    try {
      const created = await createRevisionComment({
        revision_id: activeRevision.id,
        content: commentDraft.trim(),
        timestamp_seconds: videoRef.current ? Math.floor(videoRef.current.currentTime) : undefined,
        author_name: "You",
      });
      setRevisions((prev) =>
        prev.map((r) => r.id === activeRevision.id
          ? { ...r, comments: [...(r.comments ?? []), created].sort((a, b) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)) }
          : r
        )
      );
      setCommentDraft("");
      // Auto-resume playback after posting
      if (videoRef.current) videoRef.current.play();
    } catch { toast.error("Failed to save comment"); }
    finally { setSavingComment(false); }
  }

  async function handleDeleteComment(revisionId: string, commentId: string) {
    setDeletingCommentId(commentId);
    try {
      await deleteRevisionComment(commentId);
      setRevisions((prev) =>
        prev.map((r) => r.id === revisionId ? { ...r, comments: r.comments?.filter((c) => c.id !== commentId) } : r)
      );
    } catch { toast.error("Failed to delete comment"); }
    finally { setDeletingCommentId(null); }
  }

  async function handleCopyPortal() {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopiedPortal(true);
      toast.success("Portal link copied");
      setTimeout(() => setCopiedPortal(false), 2500);
    } catch { toast.error("Couldn't copy"); }
  }

  return (
    <>
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Film className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Review</h1>
          {selectedProject && (
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className="text-border">·</span>
              <span className="font-medium text-foreground">{selectedProject.title}</span>
              {selectedProject.client_name && (
                <span className="text-muted-foreground/60">· {selectedProject.client_name}</span>
              )}
            </span>
          )}
        </div>
        {selectedProject && (
          <button
            onClick={() => setShowUploadForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload Cut</span>
            <span className="sm:hidden">Upload</span>
          </button>
        )}
      </div>

      {/* ── Pipeline bar ── */}
      {selectedProject && revisions.length > 0 && (
        <div className="shrink-0 border-b border-border bg-card/40 px-4 py-2.5">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter("all")}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              All
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{revisions.length}</span>
            </button>
            {PIPELINE.map(({ status }) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === status
                    ? `${STATUS_CONFIG[status].color} border`
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[status].dot}`} />
                {STATUS_CONFIG[status].label}
                {statusCounts[status] > 0 && (
                  <span className="rounded-full bg-muted/80 px-1.5 text-[10px]">{statusCounts[status]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile project selector (hidden on sm+, sidebar handles it) ── */}
      {!loadingProjects && projects.length > 0 && (
        <div className="flex sm:hidden shrink-0 overflow-x-auto no-scrollbar gap-2 px-4 py-2.5 border-b border-border bg-card/30">
          {projects.map((project) => {
            const isSelected = project.id === selectedProjectId;
            const projRevisions = project.id === selectedProjectId ? revisions : [];
            const pending = projRevisions.filter((r) => r.status === "in_review" || r.status === "revisions_requested").length;
            return (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-[#d4a853]/10 text-[#d4a853] ring-[0.5px] ring-[#d4a853]/20"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-[#d4a853]" : "bg-muted-foreground/30"}`} />
                <span className="max-w-[130px] truncate">{project.title}</span>
                {pending > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-400">{pending}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Mobile portal status (shown inline on mobile when a portal is active) ── */}
      {selectedProject && portalToken && (
        <div className="flex sm:hidden shrink-0 items-center gap-2.5 border-b border-border bg-emerald-500/[0.03] px-4 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-400 font-medium">
            Portal live · {portalToken.client_name}
          </span>
          {portalToken.last_viewed_at && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Eye className="h-3 w-3" />
              {formatRelative(portalToken.last_viewed_at)}
            </span>
          )}
          <button
            onClick={handleCopyPortal}
            className="ml-1 flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedPortal ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Link</>}
          </button>
        </div>
      )}

      {/* ── Upload form ── */}
      {showUploadForm && selectedProject && (
        <form onSubmit={handleUpload} className="shrink-0 border-b border-border bg-card/60 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              New cut for <span className="text-[#d4a853]">{selectedProject.title}</span>
            </p>
            <button type="button" onClick={() => setShowUploadForm(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Cut title (defaults to filename)"
              className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
            />
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground transition-colors"
            >
              {uploadFile ? uploadFile.name : "Choose video…"}
            </button>
            <div className="ml-auto flex items-center gap-2">
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[#d4a853] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</span>
                </div>
              )}
              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Project sidebar ── */}
        <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border sm:flex overflow-hidden">
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
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No projects found</p>
            ) : (
              filteredProjects.map((project) => {
                const projRevisions = project.id === selectedProjectId ? revisions : [];
                const pending = projRevisions.filter((r) => r.status === "in_review" || r.status === "revisions_requested").length;
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      project.id === selectedProjectId
                        ? "bg-[#d4a853]/[0.07] ring-[0.5px] ring-[#d4a853]/15"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${project.id === selectedProjectId ? "bg-[#d4a853]" : "bg-muted-foreground/25"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-semibold ${project.id === selectedProjectId ? "text-foreground" : "text-muted-foreground"}`}>
                        {project.title}
                      </p>
                      {project.client_name && (
                        <p className="truncate text-[10px] text-muted-foreground/60">{project.client_name}</p>
                      )}
                    </div>
                    {pending > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">{pending}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Portal status */}
          {selectedProject && (
            <div className="shrink-0 border-t border-border p-3">
              {portalToken ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-xs font-semibold text-foreground">Portal live</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {portalToken.client_name} · {portalToken.client_email}
                  </p>
                  {portalToken.last_viewed_at && (
                    <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Last viewed {formatRelative(portalToken.last_viewed_at)}
                    </p>
                  )}
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleCopyPortal}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      {copiedPortal ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy link</>}
                    </button>
                    <a
                      href={portalUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-3 text-center">
                  <Users className="mx-auto h-4 w-4 text-muted-foreground/40 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground">No client portal yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">Deploy a cut to set one up</p>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ── Main content: asset grid ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selectedProject ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Film className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="font-display font-semibold text-muted-foreground">Select a project</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Choose a project from the sidebar to manage cuts</p>
              </div>
            </div>
          ) : loadingRevisions ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
                <Film className="h-7 w-7 text-muted-foreground/30" />
              </div>
              <div>
                <p className="font-display font-semibold text-foreground">No cuts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Upload your first cut to start the review process.</p>
              </div>
              <button
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] transition-colors"
              >
                <Upload className="h-4 w-4" /> Upload first cut
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {displayedRevisions.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">No cuts in this status</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {displayedRevisions.map((revision) => (
                    <RevisionCard
                      key={revision.id}
                      revision={revision}
                      isActive={revision.id === activeRevisionId}
                      onSelect={() => setActiveRevisionId(revision.id)}
                      onDeploy={() => setDeployTarget(revision)}
                      onUpdateStatus={(s) => handleUpdateStatus(revision, s)}
                      updatingStatusId={updatingStatusId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Player lightbox modal ── */}
    {activeRevision && (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setActiveRevisionId(null); }}
      >
        <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">

          {/* Modal header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground/60">v{activeRevision.version_number}</span>
              <span className="truncate font-semibold text-foreground">{activeRevision.title}</span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_CONFIG[activeRevision.status as RevisionStatus]?.color}`}>
                {STATUS_CONFIG[activeRevision.status as RevisionStatus]?.label}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {activeRevision.status === "draft" && (
                <button
                  onClick={() => setDeployTarget(activeRevision)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#c49843]"
                >
                  <Rocket className="h-3.5 w-3.5" /> Send for Review
                </button>
              )}
              <div className="relative">
                <select
                  value={activeRevision.status}
                  onChange={(e) => handleUpdateStatus(activeRevision, e.target.value as RevisionStatus)}
                  disabled={!!updatingStatusId}
                  className="appearance-none rounded-lg border border-border bg-muted/30 py-1.5 pl-2.5 pr-7 text-xs text-foreground focus:border-[#d4a853]/50 focus:outline-none cursor-pointer"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
              <button
                onClick={() => handleDeleteRevision(activeRevision)}
                disabled={!!deletingRevisionId}
                className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                {deletingRevisionId === activeRevision.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setActiveRevisionId(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Video player */}
            <div className="flex flex-[3] flex-col overflow-hidden bg-black">
              {activeRevision.file_url ? (
                <>
                  <div className="relative flex-1 overflow-hidden">
                    <video
                      ref={videoRef}
                      src={activeRevision.file_url}
                      playsInline
                      preload="metadata"
                      muted={isMuted}
                      className="mx-auto h-full w-full object-contain"
                      onClick={() => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setPlayerDuration(e.currentTarget.duration)}
                    />
                    {!isPlaying && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => videoRef.current?.play()}
                          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/50 ring-1 ring-white/20 backdrop-blur-sm transition-transform active:scale-95"
                        >
                          <Play className="h-6 w-6 translate-x-0.5 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Controls */}
                  <div className="shrink-0 space-y-2 bg-black px-4 pb-4 pt-3">
                    {/* Frame.io-style timeline with comment ticks */}
                    <div
                      className="group relative flex h-5 w-full cursor-pointer items-center"
                      onClick={(e) => {
                        if (!playerDuration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                        const t = pct * playerDuration;
                        setCurrentTime(t);
                        if (videoRef.current) videoRef.current.currentTime = t;
                      }}
                      onMouseMove={(e) => {
                        if (e.buttons !== 1 || !playerDuration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                        const t = pct * playerDuration;
                        setCurrentTime(t);
                        if (videoRef.current) videoRef.current.currentTime = t;
                      }}
                    >
                      {/* Track */}
                      <div className="relative h-[3px] w-full overflow-visible rounded-full bg-white/[0.12] transition-all group-hover:h-1">
                        {/* Filled */}
                        <div
                          className="h-full rounded-full bg-[#d4a853] transition-none"
                          style={{ width: `${playerDuration ? (currentTime / playerDuration) * 100 : 0}%` }}
                        />
                        {/* Comment tick marks — silver dots, clickable, with tooltip */}
                        {activeRevision.comments?.map((c) => {
                          if (c.timestamp_seconds == null || !playerDuration) return null;
                          const pct = (c.timestamp_seconds / playerDuration) * 100;
                          return (
                            <div
                              key={c.id}
                              className="group/tick absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                              style={{ left: `${pct}%` }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const t = c.timestamp_seconds!;
                                setCurrentTime(t);
                                if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); }
                                setIsPlaying(true);
                              }}
                            >
                              {/* Dot */}
                              <div className="h-2.5 w-2.5 rounded-full bg-white/60 ring-1 ring-white/20 shadow transition-all group-hover/tick:bg-white group-hover/tick:scale-125" />
                              {/* Tooltip */}
                              <div className="pointer-events-none absolute bottom-full left-1/2 mb-2.5 hidden -translate-x-1/2 group-hover/tick:block">
                                <div className="w-max max-w-[200px] rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 shadow-xl">
                                  <p className="text-[10px] font-semibold text-white/50">{c.author_name} · {formatTime(c.timestamp_seconds!)}</p>
                                  <p className="mt-0.5 truncate text-xs text-white">{c.content}</p>
                                </div>
                                <div className="mx-auto -mt-[5px] h-2 w-2 rotate-45 border-b border-r border-white/10 bg-zinc-900" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Playhead scrubber dot */}
                      <div
                        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-lg opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ left: `${playerDuration ? (currentTime / playerDuration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => { if (!videoRef.current) return; isPlaying ? videoRef.current.pause() : videoRef.current.play(); }} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10">
                          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button onClick={() => { const n = !isMuted; setIsMuted(n); if (videoRef.current) videoRef.current.muted = n; }} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <input type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume}
                          onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); setIsMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                          className="h-1 w-16 cursor-pointer accent-[#d4a853]"
                        />
                        <span className="ml-2 font-mono text-[11px] text-white/50">{formatTime(currentTime)} / {formatTime(playerDuration)}</span>
                      </div>
                      <button onClick={() => { const v = videoRef.current; if (!v) return; if ((v as any).webkitEnterFullscreen) (v as any).webkitEnterFullscreen(); else v.requestFullscreen?.().catch(() => {}); }} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10">
                        <Maximize className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <Film className="h-12 w-12 text-white/20" />
                </div>
              )}
            </div>

            {/* Notes panel */}
            <div className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-border">
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-5">
                {(activeRevision.comments?.length ?? 0) > 0 ? (() => {
                  const clientName = portalToken?.client_name;
                  const clientNotes = activeRevision.comments?.filter((c) => clientName && c.author_name === clientName) ?? [];
                  const internalNotes = activeRevision.comments?.filter((c) => !clientName || c.author_name !== clientName) ?? [];

                  const NoteCard = ({ comment, isClient }: { comment: NonNullable<typeof activeRevision.comments>[0]; isClient: boolean }) => (
                    <div key={comment.id} className={`group flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 ${
                      isClient
                        ? "border-sky-500/15 bg-sky-500/[0.04]"
                        : "border-[#d4a853]/10 bg-[#d4a853]/[0.03]"
                    }`}>
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isClient ? "bg-sky-500/15 text-sky-400" : "bg-[#d4a853]/15 text-[#d4a853]"
                      }`}>
                        {(comment.author_name ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">{comment.author_name ?? "You"}</span>
                          {comment.timestamp_seconds != null && (
                            <button
                              type="button"
                              className={`font-mono text-[10px] hover:underline ${isClient ? "text-sky-400" : "text-[#d4a853]"}`}
                              onClick={() => {
                                const t = comment.timestamp_seconds!;
                                setCurrentTime(t);
                                if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); }
                                setIsPlaying(true);
                              }}
                            >
                              {formatTime(comment.timestamp_seconds)}
                            </button>
                          )}
                          <span className="ml-auto text-[10px] text-muted-foreground/50">{formatRelative(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-snug">{comment.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(activeRevision.id, comment.id)}
                        disabled={deletingCommentId === comment.id}
                        className="shrink-0 rounded-lg p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                      >
                        {deletingCommentId === comment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  );

                  return (
                    <>
                      {clientNotes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-500/60">
                            Client Feedback ({clientNotes.length})
                          </p>
                          {clientNotes.map((c) => <NoteCard key={c.id} comment={c} isClient={true} />)}
                        </div>
                      )}
                      {internalNotes.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#d4a853]/50">
                            Internal Notes ({internalNotes.length})
                          </p>
                          {internalNotes.map((c) => <NoteCard key={c.id} comment={c} isClient={false} />)}
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">No notes yet</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/60">Click the note box below — video pauses automatically</p>
                  </div>
                )}
              </div>

              {/* Note input */}
              <div className="shrink-0 border-t border-border px-4 py-3">
                <div className="relative">
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    onFocus={() => {
                      if (videoRef.current && isPlaying) videoRef.current.pause();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder={`Note at ${formatTime(currentTime)}… (Enter to post)`}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border bg-muted/20 px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/40 focus:outline-none leading-relaxed"
                  />
                  {savingComment ? (
                    <Loader2 className="absolute right-3 bottom-3 h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
                  ) : commentDraft.trim() ? (
                    <Send className="absolute right-3 bottom-3 h-3.5 w-3.5 text-[#d4a853]/60" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* Deploy modal */}
      {deployTarget && selectedProject && (
        <DeployModal
          revision={deployTarget}
          project={selectedProject}
          portalToken={portalToken}
          clients={clients}
          onDeployed={(token) => {
            setPortalToken(token);
            setRevisions((prev) => prev.map((r) => r.id === deployTarget.id ? { ...r, status: "in_review" } : r));
            if (selectedProjectId) {
              updateProject(selectedProjectId, { status: "review" }).catch(() => {});
            }
          }}
          onClose={() => setDeployTarget(null)}
        />
      )}
    </>
  );
}
