"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollText, Upload, FileText, Save, Trash2, Files, Sparkles, Bot, Send, X, ListChecks, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getProjectFiles, createProjectFile, deleteProjectFile } from "@/lib/supabase/queries";
import { FileUploadZone } from "./FileUploadZone";
import { BreakdownPanel } from "@/app/(app)/scripts/BreakdownPanel";
import type { ProjectFile } from "@/types";
import { toast } from "sonner";

interface ScriptsTabProps {
  projectId: string;
  canEdit: boolean;
  projectTitle?: string;
}

// ── Inline editor helpers ─────────────────────────────────────────────────────

const SCRIPT_FILENAME = "script.fountain";

async function loadInlineScript(projectId: string): Promise<{ file: ProjectFile | null; content: string }> {
  const files = await getProjectFiles(projectId, "scripts");
  const scriptFile = files.find((f) => f.name === SCRIPT_FILENAME);
  if (!scriptFile?.public_url) return { file: scriptFile ?? null, content: "" };
  try {
    const res = await fetch(scriptFile.public_url, { cache: "no-store" });
    const text = await res.text();
    return { file: scriptFile, content: text };
  } catch {
    return { file: scriptFile, content: "" };
  }
}

async function saveInlineScript(
  projectId: string,
  content: string,
  existingFile: ProjectFile | null
): Promise<ProjectFile> {
  const client = createClient();
  const { data: { user } } = await client.auth.getUser();
  const blob = new Blob([content], { type: "text/plain" });
  const storagePath = `${projectId}/scripts/${SCRIPT_FILENAME}`;

  const { error } = await client.storage
    .from("project-files")
    .upload(storagePath, blob, { cacheControl: "1", upsert: true });
  if (error) throw error;

  const { data: urlData } = client.storage.from("project-files").getPublicUrl(storagePath);

  if (existingFile) {
    return { ...existingFile, public_url: urlData?.publicUrl };
  }

  return createProjectFile({
    project_id: projectId,
    tab: "scripts",
    name: SCRIPT_FILENAME,
    storage_path: storagePath,
    public_url: urlData?.publicUrl,
    size: blob.size,
    mime_type: "text/plain",
    uploaded_by: user?.id,
  });
}

function parseScenes(content: string) {
  return content.split("\n").reduce<{ line: number; heading: string }[]>((acc, line, i) => {
    const t = line.trim().toUpperCase();
    if (t.startsWith("INT.") || t.startsWith("EXT.") || t.startsWith("INT/EXT.") || /^SCENE \d+/.test(t)) {
      acc.push({ line: i, heading: line.trim() });
    }
    return acc;
  }, []);
}

// ── AI Writer panel ───────────────────────────────────────────────────────────

interface AIMessage { role: "user" | "assistant"; content: string }

function AIWriterPanel({
  content, projectTitle, onInsert, onClose,
}: {
  content: string; projectTitle?: string; onInsert: (text: string) => void; onClose: () => void;
}) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const updated: AIMessage[] = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const scriptSnippet = content.slice(0, 8000);
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are a professional screenwriter and script consultant inside CineFlow${projectTitle ? `, working on "${projectTitle}"` : ""}.

Current script (${wordCount} words):
"""
${scriptSnippet}${content.length > 8000 ? "\n[...truncated for context]" : ""}
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

  return (
    <div className="hidden lg:flex w-72 shrink-0 flex-col border-l border-border bg-card/30">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-2">
            {[
              "Write the next scene",
              "Give me structure notes",
              "Punch up this dialogue",
              "What's missing from this script?",
            ].map((s) => (
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

      {/* Input */}
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

// ── Component ─────────────────────────────────────────────────────────────────

export function ScriptsTab({ projectId, canEdit, projectTitle }: ScriptsTabProps) {
  const [mode, setMode] = useState<"files" | "write">("files");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);

  // Write mode state
  const [content, setContent] = useState("");
  const [scriptFile, setScriptFile] = useState<ProjectFile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Writer + Flow state
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [flowingTo, setFlowingTo] = useState<"shotlist" | "storyboard" | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allFiles = await getProjectFiles(projectId, "scripts");
        setFiles(allFiles);
        const inline = await loadInlineScript(projectId);
        setScriptFile(inline.file);
        if (inline.content) {
          setContent(inline.content);
          setMode("write");
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const uploadedFiles = files.filter((f) => f.name !== SCRIPT_FILENAME);
  const scenes = parseScenes(content);

  function handleChange(val: string) {
    setContent(val);
    setDirty(true);
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => triggerSave(val), 2000);
  }

  async function triggerSave(val: string) {
    if (!canEdit) return;
    try {
      const saved = await saveInlineScript(projectId, val, scriptFile);
      setScriptFile(saved);
      setDirty(false);
    } catch {
      // silent — will retry on explicit save
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await saveInlineScript(projectId, content, scriptFile);
      setScriptFile(saved);
      setDirty(false);
      toast.success("Script saved");
    } catch {
      toast.error("Failed to save script");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!scriptFile) return;
    try {
      const client = createClient();
      await client.storage.from("project-files").remove([scriptFile.storage_path]);
      await deleteProjectFile(scriptFile.id);
      setScriptFile(null);
      setContent("");
      setDirty(false);
      setMode("files");
      toast.success("Script deleted");
    } catch {
      toast.error("Failed to delete script");
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      toast.info("PDFs can't be edited as text. Upload them via the Files mode instead.");
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

  function handleAIInsert(text: string) {
    handleChange(content + text);
    textareaRef.current?.focus();
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

      const supabase = createClient();

      // Reuse existing shot list if one already exists — avoid creating duplicates
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
        const { data: created, error: listErr } = await supabase
          .from("shot_lists")
          .insert({ project_id: projectId, title: "Shot List", description: "Generated from script" })
          .select()
          .single();
        if (listErr) throw listErr;
        shotListId = created.id;
      }

      for (let i = 0; i < data.shots.length; i++) {
        await supabase.from("shot_list_items").insert({
          shot_list_id: shotListId,
          ...data.shots[i],
          shot_number: existingCount + i + 1,
          is_complete: false,
        });
      }
      toast.success(`${data.shots.length} shots added to your shot list — open the Shot List tab to review`);
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

      // Count existing frames so new ones don't collide on frame_number
      const { count: existingFrameCount } = await supabase
        .from("storyboard_frames")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      const offset = existingFrameCount ?? 0;

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
      toast.success(`${data.frames.length} storyboard frames created — open the Shot List → Storyboard tab to review`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to generate storyboard");
    } finally {
      setFlowingTo(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ── Mode switcher ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            onClick={() => setMode("write")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "write" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Write
            {dirty && <span className="h-1.5 w-1.5 rounded-full bg-[#d4a853]" />}
          </button>
          <button
            onClick={() => setMode("files")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              mode === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Files className="h-3.5 w-3.5" />
            Files
            {uploadedFiles.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{uploadedFiles.length}</span>
            )}
          </button>
        </div>

        {/* Write mode controls */}
        {mode === "write" && canEdit && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Flow buttons — show when there's content to convert */}
            {content.trim() && (
              <>
                <button
                  onClick={flowToShotList}
                  disabled={!!flowingTo}
                  title="Generate a shot list from this script"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {flowingTo === "shotlist" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">→ Shot List</span>
                </button>
                <button
                  onClick={flowToStoryboard}
                  disabled={!!flowingTo}
                  title="Generate storyboard frames from this script"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-[#d4a853]/30 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {flowingTo === "storyboard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">→ Storyboard</span>
                </button>
              </>
            )}

            {content.trim() && (
              <button
                onClick={() => setShowBreakdown(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/8 px-2.5 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Breakdown</span>
              </button>
            )}

            {/* AI Writer toggle */}
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

            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import</span>
              <input type="file" accept=".txt,.fountain,.fdx" className="hidden" onChange={handleImport} />
            </label>
            {scriptFile && (
              <button
                onClick={handleDelete}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete script"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* ── Write mode ── */}
      {mode === "write" && (
        <div className="flex min-h-[65vh]">
          <div className="flex flex-1 flex-col min-w-0">
            {!content && canEdit && (
              <div className="shrink-0 border-b border-border bg-[#d4a853]/[0.04] px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Start typing or import an existing script file.</p>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/5 px-3 py-1.5 text-xs font-medium text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  Import .txt / .fountain / .fdx
                  <input type="file" accept=".txt,.fountain,.fdx" className="hidden" onChange={handleImport} />
                </label>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              readOnly={!canEdit}
              placeholder={"Write your script here...\n\nUse standard screenplay format:\n  INT. LOCATION - DAY\n  EXT. LOCATION - NIGHT\n\nScenes are auto-detected in the navigator."}
              className="min-h-[55vh] w-full resize-none bg-transparent px-6 py-5 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none custom-scrollbar"
              style={{ fontFamily: "'Courier New', Courier, monospace" }}
              spellCheck
            />
            <div className="shrink-0 border-t border-border px-4 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{content.split(/\s+/).filter(Boolean).length} words</span>
              <span>{scenes.length} scene{scenes.length !== 1 ? "s" : ""} · auto-saved</span>
            </div>
          </div>

          {/* AI Writer panel — replaces scene navigator when open */}
          {showAIWriter ? (
            <AIWriterPanel
              content={content}
              projectTitle={projectTitle}
              onInsert={handleAIInsert}
              onClose={() => setShowAIWriter(false)}
            />
          ) : scenes.length > 0 ? (
            <div className="hidden lg:flex w-52 shrink-0 flex-col border-l border-border bg-card/20">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Scenes</p>
              </div>
              <div className="px-2 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
                {scenes.map((scene, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToScene(scene.line)}
                    className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
                  >
                    <span className="mr-1.5 font-bold text-[#d4a853]/70">{i + 1}.</span>
                    <span className="truncate">{scene.heading}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Files mode ── */}
      {mode === "files" && (
        <div className="px-4 sm:px-5 py-4">
          <p className="mb-4 text-xs text-muted-foreground">Upload PDFs, Final Draft (.fdx), Fountain, or any script format. Stored as-is.</p>
          {uploadedFiles.length === 0 && !canEdit ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText className="mb-3 h-10 w-10 text-muted-foreground/20" />
              <p className="font-display font-semibold">No script files uploaded</p>
            </div>
          ) : (
            <FileUploadZone
              projectId={projectId}
              tab="scripts"
              files={uploadedFiles}
              onFilesChange={(updated) => setFiles([...updated, ...(scriptFile ? [scriptFile] : [])])}
              readOnly={!canEdit}
              accept=".pdf,.fdx,.fountain,.txt,.rtf,.docx,.doc"
              label="Upload script files (PDF, FDX, Fountain…)"
            />
          )}
        </div>
      )}

      {showBreakdown && (
        <BreakdownPanel
          file={{
            id: scriptFile?.id ?? "inline",
            name: SCRIPT_FILENAME,
            project_id: projectId,
            projectId,
            projectTitle,
            public_url: scriptFile?.public_url,
            storage_path: scriptFile?.storage_path ?? "",
            tab: "scripts",
            mime_type: "text/plain",
            size: scriptFile?.size,
            created_at: scriptFile?.created_at ?? new Date().toISOString(),
            uploaded_by: scriptFile?.uploaded_by,
          }}
          initialContent={content}
          onClose={() => setShowBreakdown(false)}
        />
      )}
    </div>
  );
}
