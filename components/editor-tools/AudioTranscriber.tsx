"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileAudio, Copy, Download, CheckCheck, X, Loader2, AlertCircle,
  FolderOpen, ChevronDown, ChevronUp, Pencil, Archive, Sparkles, Library, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import { TranscriptHistory } from "@/components/editor-tools/TranscriptHistory";
import { getProjects, saveProjectTranscript } from "@/lib/supabase/queries";
import type { ProjectTranscriptWithProject } from "@/lib/supabase/queries";
import type { Project } from "@/types";

const ACCEPTED_EXT = [".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm"];
const MAX_MB = 25; // OpenAI Whisper hard limit
const MAX_BYTES = MAX_MB * 1024 * 1024;
const LS_KEY = "cineflow_transcriber_state";

type DoneState = { filename: string; fileSize: number; text: string; duration: number | null };

type State =
  | { phase: "idle" }
  | { phase: "needs_compression"; file: File }
  | { phase: "compressing"; file: File; progress: number; label: string }
  | { phase: "uploading"; file: File; progress: number; label: string }
  | { phase: "done"; file: File; text: string; duration: number | null }
  | { phase: "error"; message: string };

type MobileTab = "transcript" | "ai";

function formatBytes(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function AudioTranscriber() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savedToProject, setSavedToProject] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>("transcript");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const saved: DoneState = JSON.parse(raw);
      if (saved.text) {
        const fakeFile = new File([], saved.filename, { type: "audio/mpeg" });
        Object.defineProperty(fakeFile, "size", { value: saved.fileSize });
        setState({ phase: "done", file: fakeFile, text: saved.text, duration: saved.duration });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (showProjectPicker && projects.length === 0) {
      getProjects().then(setProjects).catch(() => {});
    }
  }, [showProjectPicker, projects.length]);

  const uploadAndTranscribe = useCallback(async (file: File) => {
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
      try { localStorage.setItem(LS_KEY, JSON.stringify(done)); } catch {}
    } catch (e: any) {
      setState({ phase: "error", message: e.message ?? "Something went wrong. Try again." });
    }
  }, []);

  const compressAndTranscribe = useCallback(async (file: File) => {
    setState({ phase: "compressing", file, progress: 0, label: "Loading compressor…" });
    try {
      const { compressAudioForWhisper } = await import("@/lib/ffmpeg-compress");
      setState({ phase: "compressing", file, progress: 0, label: "Compressing audio…" });
      const compressed = await compressAudioForWhisper(file, (pct) => {
        setState((s) => s.phase === "compressing" ? { ...s, progress: pct } : s);
      });
      await uploadAndTranscribe(compressed);
    } catch (e: any) {
      setState({ phase: "error", message: e.message ?? "Compression failed. Try a smaller file." });
    }
  }, [uploadAndTranscribe]);

  const transcribe = useCallback(async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setState({ phase: "error", message: "Unsupported format. Use MP3, M4A, WAV, OGG, FLAC, or AAC." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ phase: "needs_compression", file });
      return;
    }
    await uploadAndTranscribe(file);
  }, [uploadAndTranscribe]);

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
        toast.success("PDF opened — tap share to save");
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
      setHistoryKey((k) => k + 1);
      setTimeout(() => setLibraryOpen(true), 400);
      toast.success(project ? `Saved to "${label}"` : "Saved to Personal");
    } catch (e: any) { toast.error(e.message ?? "Failed to save"); }
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
      if (raw) localStorage.setItem(LS_KEY, JSON.stringify({ ...JSON.parse(raw), text: editText }));
    } catch {}
    setIsEditing(false);
    toast.success("Transcript updated");
  }

  function reset() {
    setState({ phase: "idle" });
    setCopied(false);
    setSavedToProject(null);
    setShowProjectPicker(false);
    setIsEditing(false);
    setLibraryOpen(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  function loadTranscript(t: ProjectTranscriptWithProject) {
    const fakeFile = new File([], t.filename, { type: "audio/mpeg" });
    setState({ phase: "done", file: fakeFile, text: t.transcript, duration: t.duration_secs ?? null });
    setSavedToProject(t.project_title ?? "Personal");
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        filename: t.filename, fileSize: 0, text: t.transcript, duration: t.duration_secs ?? null,
      }));
    } catch {}
  }

  // ── NEEDS COMPRESSION ────────────────────────────────────────────────────
  if (state.phase === "needs_compression") {
    const fileMB = (state.file.size / (1024 * 1024)).toFixed(1);
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] px-8 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
            <FileAudio className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{state.file.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fileMB} MB — over Whisper&apos;s 25 MB limit</p>
          </div>
          <div className="w-full space-y-2.5">
            <button
              onClick={() => compressAndTranscribe(state.file)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] px-5 py-3 text-sm font-semibold text-black hover:bg-[#d4a853]/90 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Compress &amp; Transcribe
            </button>
            <p className="text-[10px] text-muted-foreground/60">
              Shrinks to ~{Math.ceil(state.file.size / (1024 * 1024) * 0.15)} MB · mono 64 kbps · runs in your browser
            </p>
          </div>
          <button
            onClick={() => { setState({ phase: "idle" }); fileInputRef.current?.click(); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Choose a different file
          </button>
        </div>
      </div>
    );
  }

  // ── COMPRESSING ───────────────────────────────────────────────────────────
  if (state.phase === "compressing") {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-border bg-white/[0.02] px-8 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{state.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{state.file.name}</p>
          </div>
          <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-[#d4a853] transition-all duration-300" style={{ width: `${state.progress}%` }} />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{state.progress}%</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">Running FFmpeg in your browser · no file leaves your device</p>
        </div>
      </div>
    );
  }

  // ── IDLE / ERROR ─────────────────────────────────────────────────────────
  if (state.phase === "idle" || state.phase === "error") {
    return (
      <div className="flex h-full overflow-hidden">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT.join(",")} className="hidden" onChange={onFileChange} />

        {/* Left: Upload zone */}
        <div className="flex flex-1 items-center justify-center border-r border-border p-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full max-w-md cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-20 text-center transition-colors",
              dragging ? "border-[#d4a853] bg-[#d4a853]/5" : "border-border hover:border-[#d4a853]/50 hover:bg-white/[0.02]"
            )}
          >
            <div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors", dragging ? "border-[#d4a853]/40 bg-[#d4a853]/10" : "border-border bg-white/[0.03]")}>
              {dragging ? <Upload className="h-6 w-6 text-[#d4a853]" /> : <FileAudio className="h-6 w-6 text-muted-foreground" />}
            </div>
            <p className="text-sm font-semibold text-foreground">{dragging ? "Drop to transcribe" : "Drop audio here or click to browse"}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">MP3 · M4A · WAV · OGG · FLAC · AAC · up to {MAX_MB} MB</p>
            {state.phase === "error" && (
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />{state.message}
              </div>
            )}
          </div>
        </div>

        {/* Right: Library — always visible in idle state */}
        <div className="flex w-[360px] xl:w-[400px] shrink-0 flex-col">
          <div className="shrink-0 flex items-center gap-2.5 border-b border-border px-5 py-3.5">
            <Library className="h-3.5 w-3.5 text-[#d4a853]" />
            <div>
              <p className="text-xs font-semibold text-foreground">Library</p>
              <p className="text-[10px] text-muted-foreground/60">Click a transcript to open it</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
            <TranscriptHistory key={historyKey} onLoadTranscript={loadTranscript} />
          </div>
        </div>
      </div>
    );
  }

  // ── UPLOADING ─────────────────────────────────────────────────────────────
  if (state.phase === "uploading") {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-border bg-white/[0.02] px-8 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Loader2 className="h-6 w-6 animate-spin text-[#d4a853]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{state.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{state.file.name} · {formatBytes(state.file.size)}</p>
          </div>
          <div className="w-full">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-[#d4a853] transition-all duration-500" style={{ width: `${state.progress}%` }} />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{Math.round(state.progress)}%</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">Powered by OpenAI Whisper · large files may take 30–60s</p>
        </div>
      </div>
    );
  }

  // ── DONE: split workspace ─────────────────────────────────────────────────
  const wordCount = state.text.trim().split(/\s+/).length;

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── File bar ── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
          <FileAudio className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{state.file.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {state.file.size ? formatBytes(state.file.size) : ""}
            {state.duration ? ` · ${formatDuration(state.duration)}` : ""}
            {" · "}{wordCount.toLocaleString()} words
            {savedToProject && <span className="ml-2 text-emerald-400">· saved to &ldquo;{savedToProject}&rdquo;</span>}
          </p>
        </div>

        {/* Save button */}
        <div className="relative shrink-0">
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
              <div className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-xl border border-border bg-[#111] shadow-2xl">
                <p className="border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Save transcript</p>
                <button
                  onClick={() => saveToProject(null)}
                  className="flex w-full items-center border-b border-border/50 px-4 py-2.5 text-left text-sm text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
                >
                  Personal (no project)
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
                        className="flex w-full items-center px-4 py-2.5 text-left text-sm text-foreground hover:bg-white/[0.05] transition-colors"
                      >
                        <span className="truncate">{p.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          onClick={reset}
          title="New transcript"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-white/[0.06] hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Mobile tab switcher ── */}
      <div className="md:hidden shrink-0 border-b border-border px-5">
        <div className="flex">
          {([["transcript", "Transcript"], ["ai", "AI Cut List"]] as [MobileTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                mobileTab === key
                  ? "border-[#d4a853] text-foreground"
                  : "border-transparent text-muted-foreground"
              )}
            >
              {key === "ai" && <Sparkles className="h-3.5 w-3.5" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split workspace ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left: Transcript */}
        <div className={cn(
          "flex flex-col flex-1 min-w-0",
          "border-r border-border",
          mobileTab !== "transcript" && "hidden md:flex"
        )}>
          {/* Transcript toolbar */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
            <p className="mr-auto text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Transcript</p>
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 transition-colors"
                >
                  Save edits
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={copyText}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={downloadPDF}
                  disabled={pdfLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {pdfLoading ? "…" : "PDF"}
                </button>
              </>
            )}
          </div>

          {/* Transcript body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {isEditing ? (
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                className="h-full w-full resize-none bg-transparent text-sm leading-8 text-foreground focus:outline-none"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-8 text-foreground/90">{state.text}</p>
            )}
          </div>
        </div>

        {/* Right: AI Content Intelligence */}
        <div className={cn(
          "w-[400px] xl:w-[440px] shrink-0 overflow-y-auto custom-scrollbar",
          mobileTab !== "ai" && "hidden md:block"
        )}>
          <AIContentPanel transcript={state.text} filename={state.file.name} />
        </div>
      </div>

      {/* ── Library drawer ── */}
      <div className="shrink-0 border-t border-border">
        <button
          onClick={() => setLibraryOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 px-5 py-3 hover:bg-white/[0.02] transition-colors"
        >
          <Archive className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="text-xs font-semibold text-muted-foreground/60">Library</span>
          <span className="text-[10px] text-muted-foreground/30">saved transcripts</span>
          {libraryOpen
            ? <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground/30" />
            : <ChevronUp className="ml-auto h-3.5 w-3.5 text-muted-foreground/30" />
          }
        </button>
        {libraryOpen && (
          <div className="max-h-80 overflow-y-auto custom-scrollbar border-t border-border px-5 py-4">
            <TranscriptHistory key={historyKey} />
          </div>
        )}
      </div>
    </div>
  );
}
