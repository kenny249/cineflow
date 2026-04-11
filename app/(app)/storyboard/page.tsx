"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot, Camera, Check, ChevronRight, Clapperboard, Clock, Copy, Film,
  ImageIcon, Layers, Link2, Loader2, MessageSquare, Pencil, Plus,
  Send, Share2, Sparkles, Trash2, Upload, X, ZoomIn,
} from "lucide-react";
import { toast } from "sonner";
import {
  getProjects,
  getStoryboardFrames,
  createStoryboardFrame,
  updateStoryboardFrame,
  deleteStoryboardFrame,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { Project, StoryboardFrame } from "@/types";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const SHOT_TYPES = ["wide", "medium", "close_up", "extreme_close_up", "overhead", "drone", "pov", "other"] as const;
const MOODS = ["Cinematic", "Golden Hour", "Moody", "High Energy", "Intimate", "Epic", "Tense", "Dreamy", "Gritty", "Clean"];

function formatShotType(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── FrameCard ────────────────────────────────────────────────────────────────

function FrameCard({
  frame,
  index,
  onUpdate,
  onDelete,
  onImageUpload,
  uploading,
}: {
  frame: StoryboardFrame;
  index: number;
  onUpdate: (id: string, updates: Partial<StoryboardFrame>) => void;
  onDelete: (id: string) => void;
  onImageUpload: (id: string, file: File) => void;
  uploading: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(frame.title ?? "");
  const [localDesc, setLocalDesc] = useState(frame.description ?? "");
  const [localNotes, setLocalNotes] = useState(frame.notes ?? "");
  const [localDuration, setLocalDuration] = useState(frame.shot_duration ?? "00:00:05");
  const [localAngle, setLocalAngle] = useState(frame.camera_angle ?? "Wide / Eye level");
  const [localMood, setLocalMood] = useState(frame.mood ?? "");
  const [lightbox, setLightbox] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveEdits = () => {
    onUpdate(frame.id, {
      title: localTitle,
      description: localDesc,
      notes: localNotes,
      shot_duration: localDuration,
      camera_angle: localAngle,
      mood: localMood,
    });
    setEditing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onImageUpload(frame.id, file);
  };

  return (
    <>
      {lightbox && frame.image_url && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <img
            src={frame.image_url}
            alt={frame.title}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
          />
          <button
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-200 hover:border-[#d4a853]/30 hover:shadow-[0_0_24px_rgba(212,168,83,0.08)]">
        {/* Frame number badge */}
        <div className="absolute left-3 top-3 z-10 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-black/60 px-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d4a853] backdrop-blur-sm">
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(frame.id)}
          className="absolute right-3 top-3 z-10 hidden rounded-lg bg-black/60 p-1.5 text-zinc-400 backdrop-blur-sm transition-colors hover:text-red-400 group-hover:flex"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Image zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="relative aspect-video w-full overflow-hidden bg-zinc-900"
        >
          {frame.image_url ? (
            <>
              <img
                src={frame.image_url}
                alt={frame.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <button
                onClick={() => setLightbox(true)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100"
              >
                <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-2 right-2 hidden rounded-lg bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-black/80 group-hover:flex"
              >
                Replace
              </button>
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-600 transition-colors hover:text-zinc-400"
            >
              {uploading === frame.id ? (
                <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <span className="text-[11px] font-medium">Drop image or click to upload</span>
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageUpload(frame.id, f);
            }}
          />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-4">
          {editing ? (
            <div className="space-y-2.5">
              <input
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                placeholder="Frame title"
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground focus:border-[#d4a853]/50 focus:outline-none"
              />
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                placeholder="Visual description…"
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-[#d4a853]/50 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={localDuration}
                  onChange={(e) => setLocalDuration(e.target.value)}
                  placeholder="00:00:05"
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
                <input
                  value={localAngle}
                  onChange={(e) => setLocalAngle(e.target.value)}
                  placeholder="Camera angle"
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setLocalMood(m)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all",
                      localMood === m
                        ? "bg-[#d4a853] text-black"
                        : "border border-border text-muted-foreground hover:border-[#d4a853]/40"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Director notes…"
                rows={2}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveEdits}
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#e0b55e]"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight text-foreground">
                  {frame.title || <span className="italic text-muted-foreground">Untitled frame</span>}
                </h3>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {frame.description && (
                <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{frame.description}</p>
              )}
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
                {frame.shot_duration && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {frame.shot_duration}
                  </span>
                )}
                {frame.camera_angle && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    {frame.camera_angle}
                  </span>
                )}
                {frame.mood && (
                  <span className="rounded-full bg-[#d4a853]/10 px-2 py-0.5 text-[10px] font-medium text-[#d4a853]">
                    {frame.mood}
                  </span>
                )}
              </div>
              {frame.notes && (
                <p className="mt-2 line-clamp-2 text-[11px] italic text-zinc-500">{frame.notes}</p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StoryboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [frames, setFrames] = useState<StoryboardFrame[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Add frame form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState("00:00:05");
  const [newAngle, setNewAngle] = useState("Wide / Eye level");
  const [newMood, setNewMood] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newShotType, setNewShotType] = useState("wide");

  const selectedProject = projects.find((p) => p.id === projectId);

  // Load projects
  useEffect(() => {
    getProjects()
      .then((data) => {
        setProjects(data || []);
        if (data?.length) setProjectId(data[0].id);
      })
      .catch(() => toast.error("Failed to load projects"))
      .finally(() => setLoading(false));
  }, []);

  // Load frames when project changes
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getStoryboardFrames(projectId)
      .then((data) => setFrames(data || []))
      .catch(() => toast.error("Failed to load frames"))
      .finally(() => setLoading(false));
    setShareUrl(null);
  }, [projectId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleUpdate = useCallback(async (id: string, updates: Partial<StoryboardFrame>) => {
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    try {
      await updateStoryboardFrame(id, updates);
    } catch {
      toast.error("Failed to save");
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
    try {
      await deleteStoryboardFrame(id);
    } catch {
      toast.error("Failed to delete");
    }
  }, []);

  const handleImageUpload = useCallback(
    async (frameId: string, file: File) => {
      setUploadingId(frameId);
      try {
        const supabase = createClient();
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `storyboard/${projectId}/${frameId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("storyboard-images")
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const {
          data: { publicUrl },
        } = supabase.storage.from("storyboard-images").getPublicUrl(path);
        await handleUpdate(frameId, { image_url: publicUrl });
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadingId(null);
      }
    },
    [projectId, handleUpdate]
  );

  const handleAddFrame = async () => {
    if (!projectId || !newTitle.trim()) return;
    try {
      const frame = await createStoryboardFrame({
        project_id: projectId,
        frame_number: frames.length + 1,
        title: newTitle,
        description: newDesc,
        shot_duration: newDuration,
        camera_angle: newAngle,
        shot_type: newShotType,
        mood: newMood,
        notes: newNotes,
      });
      setFrames((prev) => [...prev, frame]);
      setAddOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewDuration("00:00:05");
      setNewAngle("Wide / Eye level");
      setNewMood("");
      setNewNotes("");
      setNewShotType("wide");
      toast.success("Frame added");
    } catch {
      toast.error("Failed to add frame");
    }
  };

  const handleShare = async () => {
    if (!projectId || frames.length === 0) {
      toast.error("Add at least one frame first");
      return;
    }
    setSharing(true);
    try {
      const res = await fetch("/api/storyboard-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          title: selectedProject?.title,
          frames,
        }),
      });
      const { token, error } = await res.json();
      if (error) throw new Error(error);
      const url = `${window.location.origin}/board/${token}`;
      setShareUrl(url);
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link copied to clipboard!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  const sendChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          system: `You are a creative director AI assistant inside CineFlow. The current project is "${selectedProject?.title ?? "Untitled"}". There are currently ${frames.length} storyboard frames. Help the user brainstorm ideas, describe shots, rewrite descriptions, suggest camera techniques, and build compelling visual stories. Keep responses concise and cinematically focused.`,
        }),
      });
      const { text, error } = await res.json();
      if (error) throw new Error(error);
      setChatMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Claude error");
    } finally {
      setChatLoading(false);
    }
  };

  const generateFrames = async (brief: string) => {
    if (!projectId || !brief.trim()) return;
    setGenerating(true);
    const userMsg: ChatMessage = {
      role: "user",
      content: `Generate a storyboard for: "${brief}". Return 5-6 frames as a JSON array only.`,
    };
    setChatMessages((prev) => [...prev, userMsg]);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Generate a professional storyboard for a video production with this brief: "${brief}". Return ONLY a JSON array of 5-6 frames with fields: title, description, shot_type, camera_angle, shot_duration, mood, notes. No explanation text before or after.`,
            },
          ],
        }),
      });
      const { text, error } = await res.json();
      if (error) throw new Error(error);

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const generated: Partial<StoryboardFrame>[] = JSON.parse(jsonMatch[0]);

      const created: StoryboardFrame[] = [];
      for (let i = 0; i < generated.length; i++) {
        const g = generated[i];
        const frame = await createStoryboardFrame({
          project_id: projectId,
          frame_number: frames.length + i + 1,
          title: g.title ?? `Frame ${frames.length + i + 1}`,
          description: g.description,
          shot_type: g.shot_type,
          camera_angle: g.camera_angle,
          shot_duration: g.shot_duration ?? "00:00:05",
          mood: g.mood,
          notes: g.notes,
        });
        created.push(frame);
      }
      setFrames((prev) => [...prev, ...created]);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I've added ${created.length} frames to your storyboard based on your brief. You can now upload images for each frame and edit any details.`,
        },
      ]);
      toast.success(`${created.length} frames generated`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error("generateFrames error:", msg);
      toast.error(msg || "Failed to generate frames");
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/50 p-4 sm:flex overflow-y-auto custom-scrollbar">
        <div className="mb-5">
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Project
          </label>
          <div className="relative">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
          </div>
        </div>

        {/* Stats */}
        {frames.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
              <p className="text-lg font-bold text-[#d4a853]">{frames.length}</p>
              <p className="text-[10px] text-muted-foreground">Frames</p>
            </div>
            <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">{frames.filter((f) => f.image_url).length}</p>
              <p className="text-[10px] text-muted-foreground">With images</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => setAddOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5"
          >
            <Plus className="h-4 w-4 text-[#d4a853]" />
            Add frame
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex w-full items-center gap-2 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.06] px-3 py-2.5 text-sm text-[#d4a853] transition-colors hover:bg-[#d4a853]/[0.12]"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </button>
          <button
            onClick={handleShare}
            disabled={sharing || frames.length === 0}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5 disabled:opacity-40"
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4 text-muted-foreground" />
            )}
            Share with client
          </button>
        </div>

        {/* Share URL */}
        {shareUrl && (
          <div className="mt-4 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.06] p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#d4a853]">Client link</p>
            <p className="mb-2 break-all text-[11px] text-zinc-400">{shareUrl}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Copied!");
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853]/20 px-2.5 py-1.5 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/30"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
        )}
      </aside>

      {/* ── Main frame grid ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h1 className="text-base font-bold text-foreground">Storyboard</h1>
            <p className="text-xs text-muted-foreground">
              {frames.length > 0
                ? `${frames.length} frame${frames.length !== 1 ? "s" : ""} in "${selectedProject?.title ?? ""}"`
                : "Build visual frames for your production"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#d4a853]/40 bg-[#d4a853]/10 px-3 py-1.5 text-xs font-semibold text-[#d4a853] transition-all hover:bg-[#d4a853]/20"
            >
              <Bot className="h-3.5 w-3.5" />
              AI Director
            </button>
            <button
              onClick={handleShare}
              disabled={sharing || frames.length === 0}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:border-[#d4a853]/40 disabled:opacity-40"
            >
              {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Share
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-[#d4a853] px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-[#e0b55e]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Frame
            </button>
          </div>
        </div>

        {/* Frame grid */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
            </div>
          ) : frames.length === 0 ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/[0.07]">
                <Clapperboard className="h-8 w-8 text-[#d4a853]/60" />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">No frames yet</p>
                <p className="text-xs text-muted-foreground">
                  Add frames manually or let AI generate your storyboard
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setAddOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground hover:border-[#d4a853]/40"
                >
                  <Plus className="h-4 w-4" /> Add frame
                </button>
                <button
                  onClick={() => setAiOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#e0b55e]"
                >
                  <Sparkles className="h-4 w-4" /> Generate with AI
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {frames.map((frame, i) => (
                <FrameCard
                  key={frame.id}
                  frame={frame}
                  index={i}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onImageUpload={handleImageUpload}
                  uploading={uploadingId}
                />
              ))}
              {/* Ghost add card */}
              <button
                onClick={() => setAddOpen(true)}
                className="flex aspect-video flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium">Add frame</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── AI Assistant panel ────────────────────────────────────── */}
      {aiOpen && (
        <div className="flex w-80 shrink-0 flex-col border-l border-border bg-card/80 backdrop-blur-sm">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a853]/15">
                <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">AI Director</p>
                <p className="text-[10px] text-muted-foreground">Claude</p>
              </div>
            </div>
            <button
              onClick={() => setAiOpen(false)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick actions */}
          {chatMessages.length === 0 && (
            <div className="space-y-2 border-b border-border p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Quick generate
              </p>
              {[
                { label: "🎬 Luxury brand reveal", brief: "luxury product brand reveal, cinematic, elegant" },
                { label: "⚡ Action sequence", brief: "fast-paced action sequence with dynamic energy" },
                { label: "🌅 Documentary opening", brief: "documentary-style opening, natural light, authentic" },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={() => generateFrames(q.brief)}
                  disabled={generating}
                  className="flex w-full items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-left text-xs text-foreground transition-all hover:border-[#d4a853]/40 hover:bg-[#d4a853]/5 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                  ) : (
                    <Film className="h-3 w-3 shrink-0 text-[#d4a853]" />
                  )}
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  Ask me to generate frames, suggest camera angles, or describe a scene.
                </p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/15">
                    <Sparkles className="h-3 w-3 text-[#d4a853]" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-[#d4a853] text-black"
                      : "rounded-bl-sm bg-muted/60 text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/15">
                  <Sparkles className="h-3 w-3 text-[#d4a853]" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-muted/60 px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                        style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Custom brief input (no conversation yet) */}
          {chatMessages.length === 0 && (
            <div className="shrink-0 border-t border-border p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Custom brief
              </p>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      generateFrames(chatInput);
                      setChatInput("");
                    }
                  }}
                  placeholder="Describe your video…"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
                <button
                  onClick={() => {
                    generateFrames(chatInput);
                    setChatInput("");
                  }}
                  disabled={generating || !chatInput.trim()}
                  className="flex items-center gap-1 rounded-xl bg-[#d4a853] px-3 py-2 text-xs font-bold text-black hover:bg-[#e0b55e] disabled:opacity-40"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Chat input (after conversation starts) */}
          {chatMessages.length > 0 && (
            <form onSubmit={sendChat} className="shrink-0 border-t border-border p-3">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="flex items-center justify-center rounded-xl bg-[#d4a853] p-2 text-black hover:bg-[#e0b55e] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Add Frame modal ───────────────────────────────────────── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold text-foreground">Add Frame</h2>
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Opening wide shot"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="What does the viewer see?"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Shot type</label>
                  <div className="relative">
                    <select
                      value={newShotType}
                      onChange={(e) => setNewShotType(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-7 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                    >
                      {SHOT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {formatShotType(t)}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Duration</label>
                  <input
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="00:00:05"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mood</label>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setNewMood(m === newMood ? "" : m)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-all",
                        newMood === m
                          ? "bg-[#d4a853] text-black"
                          : "border border-border text-muted-foreground hover:border-[#d4a853]/40"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
                <input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Lighting cues, director notes…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFrame}
                disabled={!newTitle.trim()}
                className="rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-bold text-black hover:bg-[#e0b55e] disabled:opacity-40"
              >
                Add Frame
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
