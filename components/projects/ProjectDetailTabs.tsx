"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import Image from "next/image";
import { formatDate, formatRelative, formatFileSize, getProgressColor, getInitials, PROJECT_TYPE_LABELS } from "@/lib/utils";
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
import { ArrowLeft, Calendar, Edit3, MoreHorizontal, CheckCircle2, Circle, MessageSquare, Upload, Pin, Clock, User, Film, ListChecks, Play, Pause, Volume2, VolumeX, Maximize, Download, X, Save, ScrollText } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { Project, ProjectMember, ProjectNote, Revision, ShotList, StoryboardFrame, ShotListItem, ProjectRole } from "@/types";
import { updateProject, updateShotListItem } from "@/lib/supabase/queries";
import { CrewTab } from "@/components/projects/tabs/CrewTab";
import { LocationsTab } from "@/components/projects/tabs/LocationsTab";
import { WrapNotesTab } from "@/components/projects/tabs/WrapNotesTab";
import { FinanceTab } from "@/components/projects/tabs/FinanceTab";
import { ProductionDocsTab } from "@/components/projects/tabs/ProductionDocsTab";
import { ScriptsTab } from "@/components/projects/tabs/ScriptsTab";
import { saveVideoBlob, getOrFetchUrl, cacheUrl, addRevisionMeta } from "@/lib/revision-store";
import type { RevisionMeta } from "@/lib/revision-store";

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
  const [progressValue, setProgressValue] = useState(project.progress ?? 0);
  const [shotList, setShotList] = useState<ShotList | null>(initialShotList);
  const [storyboardFrames, setStoryboardFrames] = useState<StoryboardFrame[]>(initialStoryboardFrames);
  const [revisions, setRevisions] = useState<Revision[]>(initialRevisions);
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editDescription, setEditDescription] = useState(description);
  const [editStatus, setEditStatus] = useState<Project["status"]>(status);
  const [editProgress, setEditProgress] = useState(progressValue);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<ProjectMember["role"]>("Editor");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  const [showShotDialog, setShowShotDialog] = useState(false);
  const [newShotDescription, setNewShotDescription] = useState("");
  const [newShotNumber, setNewShotNumber] = useState(shotList?.items?.length ? shotList.items.length + 1 : 1);
  const [newShotScene, setNewShotScene] = useState("");

  const [showFrameDialog, setShowFrameDialog] = useState(false);
  const [newFrameTitle, setNewFrameTitle] = useState("");
  const [newFrameDescription, setNewFrameDescription] = useState("");

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

  // ── Inline video player state ──
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerDuration, setPlayerDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const completedShots = shotList?.items?.filter((item) => item.is_complete).length ?? 0;
  const totalShots = shotList?.items?.length ?? 0;

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
          status: "pending" as const,
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

  const handleAddShot = () => {
    if (!newShotDescription.trim()) {
      toast.error("Please describe the shot.");
      return;
    }

    const nextItem: ShotListItem = {
      id: `sli_${Math.random().toString(36).slice(2)}`,
      shot_list_id: shotList?.id ?? `sl_${Math.random().toString(36).slice(2)}`,
      shot_number: newShotNumber,
      scene: newShotScene || `Scene ${newShotNumber}`,
      location: "TBD",
      description: newShotDescription.trim(),
      shot_type: "medium",
      camera_movement: "handheld",
      is_complete: false,
    };

    const nextShotList = shotList
      ? { ...shotList, items: [...(shotList.items ?? []), nextItem] }
      : {
          id: `sl_${Math.random().toString(36).slice(2)}`,
          project_id: project.id,
          title: "New shot list",
          description: "Auto-generated shot list.",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [nextItem],
        };

    setShotList(nextShotList);
    setShowShotDialog(false);
    setNewShotDescription("");
    setNewShotNumber((prev) => prev + 1);
    setNewShotScene("");
    toast.success("Shot added to the list.");
  };

  const handleAddFrame = () => {
    if (!newFrameTitle.trim() || !newFrameDescription.trim()) {
      toast.error("Please add a title and description for the frame.");
      return;
    }

    const nextFrame: StoryboardFrame = {
      id: `sb_${Math.random().toString(36).slice(2)}`,
      project_id: project.id,
      frame_number: storyboardFrames.length + 1,
      title: newFrameTitle.trim(),
      description: newFrameDescription.trim(),
      image_url: `https://source.unsplash.com/1200x675/?cinematic,${encodeURIComponent(project.title)}`,
      shot_duration: "00:00:05",
      camera_angle: "Wide — Eye level",
      notes: "Created for the storyboard.",
      created_at: new Date().toISOString(),
    };

    setStoryboardFrames((prev) => [nextFrame, ...prev]);
    setShowFrameDialog(false);
    setNewFrameTitle("");
    setNewFrameDescription("");
    toast.success("Storyboard frame created.");
  };

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
      status: "pending",
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
    toast.success("Revision uploaded — it will persist across navigation.");
  };

  const handleSaveProject = async () => {
    const updates = {
      title: editTitle.trim() || title,
      description: editDescription,
      status: editStatus,
      progress: editProgress,
    };
    // Optimistic update
    setTitle(updates.title);
    setDescription(updates.description);
    setStatus(updates.status);
    setProgressValue(updates.progress);
    setShowEditDialog(false);
    try {
      await updateProject(project.id, updates);
      toast.success("Project details updated.");
    } catch {
      toast.error("Failed to save — changes may not persist.");
    }
  };

  const openEditDialog = () => {
    setEditTitle(title);
    setEditDescription(description);
    setEditStatus(status);
    setEditProgress(progressValue);
    setShowEditDialog(true);
  };

  const toggleShotComplete = async (shotId: string) => {
    if (!shotList?.items) return;
    const item = shotList.items.find((i) => i.id === shotId);
    if (!item) return;
    const newVal = !item.is_complete;
    // Optimistic update
    setShotList({
      ...shotList,
      items: shotList.items.map((i) => i.id === shotId ? { ...i, is_complete: newVal } : i),
    });
    try {
      await updateShotListItem(shotId, { is_complete: newVal });
    } catch {
      // Only revert + warn for real DB IDs (UUIDs), not locally-generated mock IDs
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

  const handleAddRevisionComment = (revisionId: string) => {
    const draft = commentDrafts[revisionId]?.trim();
    if (!draft) {
      toast.error("Add a comment before submitting.");
      return;
    }

    const nextComment = {
      id: `cmt_${Math.random().toString(36).slice(2)}`,
      revision_id: revisionId,
      author_id: "user_001",
      author: {
        id: "user_001",
        full_name: "You",
        email: "you@example.com",
        avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
        role: "editor",
        created_at: new Date().toISOString(),
      },
      content: draft,
      timestamp_seconds: 0,
      created_at: new Date().toISOString(),
    };

    setRevisions((prev) =>
      prev.map((revision) =>
        revision.id === revisionId
          ? { ...revision, comments: [...(revision.comments ?? []), nextComment] }
          : revision
      )
    );
    setCommentDrafts((prev) => ({ ...prev, [revisionId]: "" }));
    toast.success("Comment added.");
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
    } catch {
      // Keep local preview but warn it won't persist
      toast.error("Couldn't save to cloud — cover will reset on refresh.");
    }
  };

  const handleRefreshCover = async () => {
    const { getCinematicGradient, CINEMATIC_COUNT } = await import("@/lib/cinematic-images");
    const variant = Math.floor(Math.random() * CINEMATIC_COUNT);
    const gradient = getCinematicGradient(project.title, variant);
    // Store variant so the card picks it up, but don't persist a data-URI to DB
    localStorage.setItem(`cf_thumb_${project.id}`, `__variant:${variant}`);
    toast.success("Cover style refreshed — upload a photo to make it permanent.");
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
                <Badge variant="outline">{status}</Badge>
                <Badge variant="outline">{PROJECT_TYPE_LABELS[project.type]}</Badge>
                {project.tags?.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
              <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
              {project.client_name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{project.client_name}</p>
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
                <span className="text-xs font-medium text-foreground">{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-1.5" indicatorClassName={getProgressColor(progressValue)} />
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

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="overview" className="flex h-full flex-col">
          <div className="border-b border-border">
            <div className="overflow-x-auto no-scrollbar">
              <TabsList className="flex h-10 w-max min-w-full bg-transparent gap-0 rounded-none border-b-0 p-0 px-4 sm:px-6">
              {[
                { value: "overview",     label: "Overview" },
                { value: "shot-list",    label: `Shot List ${totalShots ? `(${completedShots}/${totalShots})` : ""}` },
                { value: "storyboard",   label: "Storyboard" },
                { value: "scripts",      label: "Scripts" },
                { value: "docs",         label: "Prod. Docs" },
                { value: "crew",         label: "Crew" },
                { value: "locations",    label: "Locations" },
                { value: "wrap",         label: "Wrap Notes" },
                { value: "revisions",    label: `Revisions ${revisions.length ? `(${revisions.length})` : ""}` },
                { value: "notes",        label: `Notes ${notes.length ? `(${notes.length})` : ""}` },
                ...(isAdmin ? [{ value: "finance", label: "Finance 🔒" }] : []),
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-none data-[state=active]:border-[#d4a853] data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                            <div className="mt-0.5 shrink-0">
                              {shot.is_complete ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
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
            </TabsContent>

            <TabsContent value="shot-list" className="m-0 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{shotList?.title || "Shot List"}</h3>
                  {shotList && <p className="text-xs text-muted-foreground mt-0.5">{shotList.description || "Plan your coverage and camera choreography."}</p>}
                </div>
                <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowShotDialog(true)}>
                  + Add Shot
                </Button>
              </div>

              {!shotList ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="font-display font-semibold">No shot list yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first shot list to start planning your shoot.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        {['#', 'Description', 'Location', 'Type', 'Movement', 'Lens', ''].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shotList.items?.map((shot) => (
                        <tr key={shot.id} className={`group bg-card transition-colors hover:bg-accent/30 ${shot.is_complete ? "opacity-60" : ""}`}>
                          <td className="px-4 py-3 w-8">
                            <div className="flex items-center gap-2">
                              {shot.is_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span className="font-mono text-xs text-muted-foreground">{shot.shot_number}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-sm text-foreground leading-snug">{shot.description}</p>
                            {shot.notes && <p className="mt-0.5 text-xs text-muted-foreground italic truncate">{shot.notes}</p>}
                          </td>
                          <td className="px-4 py-3"><span className="text-xs text-muted-foreground whitespace-nowrap">{shot.location || "—"}</span></td>
                          <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] whitespace-nowrap">{shot.shot_type.replace("_", " ")}</Badge></td>
                          <td className="px-4 py-3"><span className="text-xs text-muted-foreground capitalize">{shot.camera_movement}</span></td>
                          <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{shot.lens || "—"}</span></td>
                          <td className="px-4 py-3 w-8">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleShotComplete(shot.id);
                              }}
                            >
                              {shot.is_complete ? "Undo" : "Complete"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

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
                    <div key={frame.id} className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-[#d4a853]/20">
                      <div className="relative aspect-video overflow-hidden bg-muted">
                        {frame.image_url ? (
                          <Image src={frame.image_url} alt={frame.title || `Frame ${frame.frame_number}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">No image</div>
                        )}
                        <div className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-sm">{String(frame.frame_number).padStart(2, "0")}</div>
                        {frame.shot_duration && <div className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">{frame.shot_duration}</div>}
                      </div>
                      <div className="p-3">
                        {frame.title && <p className="text-xs font-semibold text-foreground mb-1">{frame.title}</p>}
                        {frame.description && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{frame.description}</p>}
                        {frame.camera_angle && <p className="mt-1.5 text-[10px] text-muted-foreground">{frame.camera_angle}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Scripts (file-upload focused) ── */}
            <TabsContent value="scripts" className="m-0 flex h-full flex-col overflow-hidden">
              <ScriptsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Production Docs ── */}
            <TabsContent value="docs" className="m-0 flex h-full flex-col overflow-hidden">
              <ProductionDocsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Crew ── */}
            <TabsContent value="crew" className="m-0 flex h-full flex-col overflow-hidden">
              <CrewTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Locations ── */}
            <TabsContent value="locations" className="m-0 flex h-full flex-col overflow-hidden">
              <LocationsTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Wrap Notes ── */}
            <TabsContent value="wrap" className="m-0 flex h-full flex-col overflow-hidden">
              <WrapNotesTab projectId={project.id} canEdit={canEdit} />
            </TabsContent>

            {/* ── Finance (admin only) ── */}
            {isAdmin && (
              <TabsContent value="finance" className="m-0 flex h-full flex-col overflow-hidden">
                <FinanceTab projectId={project.id} isAdmin={isAdmin} />
              </TabsContent>
            )}

            <TabsContent value="revisions" className="m-0 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-foreground">Revisions</h3>
                <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowRevisionDialog(true)}>
                  <Upload className="h-3.5 w-3.5" />
                  Upload revision
                </Button>
              </div>

              {revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="font-display font-semibold">No revisions uploaded yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">Upload a cut to review and leave frame-accurate comments.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revisions.map((revision) => {
                    const comments = revision.comments ?? [];
                    const isActive = activeRevisionId === revision.id;
                    const hasVideo = !!revision.file_url;
                    const statusStyles = {
                      pending: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                      approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                      changes_requested: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                      rejected: "bg-red-500/10 text-red-400 border-red-500/20",
                    };
                    const statusLabels = {
                      pending: "Pending review",
                      approved: "Approved",
                      changes_requested: "Changes requested",
                      rejected: "Rejected",
                    };

                    return (
                      <div key={revision.id} className="overflow-hidden rounded-xl border border-border bg-card">
                        {/* ── Video player (shown when active) ── */}
                        {isActive && hasVideo && (
                          <div className="relative bg-black">
                            <video
                              ref={videoRef}
                              src={revision.file_url}
                              className="max-h-[420px] w-full object-contain"
                              onPlay={() => setIsPlaying(true)}
                              onPause={() => setIsPlaying(false)}
                              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                              onLoadedMetadata={(e) => setPlayerDuration(e.currentTarget.duration)}
                            />
                            {/* Controls overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-8">
                              <div className="mb-2 flex items-center gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={playerDuration || 0}
                                  value={currentTime}
                                  onChange={(e) => {
                                    const t = parseFloat(e.target.value);
                                    setCurrentTime(t);
                                    if (videoRef.current) videoRef.current.currentTime = t;
                                  }}
                                  className="flex-1 h-1 cursor-pointer accent-[#d4a853]"
                                />
                                <span className="text-[11px] text-white/60 tabular-nums">
                                  {formatTime(currentTime)} / {formatTime(playerDuration)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { if (videoRef.current) { isPlaying ? videoRef.current.pause() : videoRef.current.play(); } }}
                                    className="rounded-lg p-2 hover:bg-white/15 transition-all duration-150 active:scale-90"
                                  >
                                    {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                                  </button>
                                  <button
                                    onClick={() => { setIsMuted((p) => !p); if (videoRef.current) videoRef.current.muted = !isMuted; }}
                                    className="rounded-lg p-1.5 hover:bg-white/15 transition-all duration-150 active:scale-90"
                                  >
                                    {isMuted ? <VolumeX className="h-4 w-4 text-white" /> : <Volume2 className="h-4 w-4 text-white" />}
                                  </button>
                                  <input
                                    type="range" min={0} max={1} step={0.1} value={volume}
                                    onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) videoRef.current.volume = v; }}
                                    className="w-16 h-1 cursor-pointer accent-[#d4a853]"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { const a = document.createElement("a"); a.href = revision.file_url!; a.download = revision.title; a.click(); }}
                                    className="rounded-lg p-2 hover:bg-white/15 transition-all duration-150 active:scale-90"
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4 text-white" />
                                  </button>
                                  <button
                                    onClick={() => videoRef.current?.requestFullscreen()}
                                    className="rounded-lg p-2 hover:bg-white/15 transition-all duration-150 active:scale-90"
                                    title="Fullscreen"
                                  >
                                    <Maximize className="h-4 w-4 text-white" />
                                  </button>
                                  <button
                                    onClick={() => setActiveRevisionId(null)}
                                    className="rounded-lg p-2 hover:bg-white/15 transition-all duration-150 active:scale-90"
                                    title="Close player"
                                  >
                                    <X className="h-4 w-4 text-white" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Revision header ── */}
                        <div className="flex items-start gap-4 p-4">
                          <button
                            type="button"
                            disabled={!hasVideo}
                            onClick={() => {
                              setActiveRevisionId(isActive ? null : revision.id);
                              setCurrentTime(0);
                              setIsPlaying(false);
                            }}
                            className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center transition-all duration-200 ${hasVideo ? "cursor-pointer hover:ring-2 hover:ring-[#d4a853]/50" : "cursor-default opacity-50"}`}
                          >
                            {revision.thumbnail_url ? (
                              <Image src={revision.thumbnail_url} alt={revision.title} fill className="object-cover" sizes="112px" unoptimized />
                            ) : null}
                            {hasVideo && !isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <Play className="h-6 w-6 text-white drop-shadow" />
                              </div>
                            )}
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center bg-[#d4a853]/20 ring-2 ring-[#d4a853]/60">
                                <Pause className="h-5 w-5 text-[#d4a853]" />
                              </div>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-muted-foreground">v{revision.version_number}</span>
                                  <h4 className="text-sm font-semibold text-foreground">{revision.title}</h4>
                                </div>
                                {revision.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{revision.description}</p>}
                              </div>
                              <Badge variant="outline" className={`shrink-0 text-[10px] ${statusStyles[revision.status]}`}>{statusLabels[revision.status]}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{formatRelative(revision.created_at)}</span>
                              {revision.file_size && <><span>·</span><span>{formatFileSize(revision.file_size)}</span></>}
                              {!hasVideo && <span className="text-amber-400">· Video not available (re-upload to restore)</span>}
                              {comments.length > 0 && (
                                <><span>·</span>
                                  <span className="flex items-center gap-0.5">
                                    <MessageSquare className="h-2.5 w-2.5" />{comments.length} comments
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ── Comments ── */}
                        <div className="border-t border-border">
                          {comments.length > 0 ? (
                            comments.map((comment) => (
                              <div key={comment.id} className="flex gap-3 border-b border-border/50 px-4 py-3 last:border-0">
                                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                                  <AvatarImage src={comment.author?.avatar_url ?? ""} alt={comment.author?.full_name ?? comment.author_id ?? "User"} />
                                  <AvatarFallback className="text-[9px]">{getInitials(comment.author?.full_name ?? comment.author_id ?? "")}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-medium text-foreground">{comment.author?.full_name ?? comment.author_id ?? "Unknown"}</span>
                                    {comment.timestamp_seconds != null && (
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        {Math.floor(comment.timestamp_seconds / 60)}:{String(comment.timestamp_seconds % 60).padStart(2, "0")}
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground">{formatRelative(comment.created_at)}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{comment.content}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-4 text-sm text-muted-foreground">No comments yet — leave feedback on this revision.</div>
                          )}
                          <div className="flex gap-3 px-4 py-3 bg-muted/30">
                            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                              <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80" alt="You" />
                              <AvatarFallback className="text-[9px]">KG</AvatarFallback>
                            </Avatar>
                            <input
                              type="text"
                              value={commentDrafts[revision.id] ?? ""}
                              onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [revision.id]: e.target.value }))}
                              placeholder="Add a comment..."
                              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddRevisionComment(revision.id);
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="gold"
                              size="sm"
                              onClick={() => handleAddRevisionComment(revision.id)}
                            >
                              Post
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="m-0 p-6">
              <div className="space-y-4">
                {notes.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
                    No notes yet. Use this space to capture creative direction, technical calls, and client feedback.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {notes.map((note) => (
                      <div key={note.id} className="rounded-3xl border border-border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">{note.title || "Note"}</h3>
                            <p className="text-[11px] text-muted-foreground">{formatRelative(note.created_at)}</p>
                          </div>
                          {note.pinned && <Badge variant="outline">Pinned</Badge>}
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">{note.content}</p>
                      </div>
                    ))}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <select id="edit-status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Project["status"])} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground">
                  <option value="draft">Draft</option>
                  <option value="active">In production</option>
                  <option value="review">In review</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-progress">Progress</Label>
                <Input id="edit-progress" type="number" min={0} max={100} value={editProgress} onChange={(e) => setEditProgress(Number(e.target.value))} placeholder="Progress" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSaveProject}>Save</Button>
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
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowMemberDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAddMember}>Add member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShotDialog} onOpenChange={setShowShotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shot</DialogTitle>
            <DialogDescription>Add a new shot to the active shot list for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="shot-number">Shot number</Label>
              <Input id="shot-number" type="number" value={newShotNumber} onChange={(e) => setNewShotNumber(Number(e.target.value))} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-scene">Scene</Label>
              <Input id="shot-scene" value={newShotScene} onChange={(e) => setNewShotScene(e.target.value)} placeholder="Scene 1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shot-description">Description</Label>
              <Textarea id="shot-description" value={newShotDescription} onChange={(e) => setNewShotDescription(e.target.value)} rows={4} placeholder="Describe the shot." />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowShotDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAddShot}>Add shot</Button>
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
              <Label htmlFor="frame-title">Title</Label>
              <Input id="frame-title" value={newFrameTitle} onChange={(e) => setNewFrameTitle(e.target.value)} placeholder="Frame title" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frame-description">Description</Label>
              <Textarea id="frame-description" value={newFrameDescription} onChange={(e) => setNewFrameDescription(e.target.value)} rows={4} placeholder="Describe the shot and mood." />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFrameDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleAddFrame}>Add frame</Button>
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
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRevisionDialog(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleUploadRevision}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
