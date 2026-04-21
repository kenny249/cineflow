"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { formatDate, formatRelative, formatFileSize, getProgressColor, getInitials, PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarGroup } from "@/components/shared/AvatarGroup";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Calendar, Edit3, MoreHorizontal, CheckCircle2, Circle, Check, MessageSquare, Upload, Pin, Clock, User, Users, Film, ListChecks, Play, Pause, Volume2, VolumeX, Maximize, Download, X, Save, ScrollText, Link2, RefreshCw, Copy, Send, Trash2, ExternalLink, Package, Pencil, ImageIcon, Tag, ChevronDown, CalendarDays, FileText } from "lucide-react";
import { CallSheetGenerator } from "@/components/call-sheet/CallSheetGenerator";
import { useCompletionBurst, BurstRenderer } from "@/components/shared/CompletionBurst";
import Link from "next/link";
import { toast } from "sonner";
import type { Project, ProjectMember, ProjectNote, Revision, RevisionStatus, ShotList, StoryboardFrame, ShotListItem, ProjectRole, ReviewToken, PortalDeliverable } from "@/types";
import { updateProject, updateShotListItem, createProjectNote, deleteProjectNote, updateProjectNote, createReviewToken, getProjectReviewToken, revokeReviewToken, createShotList, createShotListItem, updateStoryboardFrame, deleteStoryboardFrame, createStoryboardFrame, getProjectDeliverables, createProjectDeliverable, updateProjectDeliverable, deleteProjectDeliverable, createProjectTemplate, softDeleteProject } from "@/lib/supabase/queries";
import type { ProjectDeliverable } from "@/lib/supabase/queries";
import { CrewTab } from "@/components/projects/tabs/CrewTab";
import { LocationsTab } from "@/components/projects/tabs/LocationsTab";
import { WrapNotesTab } from "@/components/projects/tabs/WrapNotesTab";
import { FinanceTab } from "@/components/projects/tabs/FinanceTab";
import { ProductionDocsTab } from "@/components/projects/tabs/ProductionDocsTab";
import { ScriptsTab } from "@/components/projects/tabs/ScriptsTab";
import { ProjectTasksTab } from "@/components/projects/tabs/ProjectTasksTab";
import { VideoDeliverablesTab } from "@/components/projects/tabs/VideoDeliverablesTab";
import { ShootDaysPanel } from "@/components/projects/tabs/ShootDaysPanel";
import { saveVideoBlob, getOrFetchUrl, cacheUrl, addRevisionMeta } from "@/lib/revision-store";
import type { RevisionMeta } from "@/lib/revision-store";
import { downloadCSV } from "@/lib/export";

interface ProjectDetailTabsProps {
  project: Project;
  initialNotes: ProjectNote[];
  initialShotList: ShotList | null;
  initialStoryboardFrames: StoryboardFrame[];
  initialRevisions: Revision[];
  initialMembers: ProjectMember[];
  userRole?: ProjectRole;
}

const COVER_UPDATES = [
  "cinematic editorial",
  "luxury film set",
  "high-end automotive",
  "creative director mood",
];

const PROJECT_ROLES = [
  // Direction
  "Director", "Co-Director", "Assistant Director (1st AD)", "2nd AD", "Script Supervisor",
  // Production
  "Producer", "Executive Producer", "Line Producer", "Production Manager",
  "Production Coordinator", "Production Assistant",
  // Camera
  "Director of Photography (DP)", "Camera Operator", "1st AC", "2nd AC",
  "DIT", "Steadicam Operator", "Drone Operator",
  // Lighting & Grip
  "Gaffer", "Best Boy Electric", "Key Grip", "Best Boy Grip", "Spark",
  // Sound
  "Sound Mixer", "Boom Operator", "Sound Designer",
  // Art & Set
  "Production Designer", "Art Director", "Set Decorator", "Props Master",
  // Wardrobe
  "Costume Designer", "Wardrobe Stylist",
  // Hair & Makeup
  "Hair Stylist", "Makeup Artist", "SFX Makeup Artist",
  // Post Production
  "Editor", "Colorist", "VFX Supervisor", "Motion Graphics Designer", "Post Supervisor",
  // Music
  "Composer", "Music Supervisor",
  // Cast
  "Lead Actor", "Supporting Actor", "Background / Extra",
  // Other On-Set
  "Stunt Coordinator", "Location Manager", "Transport Coordinator",
  // Creative & Brand
  "Creative Director", "Agency", "Social Media Manager",
  // Client-Side
  "Client", "Client Representative",
] as const;

// ── Production phase definitions ─────────────────────────────────────────────
const PROD_PHASES = [
  {
    id: "pre_prod" as const,
    label: "Pre-Production",
    weight: 20,
    items: [
      { id: "script_ready", label: "Script finalized" },
      { id: "locations_locked", label: "Locations locked" },
      { id: "crew_confirmed", label: "Crew confirmed" },
      { id: "shot_list_built", label: "Shot list created" },
    ],
  },
  {
    id: "shoot" as const,
    label: "Production / Shoot",
    weight: 40,
    items: [] as { id: string; label: string }[],
  },
  {
    id: "post_prod" as const,
    label: "Post-Production",
    weight: 25,
    items: [
      { id: "editing_complete", label: "Editing complete" },
      { id: "color_sound", label: "Color & sound done" },
      { id: "revisions_approved", label: "Client revisions approved" },
    ],
  },
  {
    id: "delivery" as const,
    label: "Delivery",
    weight: 15,
    items: [
      { id: "final_export", label: "Final export ready" },
      { id: "delivered_to_client", label: "Delivered to client" },
    ],
  },
];

// Phase → status relationship: which status means "this phase is active",
// what to advance to when complete, and what the CTA button says.
const PHASE_STATUS_MAP: Record<string, {
  activeWhenStatus: Project["status"];
  nextStatus: Project["status"];
  ctaLabel: string;
}> = {
  pre_prod:  { activeWhenStatus: "draft",     nextStatus: "active",    ctaLabel: "Start Production"        },
  shoot:     { activeWhenStatus: "active",    nextStatus: "review",    ctaLabel: "Move to Post-Production" },
  post_prod: { activeWhenStatus: "review",    nextStatus: "delivered", ctaLabel: "Mark as Delivered"       },
  delivery:  { activeWhenStatus: "delivered", nextStatus: "delivered", ctaLabel: ""                        },
};

const STATUS_TO_PHASE: Record<string, string> = {
  draft:     "pre_prod",
  active:    "shoot",
  review:    "post_prod",
  delivered: "delivery",
  archived:  "delivery",
  cancelled: "delivery",
};

// Inline gradient background used as the cover fallback
function CoverGradient({ seed }: { seed: string }) {
  // 12 film-noir palettes matching cinematic-images.ts
  const PALETTES: [string, string][] = [
    ["#0d0d1a", "#1e1230"], ["#0a1420", "#0e2535"], ["#1a1208", "#2e200a"],
    ["#0a1a12", "#10281a"], ["#1a0a0a", "#2e1212"], ["#0a0a1a", "#141438"],
    ["#121828", "#182640"], ["#201815", "#342510"], ["#0f1520", "#182540"],
    ["#191520", "#282038"], ["#10180f", "#1a2a18"], ["#1e1020", "#30183a"],
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) { hash = (hash << 5) - hash + seed.charCodeAt(i); hash |= 0; }
  const [c1, c2] = PALETTES[Math.abs(hash) % PALETTES.length];
  return (
    <div
      className="absolute inset-0 -z-10"
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)` }}
    />
  );
}

export default function ProjectDetailTabs({
  project,
  initialNotes,
  initialShotList,
  initialStoryboardFrames,
  initialRevisions,
  initialMembers,
  userRole = "team",
}: ProjectDetailTabsProps) {
  // Role helpers
  const searchParams = useSearchParams();
  const rawInitialTab = searchParams.get("tab") ?? "overview";
  // Map legacy/hidden tab values into their new parent tab
  const initialTab = ["shot-list","scripts","docs","crew"].includes(rawInitialTab) ? "production" : rawInitialTab;
  const [activeTab, setActiveTab] = useState(initialTab);
  const PRODUCTION_TABS = ["shot-list", "scripts", "docs", "crew"];
  const isAdmin = userRole === "owner" || userRole === "admin";
  const isClient = userRole === "client";
  const canEdit = !isClient;
  const [members, setMembers] = useState<ProjectMember[]>(initialMembers);
  const isStaleUrl = (url?: string | null) =>
    !url || url.includes("unsplash.com") || url.includes("picsum.photos") || url.startsWith("data:");
  const [coverUrl, setCoverUrl] = useState(
    isStaleUrl(project.thumbnail_url) ? "" : (project.thumbnail_url ?? "")
  );
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<Project["status"]>(project.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const currentPhaseId = STATUS_TO_PHASE[status] ?? "pre_prod";
  const currentPhaseIndex = PROD_PHASES.findIndex((p) => p.id === currentPhaseId);
  const [shotList, setShotList] = useState<ShotList | null>(initialShotList);
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>(initialStoryboardFrames);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);

  // ── Phase milestones — DB is source of truth, localStorage is cache ──
  const [checkedPhaseItems, setCheckedPhaseItems] = useState<Set<string>>(() => {
    // Prefer DB-stored phase_items (synced across devices/browsers)
    if (project.phase_items && project.phase_items.length > 0) {
      // Also update localStorage cache to match DB
      if (typeof window !== "undefined") {
        try { localStorage.setItem(`cf_phases_${project.id}`, JSON.stringify(project.phase_items)); } catch { /* ignore */ }
      }
      return new Set<string>(project.phase_items);
    }
    // Fall back to localStorage for backwards compatibility
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem(`cf_phases_${project.id}`);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  });

  const completedShots = useMemo(
    () => shotList?.items?.filter((item) => item.is_complete).length ?? 0,
    [shotList]
  );
  const totalShots = useMemo(() => shotList?.items?.length ?? 0, [shotList]);

  // Fully computed — delivery checkbox locks to 100%
  const computedProgress = useMemo(() => {
    if (checkedPhaseItems.has("delivered_to_client")) return 100;
    let pct = 0;
    for (const phase of PROD_PHASES) {
      if (phase.id === "shoot") {
        pct += totalShots > 0 ? (completedShots / totalShots) * 40 : 0;
      } else {
        const done = phase.items.filter((i) => checkedPhaseItems.has(i.id)).length;
        pct += phase.items.length > 0 ? (done / phase.items.length) * phase.weight : 0;
      }
    }
    return Math.round(pct);
  }, [checkedPhaseItems, completedShots, totalShots]);

  // Auto-save computed progress + phase_items to Supabase (debounced 2s)
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProgressRef = useRef(computedProgress);
  const [showCompletionGlow, setShowCompletionGlow] = useState(computedProgress === 100);
  useEffect(() => {
    // Guard: don't overwrite a real DB value with 0 from an empty fresh load
    if (computedProgress === 0 && (project.progress ?? 0) > 0 && checkedPhaseItems.size === 0) return;
    if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
    progressSaveTimer.current = setTimeout(async () => {
      try {
        await updateProject(project.id, {
          progress: computedProgress,
          phase_items: [...checkedPhaseItems],
        });
      } catch { /* silent */ }
    }, 2000);
    // Fire celebration when hitting 100% for the first time
    if (computedProgress === 100 && prevProgressRef.current < 100) {
      setShowCompletionGlow(true);
      // Fire 5 burst salvos spread across the progress bar area
      const barEl = document.querySelector("[data-progress-bar]");
      if (barEl) {
        const rect = barEl.getBoundingClientRect();
        [0.15, 0.35, 0.5, 0.65, 0.85].forEach((frac, i) => {
          setTimeout(() => burst.fire(rect.left + rect.width * frac, rect.top + rect.height / 2), i * 120);
        });
      }
    }
    if (computedProgress < 100) setShowCompletionGlow(false);
    prevProgressRef.current = computedProgress;
    return () => { if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedProgress]);

  const burst = useCompletionBurst();

  const tabScrollRef = useRef<HTMLDivElement>(null);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description);
  const [editClientName, setEditClientName] = useState(project.client_name ?? "");
  const [editClientEmail, setEditClientEmail] = useState(project.client_email ?? "");
  const [editTags, setEditTags] = useState<string[]>(project.tags ?? []);
  const [editTagInput, setEditTagInput] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ revisionId: string; commentId: string; authorName: string } | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // ── Client Portal state ──
  const [portalToken, setPortalToken] = useState<ReviewToken | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCreating, setPortalCreating] = useState(false);
  const [portalClientName, setPortalClientName] = useState(project.client_name ?? "");
  const [portalClientEmail, setPortalClientEmail] = useState(project.client_email ?? "");
  const [portalShowForm, setPortalShowForm] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);
  const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
  const deliverablesLoadedRef = useRef(false);
  const [newDeliverable, setNewDeliverable] = useState("");

  // Load existing token when portal tab is first mounted
  const portalLoadedRef = useRef(false);
  function loadPortalToken() {
    if (portalLoadedRef.current) return;
    portalLoadedRef.current = true;
    setPortalLoading(true);
    Promise.all([
      getProjectReviewToken(project.id),
      // Load deliverables alongside token
      deliverablesLoadedRef.current ? Promise.resolve(null) : getProjectDeliverables(project.id),
    ])
      .then(([token, delivs]) => {
        setPortalToken(token);
        if (delivs !== null) {
          deliverablesLoadedRef.current = true;
          setDeliverables(delivs.map((d: ProjectDeliverable) => ({ id: d.id, label: d.label, done: d.done })));
        }
      })
      .catch(() => {})
      .finally(() => setPortalLoading(false));
  }

  function portalUrl(token: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "https://usecineflow.com";
    return `${base}/review/${token}`;
  }

  async function handleCreatePortal() {
    if (!portalClientName.trim() || !portalClientEmail.trim()) {
      toast.error("Client name and email are required");
      return;
    }
    setPortalCreating(true);
    try {
      const token = await createReviewToken({
        project_id: project.id,
        client_name: portalClientName.trim(),
        client_email: portalClientEmail.trim(),
      });
      setPortalToken(token);
      setPortalShowForm(false);
      // Send portal live email
      await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "portal_live",
          clientName: token.client_name,
          clientEmail: token.client_email,
          projectTitle: title,
          portalUrl: portalUrl(token.token),
        }),
      });
      toast.success(`Portal created, invite sent to ${token.client_email}`);
    } catch {
      toast.error("Failed to create portal");
    } finally {
      setPortalCreating(false);
    }
  }

  async function handleRevokePortal() {
    if (!portalToken) return;
    try {
      await revokeReviewToken(portalToken.id);
      setPortalToken(null);
      toast.success("Portal link revoked");
    } catch {
      toast.error("Failed to revoke portal");
    }
  }

  function handleCopyPortalUrl() {
    if (!portalToken) return;
    navigator.clipboard.writeText(portalUrl(portalToken.token));
    setPortalCopied(true);
    setTimeout(() => setPortalCopied(false), 2000);
  }

  async function addDeliverable() {
    if (!newDeliverable.trim()) return;
    try {
      const created = await createProjectDeliverable(project.id, newDeliverable.trim());
      setDeliverables((prev) => [...prev, { id: created.id, label: created.label, done: created.done }]);
      setNewDeliverable("");
    } catch { toast.error("Failed to add deliverable"); }
  }

  async function toggleDeliverable(id: string) {
    const current = deliverables.find((d) => d.id === id);
    if (!current) return;
    setDeliverables((prev) => prev.map((d) => d.id === id ? { ...d, done: !d.done } : d));
    try {
      await updateProjectDeliverable(id, { done: !current.done });
    } catch {
      // Revert on failure
      setDeliverables((prev) => prev.map((d) => d.id === id ? { ...d, done: current.done } : d));
      toast.error("Failed to update deliverable");
    }
  }

  async function removeDeliverable(id: string) {
    setDeliverables((prev) => prev.filter((d) => d.id !== id));
    try {
      await deleteProjectDeliverable(id);
    } catch { toast.error("Failed to remove deliverable"); }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) { toast.error("Note content is required"); return; }
    setSavingNote(true);
    try {
      const created = await createProjectNote({
        project_id: project.id,
        title: noteTitle.trim() || undefined,
        content: noteContent.trim(),
        pinned: false,
        created_by: undefined,
      });
      setNotes((prev) => [created, ...prev]);
      setNoteTitle("");
      setNoteContent("");
      setShowNoteForm(false);
      toast.success("Note added");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(id: string) {
    setDeletingNoteId(id);
    try {
      await deleteProjectNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function handleTogglePin(note: ProjectNote) {
    const next = !note.pinned;
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, pinned: next } : n));
    try {
      await updateProjectNote(note.id, { pinned: next });
    } catch {
      setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, pinned: note.pinned } : n));
      toast.error("Failed to update note");
    }
  }

  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectMember["role"]>("Editor");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const [showShotDialog, setShowShotDialog] = useState(false);
  const [newShotDescription, setNewShotDescription] = useState("");
  const [newShotNumber, setNewShotNumber] = useState(shotList?.items?.length ? shotList.items.length + 1 : 1);
  const [newShotScene, setNewShotScene] = useState("");
  const [newShotLocation, setNewShotLocation] = useState("");
  const [newShotType, setNewShotType] = useState<ShotListItem["shot_type"]>("medium");
  const [newShotMovement, setNewShotMovement] = useState<ShotListItem["camera_movement"]>("static");
  const [newShotLens, setNewShotLens] = useState("");
  const [addingShotToDb, setAddingShotToDb] = useState(false);

  // ── Shot inline edit ──
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [editShotForm, setEditShotForm] = useState<Partial<ShotListItem>>({});
  const [savingEditShot, setSavingEditShot] = useState(false);

  // ── Note resolved + comments (localStorage) ──
  const [resolvedNotes, setResolvedNotes] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem(`cf_resolved_notes_${project.id}`);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  });
  const [noteComments, setNoteComments] = useState<Record<string, { id: string; text: string; at: string }[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(`cf_note_comments_${project.id}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [noteCommentDrafts, setNoteCommentDrafts] = useState<Record<string, string>>({});
  const [expandedNoteComments, setExpandedNoteComments] = useState<Set<string>>(new Set());

  // ── Storyboard image upload ──
  const [uploadingFrameId, setUploadingFrameId] = useState<string | null>(null);

  // ── Storyboard edit / delete ──
  const [editingFrame, setEditingFrame] = useState<StoryboardFrame | null>(null);
  const [editFrameForm, setEditFrameForm] = useState<Partial<StoryboardFrame>>({});
  const [savingEditFrame, setSavingEditFrame] = useState(false);
  const [deletingFrameId, setDeletingFrameId] = useState<string | null>(null);

  async function saveEditFrame() {
    if (!editingFrame) return;
    setSavingEditFrame(true);
    try {
      const updates: Partial<StoryboardFrame> = {
        title: editFrameForm.title ?? "",
        description: editFrameForm.description ?? "",
        camera_angle: editFrameForm.camera_angle ?? "",
        shot_duration: editFrameForm.shot_duration ?? "",
        mood: editFrameForm.mood ?? "",
        notes: editFrameForm.notes ?? "",
      };
      // Only call DB if it's a real persisted frame
      if (!editingFrame.id.startsWith("sb_")) {
        await updateStoryboardFrame(editingFrame.id, updates);
      }
      setStoryboardFrames((prev) => prev.map((f) => f.id === editingFrame.id ? { ...f, ...updates } : f));
      setEditingFrame(null);
      toast.success("Frame updated.");
    } catch {
      toast.error("Failed to save frame.");
    } finally {
      setSavingEditFrame(false);
    }
  }

  async function handleDeleteFrame(frameId: string) {
    setDeletingFrameId(frameId);
    try {
      if (!frameId.startsWith("sb_")) {
        await deleteStoryboardFrame(frameId);
      }
      setStoryboardFrames((prev) => prev.filter((f) => f.id !== frameId));
      toast.success("Frame deleted.");
    } catch {
      toast.error("Failed to delete frame.");
    } finally {
      setDeletingFrameId(null);
    }
  }

  const [showFrameDialog, setShowFrameDialog] = useState(false);
  const [newFrameTitle, setNewFrameTitle] = useState("");
  const [newFrameDescription, setNewFrameDescription] = useState("");
  const [newFrameCameraAngle, setNewFrameCameraAngle] = useState("");
  const [newFrameDuration, setNewFrameDuration] = useState("00:00:05");
  const [newFrameMood, setNewFrameMood] = useState("");

  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [newRevisionTitle, setNewRevisionTitle] = useState("");
  const [newRevisionFile, setNewRevisionFile] = useState<File | null>(null);
  const [newRevisionDescription, setNewRevisionDescription] = useState("");

  // ── Script state ──
  const [scriptContent, setScriptContent] = useState("");
  const [scriptDirty, setScriptDirty] = useState(false);
  const scriptAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scriptKey = `cineflow-scripts`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(scriptKey);
      if (raw) {
        const all: { projectId: string; content: string }[] = JSON.parse(raw);
        const found = all.find((s) => s.projectId === project.id);
        if (found) setScriptContent(found.content);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  function saveScriptContent(val: string) {
    try {
      const raw = localStorage.getItem(scriptKey);
      const all: { projectId: string; title: string; content: string; updatedAt: string }[] = raw ? JSON.parse(raw) : [];
      const idx = all.findIndex((s) => s.projectId === project.id);
      const entry = { projectId: project.id, title: project.title, content: val, updatedAt: new Date().toISOString() };
      if (idx >= 0) all[idx] = entry; else all.push(entry);
      localStorage.setItem(scriptKey, JSON.stringify(all));
    } catch {}
  }

  function handleScriptChange(val: string) {
    setScriptContent(val);
    setScriptDirty(true);
    if (scriptAutoSaveRef.current) clearTimeout(scriptAutoSaveRef.current);
    scriptAutoSaveRef.current = setTimeout(() => {
      saveScriptContent(val);
      setScriptDirty(false);
    }, 1500);
  }

  const scriptScenes = scriptContent.split("\n").reduce<{ line: number; heading: string }[]>((acc, line, i) => {
    const t = line.trim().toUpperCase();
    if (t.startsWith("INT.") || t.startsWith("EXT.") || t.startsWith("INT/EXT.") || t.startsWith("I/E.")) {
      acc.push({ line: i, heading: line.trim() });
    }
    return acc;
  }, []);

  // ── Shot list sub-mode (shots / storyboard) ──
  const [shotListSubMode, setShotListSubMode] = useState<"shots" | "storyboard">("shots");
  const [showShootDays, setShowShootDays] = useState(false);
  const [callSheetOpen, setCallSheetOpen] = useState(false);

  // ── Inline video player state ──
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // ── Reload persisted revisions: merge server data + localStorage meta + session/IDB cache ──
  useEffect(() => {
    let alive = true;
    (async () => {
      // 1. Read all locally-uploaded metas for this project from shared localStorage
      const raw = typeof localStorage !== "undefined"
        ? localStorage.getItem("cineflow-revision-meta")
        : null;
      let storedMetas: RevisionMeta[] = [];
      if (raw) {
        try {
          const all: RevisionMeta[] = JSON.parse(raw);
          storedMetas = all.filter((m) => m.project_id === project.id);
        } catch { /* ignore */ }
      }

      // 2. Build full revision list — local uploads + server data (deduplicated)
      const serverIds = new Set(initialRevisions.map((r) => r.id));
      const localRevisions: Revision[] = storedMetas
        .filter((m) => !serverIds.has(m.id))
        .map((m) => ({
          id: m.id,
          project_id: m.project_id,
          title: m.name,
          description: undefined,
          version_number: 0,
          file_url: undefined,
          file_size: m.size,
          file_type: undefined,
          thumbnail_url: project.thumbnail_url ?? undefined,
          status: "draft" as const,
          created_by: project.created_by,
          created_at: m.uploadedAt,
          updated_at: m.uploadedAt,
          comments: [],
        }));

      const combined: Revision[] = [...localRevisions, ...initialRevisions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      combined.forEach((r, i) => { r.version_number = combined.length - i; });

      // 3. Hydrate URLs — session cache first (instant), then IDB (cold start / after refresh)
      const patched: Revision[] = [];
      for (const rev of combined) {
        if (!alive) return;
        const url = await getOrFetchUrl(rev.id);
        patched.push(url ? { ...rev, file_url: url } : rev);
      }

      if (!alive) return;
      setRevisions(patched);
    })();

    // No URL revocation — session cache keeps URLs alive across React
    // unmount/remount and Radix tab content switches.
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAddMember = () => {
    if (!newMemberName.trim()) {
      toast.error("Please provide a name for the new member.");
      return;
    }

    const nextMember: ProjectMember = {
      id: `mem_${Math.random().toString(36).slice(2)}`,
      project_id: project.id,
      user_id: `user_${Math.random().toString(36).slice(2)}`,
      role: newMemberRole,
      profile: {
        id: `user_${Math.random().toString(36).slice(2)}`,
        full_name: newMemberName.trim(),
        email: newMemberEmail.trim() || `${newMemberName.trim().split(" ").join(".").toLowerCase()}@example.com`,
        avatar_url: `https://source.unsplash.com/collection/888146/80x80?sig=${Math.floor(Math.random() * 1000)}`,
        role: newMemberRole,
        created_at: new Date().toISOString(),
      },
      joined_at: new Date().toISOString(),
    };

    setMembers((prev) => [nextMember, ...prev]);
    setShowMemberDialog(false);
    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberRole("Editor");
    toast.success("Member added to the project.");
  };

  const handleAddShot = async () => {
    if (!newShotDescription.trim()) {
      toast.error("Please describe the shot.");
      return;
    }
    setAddingShotToDb(true);
    try {
      // Ensure we have a real shot list in the DB
      let activeList = shotList;
      const isFakeId = !activeList?.id || activeList.id.startsWith("sl_");
      if (!activeList || isFakeId) {
        const created = await createShotList({
          project_id: project.id,
          title: "Shot List",
          description: "Project shot list",
        });
        activeList = { ...created, items: [] };
        setShotList(activeList);
      }

      const item = await createShotListItem({
        shot_list_id: activeList.id,
        shot_number: newShotNumber,
        scene: newShotScene || `Scene ${newShotNumber}`,
        location: newShotLocation || "TBD",
        description: newShotDescription.trim(),
        shot_type: newShotType,
        camera_movement: newShotMovement,
        lens: newShotLens || undefined,
        is_complete: false,
      });

      setShotList({
        ...activeList,
        items: [...(activeList.items ?? []), item],
      });
      setShowShotDialog(false);
      setNewShotDescription("");
      setNewShotNumber((prev) => prev + 1);
      setNewShotScene("");
      setNewShotLocation("");
      setNewShotType("medium");
      setNewShotMovement("static");
      setNewShotLens("");
      toast.success("Shot added.");
    } catch {
      toast.error("Failed to save shot.");
    } finally {
      setAddingShotToDb(false);
    }
  };

  const [addingFrame, setAddingFrame] = useState(false);

  const handleAddFrame = async () => {
    if (!newFrameTitle.trim() || !newFrameDescription.trim()) {
      toast.error("Please add a title and description for the frame.");
      return;
    }

    setAddingFrame(true);
    try {
      const created = await createStoryboardFrame({
        project_id: project.id,
        frame_number: storyboardFrames.length + 1,
        title: newFrameTitle.trim(),
        description: newFrameDescription.trim(),
        shot_duration: newFrameDuration.trim() || "00:00:05",
        camera_angle: newFrameCameraAngle.trim() || undefined,
        mood: newFrameMood.trim() || undefined,
      });
      setStoryboardFrames((prev) => [...prev, created]);
      toast.success("Storyboard frame created.");
    } catch {
      // Fallback: add locally with temp ID so the UI isn't broken
      const fallback: StoryboardFrame = {
        id: `sb_${Math.random().toString(36).slice(2)}`,
        project_id: project.id,
        frame_number: storyboardFrames.length + 1,
        title: newFrameTitle.trim(),
        description: newFrameDescription.trim(),
        shot_duration: newFrameDuration.trim() || "00:00:05",
        camera_angle: newFrameCameraAngle.trim() || undefined,
        mood: newFrameMood.trim() || undefined,
        created_at: new Date().toISOString(),
      };
      setStoryboardFrames((prev) => [...prev, fallback]);
      toast.success("Frame added locally.");
    } finally {
      setAddingFrame(false);
      setShowFrameDialog(false);
      setNewFrameTitle("");
      setNewFrameDescription("");
      setNewFrameCameraAngle("");
      setNewFrameDuration("00:00:05");
      setNewFrameMood("");
    }
  };

  // ── Storyboard image upload ──
  const handleFrameImageUpload = async (frameId: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image."); return; }
    setUploadingFrameId(frameId);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${project.id}/storyboard/${frameId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);
      await updateStoryboardFrame(frameId, { image_url: publicUrl });
      setStoryboardFrames((prev) => prev.map((f) => f.id === frameId ? { ...f, image_url: publicUrl } : f));
      toast.success("Frame image updated.");
    } catch {
      const localUrl = URL.createObjectURL(file);
      setStoryboardFrames((prev) => prev.map((f) => f.id === frameId ? { ...f, image_url: localUrl } : f));
      toast.success("Image applied locally.");
    } finally {
      setUploadingFrameId(null);
    }
  };

  // ── Shot inline edit ──
  function startEditShot(shot: ShotListItem) {
    setEditShotForm({
      description: shot.description,
      scene: shot.scene,
      location: shot.location,
      shot_type: shot.shot_type,
      camera_movement: shot.camera_movement,
      lens: shot.lens,
    });
    setEditingShotId(shot.id);
  }

  async function saveEditShot() {
    if (!editingShotId || !editShotForm.description?.trim()) return;
    setSavingEditShot(true);
    const prev = shotList?.items?.find((i) => i.id === editingShotId);
    setShotList((sl) => sl ? { ...sl, items: (sl.items ?? []).map((i) => i.id === editingShotId ? { ...i, ...editShotForm } : i) } : sl);
    setEditingShotId(null);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingShotId);
      if (isUUID) await updateShotListItem(editingShotId, editShotForm);
      toast.success("Shot updated.");
    } catch {
      if (prev) setShotList((sl) => sl ? { ...sl, items: (sl.items ?? []).map((i) => i.id === editingShotId ? prev : i) } : sl);
      toast.error("Failed to save shot.");
    } finally {
      setSavingEditShot(false);
    }
  }

  // ── Note resolved + comments ──
  function toggleNoteResolved(noteId: string) {
    setResolvedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId); else next.add(noteId);
      try { localStorage.setItem(`cf_resolved_notes_${project.id}`, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function saveNoteComments(updated: typeof noteComments) {
    setNoteComments(updated);
    try { localStorage.setItem(`cf_note_comments_${project.id}`, JSON.stringify(updated)); } catch {}
  }

  function addNoteComment(noteId: string) {
    const text = noteCommentDrafts[noteId]?.trim();
    if (!text) return;
    const comment = { id: `nc_${Date.now()}`, text, at: new Date().toISOString() };
    const updated = { ...noteComments, [noteId]: [...(noteComments[noteId] ?? []), comment] };
    saveNoteComments(updated);
    setNoteCommentDrafts((d) => ({ ...d, [noteId]: "" }));
  }

  function deleteNoteComment(noteId: string, commentId: string) {
    const updated = { ...noteComments, [noteId]: (noteComments[noteId] ?? []).filter((c) => c.id !== commentId) };
    saveNoteComments(updated);
  }

  const handleUploadRevision = async () => {
    if (!newRevisionTitle.trim() || !newRevisionFile) {
      toast.error("Title and file are required to upload a revision.");
      return;
    }

    const revId = `rev_${Math.random().toString(36).slice(2)}`;

    // Read duration metadata before saving
    const tempUrl = URL.createObjectURL(newRevisionFile);
    const duration = await new Promise<number>((resolve) => {
      const v = document.createElement("video");
      v.onloadedmetadata = () => { URL.revokeObjectURL(tempUrl); resolve(v.duration); };
      v.onerror = () => { URL.revokeObjectURL(tempUrl); resolve(0); };
      v.src = tempUrl;
    });

    // Persist actual file bytes to IndexedDB so blob URL survives navigation
    await saveVideoBlob(revId, newRevisionFile);

    // Register in shared meta so the /revisions page also sees this upload
    addRevisionMeta({
      id: revId,
      name: newRevisionTitle.trim(),
      size: newRevisionFile.size,
      duration,
      uploadedAt: new Date().toISOString(),
      project_id: project.id,
    });

    const url = URL.createObjectURL(newRevisionFile);
    cacheUrl(revId, url); // register in session cache so it survives tab switches

    const nextRevision: Revision = {
      id: revId,
      project_id: project.id,
      version_number: revisions.length + 1,
      title: newRevisionTitle.trim(),
      description: newRevisionDescription.trim() || undefined,
      file_url: url,
      file_type: newRevisionFile.type,
      file_size: newRevisionFile.size,
      thumbnail_url: coverUrl,
      status: "draft" as RevisionStatus,
      created_by: project.created_by,
      created_at: new Date().toISOString(),
      comments: [],
    };

    setRevisions((prev) => [nextRevision, ...prev]);
    setActiveRevisionId(revId);
    setShowRevisionDialog(false);
    setNewRevisionTitle("");
    setNewRevisionDescription("");
    setNewRevisionFile(null);
    toast.success("Revision uploaded successfully.");
  };

  const handleSaveProject = async () => {
    const updates = {
      title: editTitle.trim() || title,
      description: editDescription,
      client_name: editClientName.trim() || undefined,
      client_email: editClientEmail.trim() || undefined,
      tags: editTags,
    };
    setTitle(updates.title);
    setDescription(updates.description);
    setShowEditDialog(false);
    try {
      await updateProject(project.id, updates);
      toast.success("Project details updated.");
    } catch (err) {
      console.error("Save project error:", err);
      const msg = (err as any)?.message ?? (err as any)?.details ?? "Failed to save";
      toast.error(msg);
    }
  };

  const handleQuickStatusChange = async (newStatus: Project["status"]) => {
    if (newStatus === status || statusSaving) return;
    const prev = status;
    setStatus(newStatus);
    setStatusSaving(true);
    try {
      await updateProject(project.id, { status: newStatus });
      toast.success(`Status → ${PROJECT_STATUS_LABELS[newStatus]}`);

      // Fire stage notification email (same as full edit flow)
      const STAGE_EMAILS: Record<string, { event: string; stageName: string; stageDescription: string }> = {
        active:    { event: "stage_update",   stageName: "Production",      stageDescription: "Your team has started production. We'll keep you updated as the project progresses." },
        review:    { event: "stage_update",   stageName: "Post-Production", stageDescription: "Production is complete and your project has moved into post-production. A cut will be ready for your review soon." },
        delivered: { event: "final_delivery", stageName: "Delivered",       stageDescription: "" },
      };
      const stageInfo = STAGE_EMAILS[newStatus];
      if (stageInfo) {
        const token = portalToken ?? await getProjectReviewToken(project.id).catch(() => null);
        if (token?.client_email) {
          const base = typeof window !== "undefined" ? window.location.origin : "https://usecineflow.com";
          fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: stageInfo.event,
              clientName: token.client_name,
              clientEmail: token.client_email,
              projectTitle: title,
              portalUrl: `${base}/review/${token.token}`,
              stageName: stageInfo.stageName,
              stageDescription: stageInfo.stageDescription,
            }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      setStatus(prev);
      const msg = (err as any)?.message ?? (err as any)?.details ?? "Failed to update status";
      console.error("Status update error:", err);
      toast.error(msg);
    } finally {
      setStatusSaving(false);
    }
  };

  const openEditDialog = () => {
    setEditTitle(title);
    setEditDescription(description);
    setEditClientName(project.client_name ?? "");
    setEditClientEmail(project.client_email ?? "");
    setEditTags(project.tags ?? []);
    setEditTagInput("");
    setShowEditDialog(true);
  };

  const addEditTag = (raw: string) => {
    const trimmed = raw.trim().toLowerCase().replace(/[,;]+$/, "");
    if (!trimmed || editTags.includes(trimmed) || editTags.length >= 8) return;
    setEditTags((prev) => [...prev, trimmed]);
  };

  const handleEditTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEditTag(editTagInput);
      setEditTagInput("");
    } else if (e.key === "Backspace" && !editTagInput && editTags.length > 0) {
      setEditTags((prev) => prev.slice(0, -1));
    }
  };

  const togglePhaseItem = (itemId: string, event: MouseEvent) => {
    const willCheck = !checkedPhaseItems.has(itemId);
    if (willCheck) burst.fire(event.clientX, event.clientY);
    setCheckedPhaseItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      // Keep localStorage in sync as a cache
      try { localStorage.setItem(`cf_phases_${project.id}`, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleShotComplete = async (shotId: string, event?: MouseEvent) => {
    if (!shotList?.items) return;
    const item = shotList.items.find((i) => i.id === shotId);
    if (!item) return;
    const newVal = !item.is_complete;
    if (newVal && event) burst.fire(event.clientX, event.clientY);
    // Optimistic update
    setShotList({
      ...shotList,
      items: shotList.items.map((i) => i.id === shotId ? { ...i, is_complete: newVal } : i),
    });
    try {
      await updateShotListItem(shotId, { is_complete: newVal });
    } catch {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(shotId);
      if (isUUID) {
        setShotList({
          ...shotList,
          items: shotList.items.map((i) => i.id === shotId ? { ...i, is_complete: item.is_complete } : i),
        });
        toast.error("Failed to update shot.");
      }
    }
  };

  const handleAddRevisionComment = async (revisionId: string, parentId?: string) => {
    const { createRevisionComment } = await import("@/lib/supabase/queries");
    const draft = parentId ? replyDraft.trim() : commentDrafts[revisionId]?.trim();
    if (!draft) {
      toast.error("Add a comment before submitting.");
      return;
    }
    try {
      const saved = await createRevisionComment({ revision_id: revisionId, content: draft, parent_id: parentId });
      const newComment = {
        ...saved,
        replies: [],
      };
      setRevisions((prev) =>
        prev.map((revision) => {
          if (revision.id !== revisionId) return revision;
          if (parentId) {
            // Add as reply under the parent
            return {
              ...revision,
              comments: (revision.comments ?? []).map((c) =>
                c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newComment] } : c
              ),
            };
          }
          return { ...revision, comments: [...(revision.comments ?? []), newComment] };
        })
      );
      if (parentId) { setReplyDraft(""); setReplyingTo(null); }
      else setCommentDrafts((prev) => ({ ...prev, [revisionId]: "" }));
      toast.success("Comment added.");
    } catch {
      toast.error("Failed to post comment.");
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    // Optimistic preview
    const localUrl = URL.createObjectURL(file);
    setCoverUrl(localUrl);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${project.id}/cover/cover.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);
      setCoverUrl(publicUrl);
      await updateProject(project.id, { thumbnail_url: publicUrl });
      // Also sync to the card's localStorage key so ProjectCard reflects it immediately
      if (typeof window !== "undefined") {
        localStorage.setItem(`cf_thumb_${project.id}`, publicUrl);
        localStorage.setItem(`cf_thumb_pos_${project.id}`, JSON.stringify({ x: 50, y: 50, scale: 1 }));
      }
      toast.success("Cover photo saved.");
    } catch (err) {
      console.error("Cover upload failed:", err);
      toast.error("Couldn't save cover photo. Please try again.");
    }
  };

  const handleRefreshCover = async () => {
    const { getCinematicGradient, CINEMATIC_COUNT } = await import("@/lib/cinematic-images");
    const variant = Math.floor(Math.random() * CINEMATIC_COUNT);
    const gradient = getCinematicGradient(project.title, variant);
    // Store variant so the card picks it up, but don't persist a data-URI to DB
    localStorage.setItem(`cf_thumb_${project.id}`, `__variant:${variant}`);
    toast.success("Cover style refreshed. Upload a photo to make it permanent.");
  };

  const availableImageQuery = useMemo(
    () => COVER_UPDATES[Math.floor(Math.random() * COVER_UPDATES.length)],
    []
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50">
        <div className="flex h-11 items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/projects"
              className="flex shrink-0 items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span className="hidden sm:inline">Projects</span>
            </Link>
            <span className="hidden sm:inline">/</span>
            <span className="text-foreground font-medium truncate">{project.title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isAdmin && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setActiveTab("finance")}>
                <span className="hidden sm:inline">Invoice</span>
                <span className="sm:hidden">$</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs border-[#d4a853]/30 text-[#d4a853] hover:bg-[#d4a853]/10"
              onClick={() => setCallSheetOpen(true)}
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Call Sheet</span>
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={openEditDialog}>
                <Edit3 className="h-3 w-3" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" type="button" onClick={() => toast(`More actions coming soon.`)}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {callSheetOpen && (
            <CallSheetGenerator project={project} onClose={() => setCallSheetOpen(false)} />
          )}
        </div>

        <div className="relative h-28 sm:h-36 w-full overflow-hidden" data-cover>
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              className="object-cover"
              unoptimized
              onError={() => setCoverUrl("")}
            />
          ) : null}
          {/* Gradient fallback always rendered behind the image */}
          <CoverGradient seed={project.id || project.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
          <div className="absolute right-4 bottom-4 flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0a0a0a]/80 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-[#0a0a0a]">
              <Upload className="h-3.5 w-3.5" />
              Upload cover
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleCoverUpload(e.target.files[0])}
              />
            </label>
            <button
              type="button"
              onClick={handleRefreshCover}
              className="rounded-full border border-white/20 bg-black/70 px-3 py-2 text-xs font-medium text-white transition hover:bg-black"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="px-4 pb-4 sm:px-6 -mt-6 relative">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {/* Status indicator — read-only, driven by phase completion */}
                <StatusBadge status={status} />
                <Badge variant="outline">{PROJECT_TYPE_LABELS[project.type]}</Badge>
                {project.tags?.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
              <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
              {project.client_name && (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  {project.client_name}
                  {project.client_email && (
                    <span className="text-muted-foreground/50">· {project.client_email}</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <AvatarGroup members={members.map((m) => m.profile)} max={4} size="md" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="w-full sm:flex-1 sm:min-w-[200px]">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall progress</span>
                <motion.span
                  key={computedProgress}
                  className="text-xs font-medium text-foreground"
                  initial={{ scale: 1.2, color: "#d4a853" }}
                  animate={{ scale: 1, color: computedProgress === 100 ? "#34d399" : "#ffffff" }}
                  transition={{ duration: 0.3 }}
                >
                  {computedProgress}%
                </motion.span>
              </div>
              {/* Custom animated progress bar */}
              <div
                data-progress-bar
                className="relative h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full"
                  style={{
                    background: computedProgress === 100
                      ? "linear-gradient(90deg, #34d399, #059669)"
                      : computedProgress >= 60
                      ? "linear-gradient(90deg, #d4a853, #e8c06e)"
                      : "linear-gradient(90deg, #b8904a, #d4a853)",
                    boxShadow: computedProgress === 100
                      ? "0 0 8px rgba(52,211,153,0.6)"
                      : computedProgress > 0
                      ? "0 0 6px rgba(212,168,83,0.4)"
                      : "none",
                  }}
                  initial={false}
                  animate={{ width: `${computedProgress}%` }}
                  transition={{ duration: 0.6, ease: [0.34, 1.2, 0.64, 1] }}
                />
                {/* Shimmer on 100% */}
                {showCompletionGlow && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)" }}
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.8, ease: "easeInOut", repeat: 2, repeatDelay: 0.1 }}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-[#d4a853]" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Shoot Date</div>
                <div className="font-medium text-foreground">{project.shoot_date ? formatDate(project.shoot_date, "MMM d, yyyy") : "TBD"}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Updated</div>
                <div className="font-medium text-foreground">{formatRelative(project.updated_at ?? project.created_at)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); tabScrollRef.current?.scrollTo({ top: 0, behavior: "instant" }); }} className="flex h-full flex-col">
          <div className="border-b border-border">
            <div className="overflow-x-auto no-scrollbar">
              <TabsList className="flex h-10 w-max min-w-full bg-transparent gap-0 rounded-none border-b-0 p-0 px-4 sm:px-6">
              {[
                { value: "overview",    label: "Overview" },
                { value: "production",  label: "Production", alsoActiveFor: PRODUCTION_TABS },
                { value: "review",      label: `Review${revisions.length ? ` (${revisions.length})` : ""}` },
                { value: "final-cuts",  label: "Final Cuts" },
                ...(isAdmin ? [{ value: "finance", label: "Finance 🔒" }] : []),
              ].map((tab) => {
                const isActive = activeTab === tab.value || (tab.alsoActiveFor?.includes(activeTab) ?? false);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={`rounded-none border-b-2 px-3 py-2 text-xs font-medium transition-none data-[state=active]:bg-transparent data-[state=active]:shadow-none ${
                      isActive
                        ? "border-[#d4a853] text-foreground"
                        : "border-transparent text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                  </TabsTrigger>
                );
              })}
              </TabsList>
            </div>
          </div>

          <div ref={tabScrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <TabsContent value="overview" className="m-0 p-5 sm:p-6">
              <div className="grid gap-5 xl:grid-cols-[1fr_280px]">
                <div className="space-y-5">
                  {description && (
                    <section>
                      <h3 className="mb-2 font-display text-sm font-semibold text-foreground">About this project</h3>
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                      </div>
                    </section>
                  )}

                  {notes.filter((note) => note.pinned).length > 0 && (
                    <section>
                      <h3 className="mb-2 font-display text-sm font-semibold text-foreground">Pinned note</h3>
                      {notes
                        .filter((note) => note.pinned)
                        .map((note) => (
                          <div key={note.id} className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03] p-4">
                            <div className="mb-2 flex items-center gap-1.5">
                              <Pin className="h-3 w-3 text-[#d4a853]" />
                              {note.title && <span className="text-xs font-semibold text-[#d4a853]">{note.title}</span>}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{note.content}</p>
                          </div>
                        ))}
                    </section>
                  )}

                  {/* ── Production Phases ── */}
                  <section>
                    <h3 className="mb-3 font-display text-sm font-semibold text-foreground flex items-center gap-2">
                      Production Phases
                      <span className="font-mono text-xs font-normal text-muted-foreground">{computedProgress}%</span>
                    </h3>
                    <div className="space-y-2">
                      {PROD_PHASES.map((phase, phaseIndex) => {
                        const isShoot = phase.id === "shoot";
                        const checkedCount = isShoot
                          ? completedShots
                          : phase.items.filter((i) => checkedPhaseItems.has(i.id)).length;
                        const total = isShoot ? totalShots : phase.items.length;
                        const phasePct = total > 0 ? checkedCount / total : 0;
                        const isComplete = total > 0 && phasePct >= 1;
                        const isPast = phaseIndex < currentPhaseIndex;
                        const isCurrent = phaseIndex === currentPhaseIndex;
                        const phaseMap = PHASE_STATUS_MAP[phase.id];
                        const showCta = isCurrent && isComplete && phaseMap.nextStatus !== phaseMap.activeWhenStatus;
                        return (
                          <div
                            key={phase.id}
                            className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                              isPast
                                ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                                : isCurrent
                                ? "border-[#d4a853]/30 bg-[#d4a853]/[0.02]"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="px-3 py-2.5">
                              {/* Phase header */}
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  {isPast || isComplete
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    : isCurrent
                                    ? <div className="h-3.5 w-3.5 rounded-full border-2 border-[#d4a853]/60 shrink-0" />
                                    : <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                                  }
                                  <span className={`text-xs font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                                    {phase.label}
                                  </span>
                                  {isCurrent && !isComplete && (
                                    <span className="rounded bg-[#d4a853]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#d4a853] uppercase">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{total > 0 ? `${checkedCount}/${total}` : "—"}</span>
                                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{phase.weight}%</span>
                                </div>
                              </div>

                              {/* Phase mini progress bar */}
                              {total > 0 && (
                                <div className="mb-2 h-[2px] rounded-full bg-border overflow-hidden">
                                  <motion.div
                                    className={`h-full ${isPast || isComplete ? "bg-emerald-400" : "bg-[#d4a853]"}`}
                                    initial={false}
                                    animate={{ width: `${phasePct * 100}%` }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                  />
                                </div>
                              )}

                              {/* Phase items */}
                              {isShoot ? (
                                <div className="flex items-center gap-1.5">
                                  <Film className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="text-[11px] text-muted-foreground">
                                    {totalShots === 0
                                      ? "Add shots to the shot list to track production"
                                      : <><span className="text-foreground font-medium">{completedShots}</span> of {totalShots} shots complete</>
                                    }
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  {phase.items.map((item) => {
                                    const done = checkedPhaseItems.has(item.id);
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-accent/50 transition-colors group"
                                        onClick={(e) => togglePhaseItem(item.id, e.nativeEvent)}
                                      >
                                        <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                          done
                                            ? "bg-[#d4a853] border-[#d4a853]"
                                            : "border-muted-foreground/40 group-hover:border-[#d4a853]/50"
                                        }`}>
                                          {done && <Check className="h-2 w-2 text-black" />}
                                        </div>
                                        <span className={`text-[11px] transition-colors ${done ? "line-through text-muted-foreground" : isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                                          {item.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* ── Advance phase CTA ── */}
                              {showCta && (
                                <button
                                  onClick={() => handleQuickStatusChange(phaseMap.nextStatus)}
                                  disabled={statusSaving}
                                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#d4a853] px-3 py-2 text-xs font-semibold text-black transition-all hover:bg-[#c49843] active:scale-[0.98] disabled:opacity-50"
                                >
                                  {statusSaving ? (
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                                  ) : (
                                    <>
                                      {phaseMap.ctaLabel}
                                      <ArrowRight className="h-3.5 w-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {shotList && (
                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-display text-sm font-semibold text-foreground">Shot List</h3>
                        <span className="text-xs text-muted-foreground">
                          {completedShots} of {totalShots} complete
                        </span>
                      </div>
                      <div className="rounded-xl border border-border bg-card overflow-hidden">
                        {shotList.items?.slice(0, 3).map((shot) => (
                          <div key={shot.id} className="flex items-start gap-3 border-b border-border p-3 last:border-0">
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 transition-transform active:scale-90"
                              onClick={(e) => toggleShotComplete(shot.id, e.nativeEvent)}
                            >
                              {shot.is_complete
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                : <Circle className="h-4 w-4 text-muted-foreground hover:text-[#d4a853] transition-colors" />
                              }
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">#{shot.shot_number}</span>
                                <span className="text-xs font-medium text-foreground truncate">{shot.description}</span>
                              </div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {shot.location || "—"} · {shot.shot_type.replace("_", " ")} · {shot.camera_movement}
                              </p>
                            </div>
                          </div>
                        ))}
                        {totalShots > 3 && (
                          <div className="p-3 text-center text-xs text-muted-foreground">+{totalShots - 3} more shots</div>
                        )}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-4">
                  <section>
                    <h3 className="mb-2 font-display text-sm font-semibold text-foreground">Team</h3>
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2.5">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={member.profile.avatar_url} alt={member.profile.full_name} />
                            <AvatarFallback className="text-[10px]">{getInitials(member.profile.full_name ?? member.profile.email ?? "")}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{member.profile.full_name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={() => setShowMemberDialog(true)}
                        className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        <User className="h-3 w-3" />
                        Add member
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 font-display text-sm font-semibold text-foreground">Details</h3>
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
                      {[
                        { label: "Client", value: project.client_name || "—" },
                        { label: "Type", value: PROJECT_TYPE_LABELS[project.type] },
                        { label: "Created", value: formatDate(project.created_at, "MMM d, yyyy") },
                        { label: "Updated", value: formatRelative(project.updated_at) },
                      ].map((detail) => (
                        <div key={detail.label} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{detail.label}</span>
                          <span className="text-xs text-foreground font-medium">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              {/* ── Notes (merged into Overview) ── */}
              <div className="mt-6 border-t border-border pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground">Notes</h3>
                  {canEdit && (
                    <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowNoteForm((v) => !v)}>
                      {showNoteForm ? "Cancel" : "+ Add Note"}
                    </Button>
                  )}
                </div>
                {showNoteForm && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Title (optional)" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none" />
                    <textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Write your note…" rows={3} className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowNoteForm(false); setNoteTitle(""); setNoteContent(""); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                      <button onClick={handleAddNote} disabled={savingNote} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">
                        {savingNote ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}Save
                      </button>
                    </div>
                  </div>
                )}
                {notes.length === 0 && !showNoteForm ? (
                  <p className="text-sm text-muted-foreground">No notes yet. Capture creative direction, tech calls, and client feedback here.</p>
                ) : (
                  <div className="grid gap-3">
                    {notes.map((note) => (
                      <div key={note.id} className={`rounded-xl border bg-card p-4 ${note.pinned ? "border-[#d4a853]/30 bg-[#d4a853]/[0.03]" : "border-border"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {note.title && <h4 className="text-sm font-semibold text-foreground">{note.title}</h4>}
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelative(note.created_at)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={() => handleTogglePin(note)} className={`rounded-lg p-1.5 transition-colors ${note.pinned ? "text-[#d4a853]" : "text-muted-foreground hover:text-[#d4a853]"}`}><Pin className="h-3.5 w-3.5" /></button>
                            {canEdit && <button onClick={() => handleDeleteNote(note.id)} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Wrap Notes (merged into Overview) ── */}
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="mb-4 font-display text-sm font-semibold text-foreground">Wrap Notes</h3>
                <WrapNotesTab projectId={project.id} canEdit={canEdit} />
              </div>
            </TabsContent>

            {/* ── Production Hub ── */}
            <TabsContent value="production" className="m-0 p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="font-display text-sm font-semibold text-foreground">Production</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Shot planning, scripts, files, and crew — everything for the shoot.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { value: "shot-list", label: "Shot List",  icon: ListChecks, desc: `${totalShots ? `${completedShots}/${totalShots} shots` : "Plan your shots"}` },
                  { value: "scripts",   label: "Scripts",    icon: ScrollText, desc: "Scripts & callsheets" },
                  { value: "docs",      label: "Files",      icon: Package,    desc: "Production documents" },
                  { value: "crew",      label: "Crew",       icon: Users,      desc: "Crew & contacts" },
                ].map((section) => (
                  <button
                    key={section.value}
                    type="button"
                    onClick={() => setActiveTab(section.value)}
                    className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card/50 p-4 text-left transition-all hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground group-hover:border-[#d4a853]/30 group-hover:bg-[#d4a853]/10 group-hover:text-[#d4a853] transition-all">
                      <section.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground group-hover:text-[#d4a853] transition-colors">{section.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{section.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="shot-list" className="m-0 p-4 sm:p-6">
              {/* Sub-mode toggle: Shots / Storyboard */}
              <div className="mb-4 flex items-center gap-2 border-b border-border pb-3">
                <button
                  onClick={() => setShotListSubMode?.("shots")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${(!shotListSubMode || shotListSubMode === "shots") ? "bg-[#d4a853]/10 text-[#d4a853]" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Shot List
                </button>
                <button
                  onClick={() => setShotListSubMode?.("storyboard")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${shotListSubMode === "storyboard" ? "bg-[#d4a853]/10 text-[#d4a853]" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Storyboard
                </button>
              </div>

              {/* Shoot Days Panel — collapsible, shots mode only */}
              {shotListSubMode !== "storyboard" && (
                <div className="mb-6">
                  <button
                    onClick={() => setShowShootDays((v) => !v)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-[#d4a853]/30 hover:text-foreground w-full sm:w-auto"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-[#d4a853]/70" />
                    Shoot Days &amp; Call Sheets
                    <ChevronDown className={`h-3.5 w-3.5 ml-auto sm:ml-0 transition-transform duration-200 ${showShootDays ? "rotate-180" : ""}`} />
                  </button>
                  {showShootDays && (
                    <div className="mt-3">
                      <ShootDaysPanel
                        projectId={project.id}
                        projectTitle={project.title}
                        shots={shotList?.items ?? []}
                        onShotsUpdated={(_updated) => {
                          window.location.reload();
                        }}
                        canEdit={canEdit}
                      />
                    </div>
                  )}
                </div>
              )}

              {shotListSubMode === "storyboard" ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-foreground">Storyboard</h3>
                    <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowFrameDialog(true)}>+ Add Frame</Button>
                  </div>
                  {storyboardFrames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <p className="font-display font-semibold">No storyboard frames yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">Build your scene ideas with visual beats and production notes.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {storyboardFrames.map((frame) => (
                        <div key={frame.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-[#d4a853]/40 hover:shadow-md">
                          <div className="relative aspect-video overflow-hidden bg-muted">
                            {frame.image_url ? (
                              <Image src={frame.image_url} alt={frame.title || `Frame ${frame.frame_number}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" unoptimized />
                            ) : (
                              <div className="flex h-full items-center justify-center"><div className="flex flex-col items-center gap-1 text-muted-foreground/40"><ImageIcon className="h-8 w-8" /><span className="text-[10px]">No image</span></div></div>
                            )}
                            <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm">{String(frame.frame_number).padStart(2, "0")}</div>
                            {frame.shot_duration && <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">{frame.shot_duration}</div>}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors">
                                {uploadingFrameId === frame.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Upload className="h-3.5 w-3.5" />}
                                {uploadingFrameId === frame.id ? "Uploading…" : "Upload image"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFrameImageUpload(frame.id, e.target.files[0])} />
                              </label>
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setEditingFrame(frame); setEditFrameForm({ title: frame.title, description: frame.description, camera_angle: frame.camera_angle, shot_duration: frame.shot_duration, mood: frame.mood, notes: frame.notes }); }} className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-[#d4a853]/80 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                <button onClick={() => { if (confirm("Delete this frame?")) handleDeleteFrame(frame.id); }} disabled={deletingFrameId === frame.id} className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors disabled:opacity-50">{deletingFrameId === frame.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Trash2 className="h-3.5 w-3.5" />}Delete</button>
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            {frame.title && <p className="text-xs font-semibold text-foreground mb-1">{frame.title}</p>}
                            {frame.description && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{frame.description}</p>}
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                              {frame.camera_angle && <p className="text-[10px] text-muted-foreground">{frame.camera_angle}</p>}
                              {frame.mood && <p className="text-[10px] text-[#d4a853]/70 italic">{frame.mood}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
              <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{shotList?.title || "Shot List"}</h3>
                  {shotList && <p className="text-xs text-muted-foreground mt-0.5">{shotList.description || "Plan your coverage and camera choreography."}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {shotList?.items && shotList.items.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        downloadCSV(
                          `shot-list-${shotList.title.toLowerCase().replace(/\s+/g, "-")}.csv`,
                          ["#", "Scene", "Description", "Shot Type", "Movement", "Lens", "Location", "Duration (s)", "Done"],
                          (shotList.items ?? []).map((s) => [s.shot_number, s.scene ?? "", s.description, s.shot_type, s.camera_movement, s.lens ?? "", s.location ?? "", s.duration_seconds ?? "", s.is_complete ? "Yes" : "No"])
                        );
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />CSV
                    </Button>
                  )}
                  <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowShotDialog(true)}>
                    + Add Shot
                  </Button>
                </div>
              </div>

              {!shotList ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="font-display font-semibold">No shot list yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first shot list to start planning your shoot.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">#</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</th>
                        <th className="hidden sm:table-cell px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Location</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Type</th>
                        <th className="hidden md:table-cell px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Movement</th>
                        <th className="hidden md:table-cell px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lens</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shotList.items?.map((shot) => (
                        editingShotId === shot.id ? (
                          <tr key={shot.id} className="bg-accent/20">
                            <td className="px-3 py-2 w-14">
                              <span className="font-mono text-xs text-muted-foreground">{shot.shot_number}</span>
                            </td>
                            <td className="px-3 py-2" colSpan={5}>
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                <input className="col-span-2 sm:col-span-3 h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" placeholder="Description *" value={editShotForm.description ?? ""} onChange={(e) => setEditShotForm((f) => ({ ...f, description: e.target.value }))} />
                                <input className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" placeholder="Scene" value={editShotForm.scene ?? ""} onChange={(e) => setEditShotForm((f) => ({ ...f, scene: e.target.value }))} />
                                <input className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" placeholder="Location" value={editShotForm.location ?? ""} onChange={(e) => setEditShotForm((f) => ({ ...f, location: e.target.value }))} />
                                <input className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" placeholder="Lens" value={editShotForm.lens ?? ""} onChange={(e) => setEditShotForm((f) => ({ ...f, lens: e.target.value }))} />
                                <select className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" value={editShotForm.shot_type ?? "medium"} onChange={(e) => setEditShotForm((f) => ({ ...f, shot_type: e.target.value as ShotListItem["shot_type"] }))}>  
                                  {["wide","medium","close_up","extreme_close_up","over_the_shoulder","aerial","pov","two_shot","insert"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                                </select>
                                <select className="h-8 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none" value={editShotForm.camera_movement ?? "static"} onChange={(e) => setEditShotForm((f) => ({ ...f, camera_movement: e.target.value as ShotListItem["camera_movement"] }))}>  
                                  {["static","pan","tilt","dolly","handheld","crane","steadicam","zoom"].map((m) => <option key={m}>{m}</option>)}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <button type="button" className="text-xs text-muted-foreground hover:text-foreground mr-2" onClick={() => setEditingShotId(null)}>Cancel</button>
                              <button type="button" className="text-xs font-semibold text-[#d4a853] hover:text-[#c49843]" onClick={saveEditShot} disabled={savingEditShot}>Save</button>
                            </td>
                          </tr>
                        ) : (
                        <tr key={shot.id} className={`group bg-card transition-colors hover:bg-accent/30 ${shot.is_complete ? "opacity-60" : ""}`}>
                          <td className="px-3 py-3 w-14">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="shrink-0 transition-transform active:scale-90"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleShotComplete(shot.id, e.nativeEvent); }}
                              >
                                {shot.is_complete
                                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                  : <Circle className="h-4 w-4 text-muted-foreground hover:text-[#d4a853] transition-colors" />}
                              </button>
                              <span className="font-mono text-xs text-muted-foreground">{shot.shot_number}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 max-w-[160px] sm:max-w-xs">
                            <p className="text-sm text-foreground leading-snug">{shot.description}</p>
                            {shot.scene && <p className="mt-0.5 text-[10px] text-muted-foreground">{shot.scene}</p>}
                            {shot.notes && <p className="mt-0.5 text-xs text-muted-foreground italic truncate">{shot.notes}</p>}
                          </td>
                          <td className="hidden sm:table-cell px-3 py-3"><span className="text-xs text-muted-foreground whitespace-nowrap">{shot.location || "—"}</span></td>
                          <td className="px-3 py-3"><Badge variant="outline" className="text-[10px] whitespace-nowrap">{shot.shot_type.replace("_", " ")}</Badge></td>
                          <td className="hidden md:table-cell px-3 py-3"><span className="text-xs text-muted-foreground capitalize">{shot.camera_movement}</span></td>
                          <td className="hidden md:table-cell px-3 py-3"><span className="font-mono text-xs text-muted-foreground">{shot.lens || "—"}</span></td>
                          <td className="px-3 py-3 w-16 text-right">
                            <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent"
                                onClick={() => startEditShot(shot)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleShotComplete(shot.id, e.nativeEvent); }}
                              >
                                {shot.is_complete ? "Undo" : "Done"}
                              </button>
                            </div>
                          </td>
                        </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
              )}
            </TabsContent>

            {/* ── Storyboard (hidden standalone — content merged into Shot List sub-mode) ── */}
            <TabsContent value="storyboard" className="m-0 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-foreground">Storyboard</h3>
                <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowFrameDialog(true)}>
                  + Add Frame
                </Button>
              </div>

              {storyboardFrames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="font-display font-semibold">No storyboard frames yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Build your scene ideas with visual beats and production notes.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {storyboardFrames.map((frame) => (
                    <div key={frame.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-[#d4a853]/40 hover:shadow-md">
                      {/* Image area */}
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        {frame.image_url ? (
                          <Image src={frame.image_url} alt={frame.title || `Frame ${frame.frame_number}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <div className="flex flex-col items-center gap-1 text-muted-foreground/40">
                              <ImageIcon className="h-8 w-8" />
                              <span className="text-[10px]">No image</span>
                            </div>
                          </div>
                        )}
                        {/* Frame number badge */}
                        <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm">{String(frame.frame_number).padStart(2, "0")}</div>
                        {/* Duration badge */}
                        {frame.shot_duration && <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">{frame.shot_duration}</div>}
                        {/* Hover action overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                          {/* Upload image */}
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors">
                            {uploadingFrameId === frame.id
                              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              : <Upload className="h-3.5 w-3.5" />
                            }
                            {uploadingFrameId === frame.id ? "Uploading…" : "Upload image"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFrameImageUpload(frame.id, e.target.files[0])} />
                          </label>
                          {/* Edit + Delete row */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setEditingFrame(frame); setEditFrameForm({ title: frame.title, description: frame.description, camera_angle: frame.camera_angle, shot_duration: frame.shot_duration, mood: frame.mood, notes: frame.notes }); }}
                              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-[#d4a853]/80 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this frame?")) handleDeleteFrame(frame.id); }}
                              disabled={deletingFrameId === frame.id}
                              className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 border border-white/20 px-3 py-1.5 text-[11px] font-medium text-white transition-colors disabled:opacity-50"
                            >
                              {deletingFrameId === frame.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Card info */}
                      <div className="p-3">
                        {frame.title && <p className="text-xs font-semibold text-foreground mb-1">{frame.title}</p>}
                        {frame.description && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{frame.description}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {frame.camera_angle && <p className="text-[10px] text-muted-foreground">{frame.camera_angle}</p>}
                          {frame.mood && <p className="text-[10px] text-[#d4a853]/70 italic">{frame.mood}</p>}
                        </div>
                        {frame.notes && <p className="mt-1 text-[10px] text-muted-foreground/60 line-clamp-1 italic">{frame.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Tasks ── */}
            <TabsContent value="tasks" className="m-0">
              <ProjectTasksTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Scripts (file-upload focused) ── */}
            <TabsContent value="scripts" className="m-0">
              <ScriptsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Production Docs ── */}
            <TabsContent value="docs" className="m-0">
              <ProductionDocsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Crew + Locations ── */}
            <TabsContent value="crew" className="m-0">
              <CrewTab projectId={project.id} canEdit={canEdit} />
              <div className="border-t border-border mx-4 sm:mx-5 my-1" />
              <div className="px-4 sm:px-5 pt-2 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Locations</p>
              </div>
              <LocationsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Locations (hidden, kept for deep-link compat) ── */}
            <TabsContent value="locations" className="m-0">
              <LocationsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Wrap Notes ── */}
            <TabsContent value="wrap" className="m-0">
              <WrapNotesTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Finance (admin only) ── */}
            {isAdmin && (
              <TabsContent value="finance" className="m-0">
                <FinanceTab projectId={project.id} isAdmin={isAdmin} />
              </TabsContent>
            )}

            <TabsContent value="review" className="m-0 p-4 sm:p-6">
              {/* ── Header ── */}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">Cuts & Deliverables</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {revisions.length === 0
                      ? "No cuts uploaded yet — open the Review Hub to get started."
                      : `${revisions.length} cut${revisions.length !== 1 ? "s" : ""} · manage in the Review Hub for full controls`}
                  </p>
                </div>
                <Link
                  href={`/revisions?project=${project.id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors w-fit"
                >
                  <Film className="h-3.5 w-3.5" />
                  Open in Review Hub
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </Link>
              </div>

              {revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center">
                  <Film className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
                  <p className="font-display text-sm font-semibold text-foreground">No cuts yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Upload your first cut in the Review Hub.</p>
                  <Link
                    href={`/revisions?project=${project.id}`}
                    className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/20 px-3 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" /> Upload first cut
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {revisions.map((revision) => {
                    const statusStyles: Record<string, string> = {
                      draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                      in_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      revisions_requested: "bg-sky-500/10 text-sky-400 border-sky-500/20",
                      approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      final: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                    };
                    const statusLabels: Record<string, string> = {
                      draft: "Draft",
                      in_review: "In Review",
                      revisions_requested: "Changes Requested",
                      approved: "Approved",
                      final: "Final",
                    };
                    const needsAttention = revision.status === "in_review" || revision.status === "revisions_requested";

                    return (
                      <Link
                        key={revision.id}
                        href={`/revisions?project=${project.id}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 hover:border-border/80 hover:bg-card/80 transition-all group"
                      >
                        {/* Icon */}
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusStyles[revision.status] ?? "bg-muted/50"}`}>
                          <Film className="h-3.5 w-3.5" />
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] text-muted-foreground/60">v{revision.version_number}</span>
                            <span className="truncate text-xs font-semibold text-foreground">{revision.title}</span>
                            <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0.5 ${statusStyles[revision.status]}`}>
                              {statusLabels[revision.status] ?? revision.status}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/60">
                            <span>{formatRelative(revision.created_at)}</span>
                            {revision.file_size && <><span>·</span><span>{formatFileSize(revision.file_size)}</span></>}
                            {(revision.comments?.length ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {revision.comments!.length}
                              </span>
                            )}
                            {needsAttention && (
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            )}
                          </div>
                        </div>
                        {/* CTA arrow */}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-[#d4a853] transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* ── Portal shortcut ── */}
              {portalToken && (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] px-4 py-3 flex items-center gap-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-400">Client portal active — {portalToken.client_name}</p>
                    {portalToken.last_viewed_at && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Last viewed {formatRelative(portalToken.last_viewed_at)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPortalUrl}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {portalCopied ? <><Check className="h-3 w-3 text-emerald-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy link</>}
                  </button>
                </div>
              )}
            </TabsContent>


            {/* ── Final Cuts ── */}
            <TabsContent value="final-cuts" className="m-0">
              <VideoDeliverablesTab projectId={project.id} clientName={project.client_name} />
            </TabsContent>

            {/* ── Notes (hidden standalone — merged into Overview) ── */}
            <TabsContent value="notes" className="m-0 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-foreground">Notes</h3>
                  {canEdit && (
                    <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowNoteForm((v) => !v)}>
                      {showNoteForm ? "Cancel" : "+ Add Note"}
                    </Button>
                  )}
                </div>

                {showNoteForm && (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                    />
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write your note…"
                      rows={4}
                      className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowNoteForm(false); setNoteTitle(""); setNoteContent(""); }} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                      <button onClick={handleAddNote} disabled={savingNote} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-60">
                        {savingNote ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : null}
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && !showNoteForm ? (
                  <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                    No notes yet. Use this space to capture creative direction, technical calls, and client feedback.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {notes.map((note) => {
                      const isResolved = resolvedNotes.has(note.id);
                      const comments = noteComments[note.id] ?? [];
                      const showComments = expandedNoteComments.has(note.id);
                      return (
                      <div key={note.id} className={`rounded-xl border bg-card p-4 ${isResolved ? "opacity-70 border-emerald-500/20 bg-emerald-500/[0.02]" : note.pinned ? "border-[#d4a853]/30 bg-[#d4a853]/[0.03]" : "border-border"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {note.title && <h3 className={`text-sm font-semibold ${isResolved ? "line-through text-muted-foreground" : "text-foreground"}`}>{note.title}</h3>}
                            <p className="text-[11px] text-muted-foreground mt-0.5">{formatRelative(note.created_at)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => toggleNoteResolved(note.id)}
                              title={isResolved ? "Mark unresolved" : "Mark resolved"}
                              className={`rounded-lg p-1.5 transition-colors ${isResolved ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleTogglePin(note)}
                              title={note.pinned ? "Unpin" : "Pin to overview"}
                              className={`rounded-lg p-1.5 transition-colors ${ note.pinned ? "text-[#d4a853] hover:bg-[#d4a853]/10" : "text-muted-foreground hover:text-[#d4a853] hover:bg-[#d4a853]/10" }`}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                disabled={deletingNoteId === note.id}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                              >
                                {deletingNoteId === note.id
                                  ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                                  : <X className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{note.content}</p>
                        {isResolved && <p className="mt-2 text-[10px] text-emerald-400/70 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Resolved</p>}
                        {!isResolved && note.pinned && <p className="mt-2 text-[10px] text-[#d4a853]/70 flex items-center gap-1"><Pin className="h-2.5 w-2.5" /> Pinned to overview</p>}

                        {/* Comments */}
                        <div className="mt-3 border-t border-border/50 pt-2.5">
                          <button
                            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => setExpandedNoteComments((s) => { const n = new Set(s); n.has(note.id) ? n.delete(note.id) : n.add(note.id); return n; })}
                          >
                            <MessageSquare className="h-3 w-3" />
                            {comments.length > 0 ? `${comments.length} comment${comments.length > 1 ? "s" : ""}` : "Add comment"}
                          </button>
                          {showComments && (
                            <div className="mt-2 space-y-2">
                              {comments.map((c) => (
                                <div key={c.id} className="flex items-start gap-2 group/cmt">
                                  <div className="mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground shrink-0">Y</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-foreground leading-snug">{c.text}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatRelative(c.at)}</p>
                                  </div>
                                  <button className="opacity-0 group-hover/cmt:opacity-100 text-muted-foreground hover:text-red-400 transition-opacity" onClick={() => deleteNoteComment(note.id, c.id)}><X className="h-3 w-3" /></button>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  className="flex-1 h-7 rounded-lg border border-border bg-muted/30 px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                                  placeholder="Write a comment…"
                                  value={noteCommentDrafts[note.id] ?? ""}
                                  onChange={(e) => setNoteCommentDrafts((d) => ({ ...d, [note.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNoteComment(note.id); } }}
                                />
                                <button className="h-7 rounded-lg bg-muted px-3 text-xs text-foreground hover:bg-accent" onClick={() => addNoteComment(note.id)}>Post</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Client Portal ── */}
            <TabsContent value="client-portal" className="m-0 p-6" onFocus={loadPortalToken}>
              <div onClick={loadPortalToken} className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-sm font-semibold text-foreground">Client Portal</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Share a private link so your client can track progress, review cuts, and download deliverables.</p>
                  </div>
                  {portalToken && (
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-red-400" onClick={handleRevokePortal}>
                      <Trash2 className="h-3 w-3" /> Revoke
                    </Button>
                  )}
                </div>

                {portalLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
                    Loading…
                  </div>
                ) : portalToken ? (
                  <div className="space-y-4">
                    {/* Active portal card */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-semibold text-emerald-400">Portal Active</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{portalToken.client_name}</p>
                          <p className="text-xs text-muted-foreground">{portalToken.client_email}</p>
                        </div>
                        <div className="text-right">
                          {portalToken.last_viewed_at ? (
                            <p className="text-[10px] text-muted-foreground">Last viewed<br/><span className="text-foreground">{new Date(portalToken.last_viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Not yet viewed</p>
                          )}
                        </div>
                      </div>
                      {/* Portal URL + actions */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{portalUrl(portalToken.token)}</span>
                          <button type="button" onClick={handleCopyPortalUrl} className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#d4a853]/10 px-2.5 py-1 text-[11px] font-medium text-[#d4a853] transition hover:bg-[#d4a853]/20">
                            {portalCopied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                        <a
                          href={portalUrl(portalToken.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/20 py-2 text-xs font-medium text-muted-foreground transition hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.05] hover:text-[#d4a853]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Preview as client
                        </a>
                      </div>
                    </div>

                    {/* Deliverables */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-[#d4a853]" /> Deliverables
                      </h4>
                      {deliverables.length === 0 && (
                        <p className="text-xs text-muted-foreground">Add what the client is receiving, e.g. "Feature Cut (4K)" or "3× Social Edits".</p>
                      )}
                      <div className="space-y-1.5">
                        {deliverables.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 group">
                            <button type="button" onClick={() => toggleDeliverable(d.id)} className="shrink-0 transition-transform active:scale-90">
                              {d.done
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                : <Circle className="h-4 w-4 text-muted-foreground hover:text-[#d4a853]" />}
                            </button>
                            <span className={`flex-1 text-sm ${d.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.label}</span>
                            <button type="button" onClick={() => removeDeliverable(d.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={newDeliverable}
                          onChange={(e) => setNewDeliverable(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addDeliverable()}
                          placeholder="Add a deliverable…"
                          className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                        />
                        <button type="button" onClick={addDeliverable} className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80">Add</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* No portal yet */
                  <div className="space-y-4">
                    {!portalShowForm ? (
                      <div className="rounded-xl border border-dashed border-border bg-card/30 p-8 text-center">
                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#d4a853]/10">
                          <Link2 className="h-5 w-5 text-[#d4a853]" />
                        </div>
                        <p className="font-display text-sm font-semibold text-foreground">No portal yet</p>
                        <p className="mt-1 text-xs text-muted-foreground max-w-xs mx-auto">Create a private portal link and send it to your client. One link, active for the life of the project.</p>
                        <Button variant="gold" size="sm" className="mt-4 h-8 gap-1.5 text-xs" onClick={() => setPortalShowForm(true)}>
                          <Link2 className="h-3.5 w-3.5" /> Create client portal
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Create client portal</h4>
                        <div className="space-y-2.5">
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Client name</label>
                            <input
                              type="text"
                              value={portalClientName}
                              onChange={(e) => setPortalClientName(e.target.value)}
                              placeholder="e.g. Alex Johnson"
                              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Client email</label>
                            <input
                              type="email"
                              value={portalClientEmail}
                              onChange={(e) => setPortalClientEmail(e.target.value)}
                              placeholder="client@example.com"
                              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">An invite email will be sent to the client when the portal is created.</p>
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={() => setPortalShowForm(false)} className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                          <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCreatePortal} disabled={portalCreating}>
                            {portalCreating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Send className="h-3.5 w-3.5" />}
                            {portalCreating ? "Creating…" : "Create & send invite"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the project's title, description, status, and progress.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Project title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} placeholder="Project description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-client-name">Client name</Label>
                <Input id="edit-client-name" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} placeholder="e.g. Volta EV" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-client-email">Client email</Label>
                <Input id="edit-client-email" type="email" value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} placeholder="client@example.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div
                className="flex flex-wrap gap-1.5 min-h-[36px] w-full rounded-md border border-border bg-input px-3 py-1.5 cursor-text"
              >
                {editTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-[#d4a853]/15 border border-[#d4a853]/30 px-2 py-0.5 text-[11px] font-medium text-[#d4a853]">
                    {tag}
                    <button type="button" onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="hover:text-red-400 transition-colors">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <input
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={handleEditTagKeyDown}
                  onBlur={() => { if (editTagInput.trim()) { addEditTag(editTagInput); setEditTagInput(""); } }}
                  placeholder={editTags.length === 0 ? "Add tags (Enter or comma)" : ""}
                  className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none py-0.5"
                />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Progress is automatic, driven by phases &amp; shot list</span>
              <span className="font-mono text-sm font-semibold text-[#d4a853]">{computedProgress}%</span>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  await createProjectTemplate({ name: editTitle.trim() || title, description: editDescription, type: project.type, tasks: [], deliverables: [], tags: editTags });
                  toast.success("Template saved");
                } catch { toast.error("Failed to save template"); }
              }}
            >
              Save as template
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={handleSaveProject}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member</DialogTitle>
            <DialogDescription>Invite a team member or client to collaborate on this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-name">Name</Label>
              <Input id="member-name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-email">Email</Label>
              <Input id="member-email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} placeholder="Email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-role">Role</Label>
              <select id="member-role" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value as ProjectMember["role"])} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
                {PROJECT_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowMemberDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={handleAddMember}>Add member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShotDialog} onOpenChange={setShowShotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add shot</DialogTitle>
            <DialogDescription>Add a new shot to the active shot list for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Shot number — stepper */}
            <div className="space-y-1.5">
              <Label>Shot number</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewShotNumber((n) => Math.max(1, n - 1))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold text-foreground transition hover:bg-accent active:scale-95"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={newShotNumber}
                  onChange={(e) => setNewShotNumber(Math.max(1, Number(e.target.value)))}
                  className="h-10 w-full rounded-lg border border-border bg-input px-3 text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setNewShotNumber((n) => n + 1)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-lg font-bold text-foreground transition hover:bg-accent active:scale-95"
                >
                  +
                </button>
              </div>
              {/* Quick-pick row */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.from({ length: Math.min(12, (shotList?.items?.length ?? 0) + 6) }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNewShotNumber(n)}
                    className={`h-7 w-7 rounded-md border text-[11px] font-medium transition active:scale-95 ${
                      newShotNumber === n
                        ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-scene">Scene</Label>
              <Input id="shot-scene" value={newShotScene} onChange={(e) => setNewShotScene(e.target.value)} placeholder="Scene 1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-description">Description</Label>
              <Textarea id="shot-description" value={newShotDescription} onChange={(e) => setNewShotDescription(e.target.value)} rows={3} placeholder="Describe the shot." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shot-location">Location</Label>
                <Input id="shot-location" value={newShotLocation} onChange={(e) => setNewShotLocation(e.target.value)} placeholder="e.g. Studio A" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shot-lens">Lens</Label>
                <Input id="shot-lens" value={newShotLens} onChange={(e) => setNewShotLens(e.target.value)} placeholder="e.g. 50mm" />
              </div>
              <div className="space-y-1.5">
                <Label>Shot type</Label>
                <select className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:outline-none" value={newShotType} onChange={(e) => setNewShotType(e.target.value as ShotListItem["shot_type"])}>
                  {["wide","medium","close_up","extreme_close_up","over_the_shoulder","aerial","pov","two_shot","insert"].map((t) => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Camera movement</Label>
                <select className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground focus:outline-none" value={newShotMovement} onChange={(e) => setNewShotMovement(e.target.value as ShotListItem["camera_movement"])}>
                  {["static","pan","tilt","dolly","handheld","crane","steadicam","zoom"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowShotDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={handleAddShot} disabled={addingShotToDb}>
              {addingShotToDb ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black mr-1.5" /> : null}
              Add shot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFrameDialog} onOpenChange={setShowFrameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add storyboard frame</DialogTitle>
            <DialogDescription>Add a new visual frame to the project storyboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="frame-title">Title *</Label>
              <Input id="frame-title" value={newFrameTitle} onChange={(e) => setNewFrameTitle(e.target.value)} placeholder="e.g. Hero walks into light" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frame-description">Description *</Label>
              <Textarea id="frame-description" value={newFrameDescription} onChange={(e) => setNewFrameDescription(e.target.value)} rows={3} placeholder="Describe what happens in this frame." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="frame-camera">Camera Angle</Label>
                <Input id="frame-camera" value={newFrameCameraAngle} onChange={(e) => setNewFrameCameraAngle(e.target.value)} placeholder="e.g. Wide / Eye level" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="frame-duration">Shot Duration</Label>
                <Input id="frame-duration" value={newFrameDuration} onChange={(e) => setNewFrameDuration(e.target.value)} placeholder="00:00:05" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frame-mood">Mood / Feel</Label>
              <Input id="frame-mood" value={newFrameMood} onChange={(e) => setNewFrameMood(e.target.value)} placeholder="e.g. Tense, joyful, cinematic…" />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowFrameDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={handleAddFrame} disabled={addingFrame}>
              {addingFrame ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black mr-1.5" /> : null}
              Add frame
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Frame dialog ── */}
      <Dialog open={!!editingFrame} onOpenChange={(open) => { if (!open) setEditingFrame(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit frame</DialogTitle>
            <DialogDescription>Update this storyboard frame&apos;s details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={editFrameForm.title ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, title: e.target.value }))} placeholder="Frame title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={editFrameForm.description ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the shot." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Camera Angle</Label>
                <Input value={editFrameForm.camera_angle ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, camera_angle: e.target.value }))} placeholder="e.g. Wide / Eye level" />
              </div>
              <div className="space-y-1.5">
                <Label>Shot Duration</Label>
                <Input value={editFrameForm.shot_duration ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, shot_duration: e.target.value }))} placeholder="00:00:05" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mood / Feel</Label>
              <Input value={editFrameForm.mood ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, mood: e.target.value }))} placeholder="e.g. Tense, cinematic…" />
            </div>
            <div className="space-y-1.5">
              <Label>Production Notes</Label>
              <Textarea value={editFrameForm.notes ?? ""} onChange={(e) => setEditFrameForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes for this frame." />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setEditingFrame(null)}>Cancel</Button>
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={saveEditFrame} disabled={savingEditFrame}>
              {savingEditFrame ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black mr-1.5" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload revision</DialogTitle>
            <DialogDescription>Upload a new cut and keep it attached to this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="revision-title">Title</Label>
              <Input id="revision-title" value={newRevisionTitle} onChange={(e) => setNewRevisionTitle(e.target.value)} placeholder="Director's Cut v1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision-description">Description</Label>
              <Textarea id="revision-description" value={newRevisionDescription} onChange={(e) => setNewRevisionDescription(e.target.value)} rows={4} placeholder="Add context for the revision." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revision-file">File</Label>
              <input id="revision-file" type="file" accept="video/*" onChange={(e) => setNewRevisionFile(e.target.files?.[0] ?? null)} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setShowRevisionDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" className="w-full sm:w-auto" onClick={handleUploadRevision}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BurstRenderer particles={burst.particles} />
    </div>
  );
}
