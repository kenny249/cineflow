"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Bot, Send, X, ListChecks, ImageIcon, Loader2,
  RotateCcw, Save, Sparkles, Trash2, CheckCircle2, Upload, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { BreakdownPanel } from "@/app/(app)/scripts/BreakdownPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIMessage { role: "user" | "assistant"; content: string }

interface PendingShot {
  shot_number: number;
  scene?: string;
  description: string;
  shot_type: string;
  camera_movement: string;
  location?: string;
  lens?: string;
  notes?: string;
  duration_seconds?: number;
}

export interface ScriptEditorPageProps {
  projectId: string;
  projectTitle: string;
  initialContent: string;
  initialFileId?: string;
  initialStoragePath?: string;
  initialPublicUrl?: string;
}

const SHOT_TYPES = [
  "wide", "medium", "close_up", "extreme_close_up",
  "overhead", "drone", "pov", "other",
];

// ─── AI Writer Panel ──────────────────────────────────────────────────────────

function AIWriterPanel({
  content, projectTitle, onInsert, onClose,
}: {
  content: string;
  projectTitle: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const updated: AIMessage[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are a professional screenwriter and script consultant inside CineFlow, working on "${projectTitle}".

Current script (${wordCount} words):
"""
${content.slice(0, 8000)}${content.length > 8000 ? "\n[...truncated for context]" : ""}
"""

You help with:
- Writing the next scene (use proper Fountain screenplay format)
- Rewriting or improving dialogue
- Story structure, pacing, and character notes
- Answering craft questions

When writing new script content, always use Fountain format so it can be pasted directly.`,
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const SUGGESTIONS = [
    "Write the next scene",
    "Give me structure notes",
    "Punch up this dialogue",
    "What's missing from this script?",
  ];

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border bg-card/30">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-[#d4a853]" />
          <span className="text-xs font-semibold text-foreground">AI Writer</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear chat"
              className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed max-w-[90%] ${
              m.role === "user"
                ? "bg-[#d4a853]/15 text-foreground"
                : "bg-card border border-border text-foreground"
            }`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
            {m.role === "assistant" && (
              <button
                onClick={() => { onInsert("\n\n" + m.content); toast.success("Added to script"); }}
                className="text-[10px] text-muted-foreground/60 hover:text-[#d4a853] transition-colors px-1"
              >
                + Insert into script
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Writing…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask for help or write a scene…"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 custom-scrollbar"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d4a853] text-black hover:bg-[#c49843] transition-colors disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shot Review Panel ────────────────────────────────────────────────────────

function ShotReviewPanel({
  shots, onShotsChange, onSave, onClose, saving,
}: {
  shots: PendingShot[];
  onShotsChange: (shots: PendingShot[]) => void;
  onSave: (shots: PendingShot[]) => void;
  onClose: () => void;
  saving: boolean;
}) {
  function updateShot(index: number, updates: Partial<PendingShot>) {
    onShotsChange(shots.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  }

  function removeShot(index: number) {
    onShotsChange(shots.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3 gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Review Shot List</p>
          <p className="text-xs text-muted-foreground">
            {shots.length} shots generated — edit descriptions and types before saving
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Discard
          </button>
          <button
            onClick={() => onSave(shots)}
            disabled={saving || shots.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {saving ? "Saving…" : `Save ${shots.length} shots`}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar" style={{ maxHeight: "40vh" }}>
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-10">#</th>
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-36">Scene</th>
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-36">Shot Type</th>
              <th className="px-4 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shots.map((shot, i) => (
              <tr key={i} className="bg-card/40 hover:bg-accent/20 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                </td>
                <td className="px-4 py-2.5">
                  <input
                    value={shot.description}
                    onChange={(e) => updateShot(i, { description: e.target.value })}
                    className="w-full bg-transparent text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 rounded px-1 py-0.5"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    value={shot.scene ?? ""}
                    onChange={(e) => updateShot(i, { scene: e.target.value })}
                    className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 rounded px-1 py-0.5"
                    placeholder="Scene"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={shot.shot_type}
                    onChange={(e) => updateShot(i, { shot_type: e.target.value })}
                    className="w-full rounded border border-border bg-card px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                  >
                    {SHOT_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => removeShot(i)}
                    className="rounded p-1 text-muted-foreground/40 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Scene Navigator ──────────────────────────────────────────────────────────

function parseScenes(content: string) {
  return content.split("\n").reduce<{ line: number; heading: string }[]>((acc, line, i) => {
    const t = line.trim().toUpperCase();
    if (
      t.startsWith("INT.") || t.startsWith("EXT.") || t.startsWith("INT/EXT.") ||
      /^SCENE \d+/.test(t)
    ) {
      acc.push({ line: i, heading: line.trim() });
    }
    return acc;
  }, []);
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function ScriptEditorPage({
  projectId, projectTitle,
  initialContent, initialFileId, initialStoragePath, initialPublicUrl,
}: ScriptEditorPageProps) {
  const [content, setContent] = useState(initialContent);
  const [fileId, setFileId] = useState(initialFileId);
  const [storagePath, setStoragePath] = useState(initialStoragePath);
  const [publicUrl, setPublicUrl] = useState(initialPublicUrl);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAIWriter, setShowAIWriter] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [flowingTo, setFlowingTo] = useState<"shotlist" | "storyboard" | null>(null);
  const [pendingShots, setPendingShots] = useState<PendingShot[]>([]);
  const [showShotReview, setShowShotReview] = useState(false);
  const [savingShots, setSavingShots] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scenes = useMemo(() => parseScenes(content), [content]);
  const wordCount = useMemo(() => content.split(/\s+/).filter(Boolean).length, [content]);

  const saveScript = useCallback(async (val: string) => {
    const client = createClient();
    const { data: { user } } = await client.auth.getUser();
    const blob = new Blob([val], { type: "text/plain" });
    const path = storagePath ?? `${projectId}/scripts/script.fountain`;

    const { error } = await client.storage
      .from("project-files")
      .upload(path, blob, { cacheControl: "1", upsert: true });
    if (error) throw error;

    const { data: urlData } = client.storage.from("project-files").getPublicUrl(path);
    const url = urlData?.publicUrl;

    if (fileId) {
      setPublicUrl(url);
    } else {
      const { data: created } = await client
        .from("project_files")
        .insert({
          project_id: projectId,
          tab: "scripts",
          name: "script.fountain",
          storage_path: path,
          public_url: url,
          size: blob.size,
          mime_type: "text/plain",
          uploaded_by: user?.id,
        })
        .select()
        .single();
      if (created) {
        setFileId(created.id);
        setStoragePath(created.storage_path);
        setPublicUrl(created.public_url);
      }
    }
  }, [projectId, storagePath, fileId]);

  function handleChange(val: string) {
    setContent(val);
    setDirty(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      try {
        await saveScript(val);
        setDirty(false);
      } catch {
        // silent auto-save failure — user can explicit save
      }
    }, 2000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveScript(content);
      setDirty(false);
      toast.success("Script saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      toast.info("PDFs can't be edited as text — upload them as a file instead.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (ext === "fdx") text = text.replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
      handleChange(text);
      toast.success(`Imported "${file.name}"`);
    };
    reader.readAsText(file);
  }

  function jumpToScene(lineNum: number) {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = content.split("\n").slice(0, lineNum).join("\n").length;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.scrollTop = lineNum * (parseInt(getComputedStyle(ta).lineHeight) || 22);
  }

  async function flowToShotList() {
    if (!content.trim() || flowingTo) return;
    setFlowingTo("shotlist");
    try {
      const res = await fetch("/api/ai/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "script-to-shotlist", scriptContent: content, projectTitle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPendingShots(data.shots);
      setShowShotReview(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate shot list");
    } finally {
      setFlowingTo(null);
    }
  }

  async function flowToStoryboard() {
    if (!content.trim() || flowingTo) return;
    setFlowingTo("storyboard");
    try {
      const res = await fetch("/api/ai/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "script-to-storyboard", scriptContent: content, projectTitle }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const supabase = createClient();
      const { count: existingCount } = await supabase
        .from("storyboard_frames")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      const offset = existingCount ?? 0;

      for (let i = 0; i < data.frames.length; i++) {
        const frame = data.frames[i];
        await supabase.from("storyboard_frames").insert({
          project_id: projectId,
          frame_number: offset + i + 1,
          title: frame.title,
          description: frame.description,
          shot_type: frame.shot_type,
          camera_angle: frame.camera_angle,
          shot_duration: frame.shot_duration ?? "00:00:05",
          mood: frame.mood,
          notes: frame.notes,
        });
      }
      toast.success(`${data.frames.length} storyboard frames created — open the Storyboard tab to review`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate storyboard");
    } finally {
      setFlowingTo(null);
    }
  }

  async function saveShotList(shots: PendingShot[]) {
    setSavingShots(true);
    try {
      const supabase = createClient();

      const { data: existing } = await supabase
        .from("shot_lists")
        .select("id, shot_list_items(id)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let shotListId: string;
      let existingCount = 0;

      if (existing) {
        shotListId = existing.id;
        existingCount = (existing.shot_list_items as unknown[])?.length ?? 0;
      } else {
        const { data: created, error } = await supabase
          .from("shot_lists")
          .insert({ project_id: projectId, title: "Shot List", description: "Generated from script" })
          .select()
          .single();
        if (error) throw error;
        shotListId = created.id;
      }

      for (let i = 0; i < shots.length; i++) {
        await supabase.from("shot_list_items").insert({
          shot_list_id: shotListId,
          ...shots[i],
          shot_number: existingCount + i + 1,
          is_complete: false,
        });
      }

      setShowShotReview(false);
      setPendingShots([]);
      toast.success(`${shots.length} shots saved — open the Shot List tab in your project to review`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save shot list");
    } finally {
      setSavingShots(false);
    }
  }

  const hasContent = content.trim().length > 0;

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* ── Header ── */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/projects/${projectId}`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline truncate max-w-40">{projectTitle}</span>
          </Link>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <span className="text-sm font-semibold text-foreground hidden sm:inline">Script</span>
          {dirty && (
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853] shrink-0" title="Unsaved changes" />
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {wordCount > 0 && (
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
              {wordCount.toLocaleString()} words · {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
            </span>
          )}

          {hasContent && (
            <>
              <button
                onClick={flowToShotList}
                disabled={!!flowingTo}
                title="AI generates your shot list — you review and edit before saving"
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {flowingTo === "shotlist" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">→ Shot List</span>
              </button>

              <button
                onClick={flowToStoryboard}
                disabled={!!flowingTo}
                title="AI generates storyboard frames from your script"
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-colors disabled:opacity-50"
              >
                {flowingTo === "storyboard" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">→ Storyboard</span>
              </button>

              <button
                onClick={() => setShowBreakdown(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/8 px-2.5 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Breakdown
              </button>
            </>
          )}

          <button
            onClick={() => setShowAIWriter((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showAIWriter
                ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Writer</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {/* Scene navigator — hidden when AI Writer is open */}
        {scenes.length > 0 && !showAIWriter && (
          <div className="hidden lg:flex w-48 shrink-0 flex-col border-r border-border bg-card/20">
            <div className="border-b border-border px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                Scenes ({scenes.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 space-y-0.5">
              {scenes.map((scene, i) => (
                <button
                  key={i}
                  onClick={() => jumpToScene(scene.line)}
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                >
                  <span className="mr-1.5 font-bold text-[#d4a853]/70 text-[10px]">{i + 1}.</span>
                  <span className="truncate">{scene.heading}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Script editor area */}
        <div className="flex flex-1 flex-col min-w-0">
          {!hasContent && (
            <div className="shrink-0 border-b border-border bg-[#d4a853]/[0.04] px-5 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Start writing in{" "}
                <span className="font-mono text-[#d4a853]/80">Fountain</span>{" "}
                format — scene headings like{" "}
                <span className="font-mono text-[#d4a853]/80">INT. LOCATION - DAY</span>
              </p>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors shrink-0">
                <Upload className="h-3.5 w-3.5" />
                Import file
                <input
                  type="file"
                  accept=".txt,.fountain,.fdx"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
            </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar flex justify-center">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={
                "FADE IN:\n\nINT. LOCATION - DAY\n\nAction line. Describe what we see.\n\nCHARACTER NAME\nDialogue goes here.\n\nFADE OUT."
              }
              className="w-full max-w-2xl resize-none bg-transparent px-8 py-6 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
              style={{ fontFamily: "'Courier New', Courier, monospace", minHeight: "100%" }}
              spellCheck
            />
          </div>

          <div className="shrink-0 border-t border-border px-4 py-1.5 flex items-center justify-between text-[11px] text-muted-foreground/50">
            <span>{dirty ? "Unsaved changes" : "Auto-saved"}</span>
            {hasContent && (
              <span>
                {wordCount.toLocaleString()} words · ~{Math.max(1, Math.round(wordCount / 200))} min
              </span>
            )}
          </div>
        </div>

        {/* AI Writer panel */}
        {showAIWriter && (
          <AIWriterPanel
            content={content}
            projectTitle={projectTitle}
            onInsert={(text) => handleChange(content + text)}
            onClose={() => setShowAIWriter(false)}
          />
        )}
      </div>

      {/* ── Shot list review panel ── */}
      {showShotReview && (
        <ShotReviewPanel
          shots={pendingShots}
          onShotsChange={setPendingShots}
          onSave={saveShotList}
          onClose={() => setShowShotReview(false)}
          saving={savingShots}
        />
      )}

      {/* ── AI Breakdown panel ── */}
      {showBreakdown && (
        <BreakdownPanel
          file={{
            id: fileId ?? "inline",
            name: "script.fountain",
            project_id: projectId,
            projectId,
            projectTitle,
            public_url: publicUrl,
            storage_path: storagePath ?? "",
            tab: "scripts",
            mime_type: "text/plain",
            created_at: new Date().toISOString(),
          }}
          initialContent={content}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}
