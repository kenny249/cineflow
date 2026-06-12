"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileAudio, Copy, Download, CheckCheck, X, Loader2, AlertCircle, FolderOpen, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import { getProjects, saveProjectTranscript } from "@/lib/supabase/queries";
import type { Project } from "@/types";

const ACCEPTED_EXT = [".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm"];
const MAX_MB = 500;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const LS_KEY = "cineflow_transcriber_state";

type DoneState = { filename: string; fileSize: number; text: string; duration: number | null };

type State =
  | { phase: "idle" }
  | { phase: "uploading"; file: File; progress: number; label: string }
  | { phase: "done"; file: File; text: string; duration: number | null }
  | { phase: "error"; message: string };

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AudioTranscriber({ onTranscriptSaved }: { onTranscriptSaved?: () => void }) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  // Save to project
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savedToProject, setSavedToProject] = useState<string | null>(null);
  // Inline editing
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved: DoneState = JSON.parse(raw);
      if (saved.text) {
        // Reconstruct a minimal File-like object for display
        const fakeFile = new File([], saved.filename, { type: "audio/mpeg" });
        Object.defineProperty(fakeFile, "size", { value: saved.fileSize });
        setState({ phase: "done", file: fakeFile, text: saved.text, duration: saved.duration });
      }
    } catch {}
  }, []);

  // Fetch projects when picker opens
  useEffect(() => {
    if (showProjectPicker && projects.length === 0) {
      getProjects().then(setProjects).catch(() => {});
    }
  }, [showProjectPicker, projects.length]);

  function validateFile(file: File): string | null {
    if (file.size > MAX_BYTES) return `File is ${formatBytes(file.size)} — max is ${MAX_MB} MB.`;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) return "Unsupported format. Use MP3, M4A, WAV, OGG, FLAC, or AAC.";
    return null;
  }

  const transcribe = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { setState({ phase: "error", message: err }); return; }

    setSavedToProject(null);
    setState({ phase: "uploading", file, progress: 0, label: "Preparing upload…" });

    try {
      const prepRes = await fetch("/api/transcribe/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!prepRes.ok) {
        const d = await prepRes.json().catch(() => ({}));
        setState({ phase: "error", message: d.error ?? "Failed to prepare upload" });
        return;
      }
      const { signedUrl, path } = await prepRes.json();

      setState({ phase: "uploading", file, progress: 5, label: "Uploading audio…" });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 5 + (e.loaded / e.total) * 65;
            setState((s) => s.phase === "uploading" ? { ...s, progress: pct, label: "Uploading audio…" } : s);
          }
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
        xhr.send(file);
      });

      setState({ phase: "uploading", file, progress: 72, label: "Transcribing with Whisper…" });
      let prog = 72;
      const tick = setInterval(() => {
        prog = Math.min(prog + Math.random() * 4, 92);
        setState((s) => s.phase === "uploading" ? { ...s, progress: prog, label: "Transcribing with Whisper…" } : s);
      }, 800);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      clearInterval(tick);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setState({ phase: "error", message: d.error ?? "Transcription failed. Try again." });
        return;
      }

      const data = await res.json();
      const done: DoneState = { filename: file.name, fileSize: file.size, text: data.text ?? "", duration: data.duration ?? null };
      setState({ phase: "done", file, text: done.text, duration: done.duration });

      // Persist to localStorage so refresh doesn't lose it
      try { localStorage.setItem(LS_KEY, JSON.stringify(done)); } catch {}
    } catch (e: any) {
      setState({ phase: "error", message: e.message ?? "Something went wrong. Try again." });
    }
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) transcribe(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) transcribe(file);
    e.target.value = "";
  }

  async function copyText() {
    if (state.phase !== "done") return;
    await navigator.clipboard.writeText(state.text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadPDF() {
    if (state.phase !== "done") return;
    setPdfLoading(true);
    try {
      const basename = state.file.name.replace(/\.[^.]+$/, "");
      const res = await fetch("/api/transcribe/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: state.text, filename: basename, duration: state.duration }),
      });
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
      if (isIOS) {
        window.open(url, "_blank");
        toast.success("PDF opened — tap share to save to your device");
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = `${basename}-transcript.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        toast.success("Transcript downloaded");
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { toast.error("Failed to generate PDF"); }
    finally { setPdfLoading(false); }
  }

  async function saveToProject(project: Project | null) {
    if (state.phase !== "done") return;
    setSavingProject(true);
    const label = project ? project.title : "Personal";
    try {
      await saveProjectTranscript({
        projectId: project?.id ?? null,
        filename: state.file.name,
        fileSizeBytes: state.file.size,
        durationSecs: state.duration,
        transcript: state.text,
      });
      setSavedToProject(label);
      setShowProjectPicker(false);
      toast.success(project ? `Saved to "${label}"` : "Saved to Personal transcripts");
      onTranscriptSaved?.();
    } catch { toast.error("Failed to save"); }
    finally { setSavingProject(false); }
  }

  function startEdit() {
    if (state.phase !== "done") return;
    setEditText(state.text);
    setIsEditing(true);
  }

  function saveEdit() {
    if (state.phase !== "done") return;
    setState({ ...state, text: editText });
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem(LS_KEY, JSON.stringify({ ...parsed, text: editText }));
      }
    } catch {}
    setIsEditing(false);
    toast.success("Transcript updated");
  }

  function reset() {
    setState({ phase: "idle" });
    setCopied(false);
    setSavedToProject(null);
    setShowProjectPicker(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Drop zone */}
      {(state.phase === "idle" || state.phase === "error") && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition-colors cursor-pointer select-none",
            dragging ? "border-[#d4a853] bg-[#d4a853]/5" : "border-border hover:border-[#d4a853]/50 hover:bg-white/[0.02]"
          )}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT.join(",")} className="hidden" onChange={onFileChange} />
          <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors", dragging ? "border-[#d4a853]/40 bg-[#d4a853]/10" : "border-border bg-white/[0.03]")}>
            {dragging ? <Upload className="h-6 w-6 text-[#d4a853]" /> : <FileAudio className="h-6 w-6 text-muted-foreground" />}
          </div>
          <p className="text-sm font-semibold text-foreground">{dragging ? "Drop to transcribe" : "Drop audio here or click to browse"}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">MP3 · M4A · WAV · OGG · FLAC · AAC · up to {MAX_MB} MB</p>
          {state.phase === "error" && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />{state.message}
            </div>
          )}
        </div>
      )}

      {/* Uploading */}
      {state.phase === "uploading" && (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-white/[0.02] px-8 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{state.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{state.file.name} · {formatBytes(state.file.size)}</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-[#d4a853] transition-all duration-500" style={{ width: `${state.progress}%` }} />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{Math.round(state.progress)}%</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">Powered by OpenAI Whisper · large files may take 30–60s</p>
        </div>
      )}

      {/* Done */}
      {state.phase === "done" && (
        <div className="space-y-4">
          {/* File info bar */}
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <FileAudio className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{state.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {state.file.size ? formatBytes(state.file.size) : ""}
                {state.duration ? ` · ${formatDuration(state.duration)}` : ""}
                {" · "}{state.text.trim().split(/\s+/).length.toLocaleString()} words
                {savedToProject && <span className="ml-2 text-emerald-400">· saved to &ldquo;{savedToProject}&rdquo;</span>}
              </p>
            </div>
            <button onClick={reset} className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Transcript card */}
          <div className="rounded-xl border border-border bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-auto">Transcript</p>
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                    Cancel
                  </button>
                  <button onClick={saveEdit} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 transition-colors">
                    Save edits
                  </button>
                </>
              ) : (
                <>
                  <button onClick={startEdit} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={copyText} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
                    {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button onClick={downloadPDF} disabled={pdfLoading} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50 transition-colors">
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {pdfLoading ? "Generating…" : "Download PDF"}
                  </button>
                </>
              )}

              {/* Save to Project picker */}
              <div className="relative">
                <button
                  onClick={() => setShowProjectPicker((v) => !v)}
                  disabled={savingProject || !!savedToProject}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    savedToProject
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "bg-[#d4a853] text-black hover:bg-[#d4a853]/90 disabled:opacity-50"
                  )}
                >
                  {savingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                  {savedToProject ? "Saved" : "Save"}
                  {!savedToProject && !savingProject && <ChevronDown className="h-3 w-3" />}
                </button>

                {showProjectPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                    <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-[#111] shadow-2xl overflow-hidden">
                      <p className="border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Save transcript</p>
                      {/* Personal option always at top */}
                      <button
                        onClick={() => saveToProject(null)}
                        className="flex w-full items-center gap-2 border-b border-border/50 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
                      >
                        <span className="flex-1 truncate">Personal (no project)</span>
                      </button>
                      {projects.length === 0 ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
                        </div>
                      ) : (
                        <div className="max-h-52 overflow-y-auto">
                          {projects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => saveToProject(p)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground hover:bg-white/[0.05] transition-colors"
                            >
                              <span className="flex-1 truncate">{p.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar p-5">
              {isEditing ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full resize-none rounded-lg border border-[#d4a853]/30 bg-white/[0.03] p-3 text-sm leading-7 text-foreground focus:border-[#d4a853]/60 focus:outline-none transition-colors"
                  rows={Math.max(10, editText.split("\n").length)}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{state.text}</p>
              )}
            </div>
          </div>

          {/* AI panel — no save callback (standalone/ephemeral cut lists) */}
          <AIContentPanel transcript={state.text} filename={state.file.name} />

          <button onClick={reset} className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground transition-colors">
            + Transcribe another file
          </button>
        </div>
      )}
    </div>
  );
}
