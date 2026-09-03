"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileAudio, Copy, Download, CheckCheck, X, Loader2, AlertCircle,
  FolderOpen, ChevronDown, ChevronUp, Pencil, Archive, Sparkles, Library, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import { ProjectPicker } from "@/components/editor-tools/ProjectPicker";
import { TranscriptHistory } from "@/components/editor-tools/TranscriptHistory";
import { getProjects, saveProjectTranscript, appendTranscriptCutList, updateProjectTranscriptText, getTranscriptById } from "@/lib/supabase/queries";
import type { ProjectTranscriptWithProject, CutListSave } from "@/lib/supabase/queries";
import type { Project } from "@/types";
import type { WhisperWord } from "@/lib/transcript-align";
import { saveCurrentAudio, getCurrentAudio, clearCurrentAudio } from "@/lib/transcriber-audio-store";
import { getAudioDuration, splitAudioIntoChunks, CHUNK_SECONDS } from "@/lib/audio-chunk";

const ACCEPTED_EXT = [".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"];
// OpenAI Whisper's real hard limit — what actually drives whether a file
// needs to be compressed and/or split. Not shown to the user; the whole
// point is that they never have to think about it.
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
// A sane outer ceiling on what we'll even attempt — not Whisper's limit,
// just protection against someone accidentally selecting something
// absurd (a raw video file, a multi-GB archive) and having their browser
// grind on it for no reason.
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_DURATION_HOURS = 4;
// Above this the export source falls back to the compressed copy instead
// of the pristine original — keeps IndexedDB and later ffmpeg re-processing
// (for Export Cuts) from having to handle a multi-hundred-MB blob.
const EXPORT_SOURCE_MAX_BYTES = 500 * 1024 * 1024;
const LS_KEY = "cineflow_transcriber_state";

type DoneState = {
  filename: string;
  fileSize: number;
  text: string;
  duration: number | null;
  // Whether/where this transcript is already saved — without this, a plain
  // refresh forgets the transcript was ever saved at all: the Save button
  // looks fresh again (risking a duplicate row on next click), and any
  // saved cut lists become unreachable, since the local cache never held
  // them in the first place.
  transcriptId?: string | null;
  projectLabel?: string | null;
};

// The real audio bytes + word timestamps. Set on a fresh transcription and
// persisted to IndexedDB so a page refresh doesn't lose export capability;
// never present for a transcript reopened from the library, since we never
// stored audio for those in the first place.
type LiveAudio = { file: File; words: WhisperWord[] };

// One continuous phase for the whole pipeline — probing duration,
// compressing if needed, splitting if still too big, transcribing one or
// more pieces, and stitching the result back together. Deliberately not
// split into separate phases per step: the point is one smoothly-advancing
// progress bar, not a sequence of different screens.
type State =
  | { phase: "idle" }
  | { phase: "processing"; file: File; progress: number; label: string }
  | { phase: "done"; file: File; text: string; duration: number | null; liveAudio: LiveAudio | null }
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
  const [savedTranscriptId, setSavedTranscriptId] = useState<string | null>(null);
  const [savedCutLists, setSavedCutLists] = useState<CutListSave[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
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
        setState({ phase: "done", file: fakeFile, text: saved.text, duration: saved.duration, liveAudio: null });

        // The real audio may still be sitting in IndexedDB from before this
        // refresh — restore it so exact timestamps and Export Cuts survive a
        // reload instead of only surviving in memory. Guarded by filename +
        // size so a stale/unrelated blob never gets attached to this text.
        getCurrentAudio()
          .then((audio) => {
            if (!audio) {
              console.warn("[transcriber] no persisted audio found for refresh-restore — export unavailable this reload");
              return;
            }
            if (audio.file.name !== saved.filename || audio.file.size !== saved.fileSize) {
              console.warn("[transcriber] persisted audio didn't match the current transcript, skipping restore", {
                stored: { name: audio.file.name, size: audio.file.size },
                expected: { name: saved.filename, size: saved.fileSize },
              });
              return;
            }
            setState((s) =>
              s.phase === "done" ? { ...s, file: audio.file, liveAudio: { file: audio.file, words: audio.words } } : s
            );
          })
          .catch((e) => console.error("[transcriber] failed to read persisted audio on refresh:", e));

        // This transcript was already saved before the refresh — restore
        // that fact (so Save doesn't offer to create a duplicate) and
        // re-fetch its cut lists fresh from the database, since the local
        // cache never held them to begin with.
        if (saved.transcriptId) {
          setSavedTranscriptId(saved.transcriptId);
          setSavedToProject(saved.projectLabel ?? "Personal");
          getTranscriptById(saved.transcriptId)
            .then((t) => { if (t) setSavedCutLists(t.cut_lists ?? []); })
            .catch((e) => console.error("[transcriber] failed to refetch saved cut lists on refresh:", e));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (showProjectPicker) ensureProjectsLoaded();
  }, [showProjectPicker]);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  function cancelUpload() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    abortControllerRef.current?.abort();
    setState({ phase: "idle" });
    toast("Upload cancelled");
  }

  // One upload target, regardless of how long the recording is. Compression
  // and splitting both happen automatically, invisibly, only when actually
  // needed — most files never touch either step.
  const processAndTranscribe = useCallback(async (file: File) => {
    cancelledRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSavedToProject(null);
    setSavedTranscriptId(null);
    setSavedCutLists([]);
    setState({ phase: "processing", file, progress: 0, label: "Getting started…" });

    const setProgress = (progress: number, label?: string) => {
      setState((s) => s.phase === "processing" ? { ...s, progress, label: label ?? s.label } : s);
    };

    try {
      // Duration is checked up front — no point compressing or uploading
      // anything before knowing whether it's within what we support at all.
      let durationSec: number | null = null;
      try {
        durationSec = await getAudioDuration(file);
      } catch {
        // Some formats/browsers can't report this — not fatal, per-chunk
        // server-side limits still apply regardless.
      }
      if (cancelledRef.current) return;
      if (durationSec && durationSec > MAX_DURATION_HOURS * 3600) {
        const hours = Math.round((durationSec / 3600) * 10) / 10;
        setState({ phase: "error", message: `This file is about ${hours} hours long — CineFlow currently supports up to ${MAX_DURATION_HOURS} hours per file.` });
        return;
      }
      if (durationSec && durationSec > 45 * 60) {
        toast("This one's long — it might take a few minutes.");
      }

      // Compress if it's over Whisper's limit — most files skip this.
      let working = file;
      if (working.size > WHISPER_MAX_BYTES) {
        setProgress(3, "Compressing your audio…");
        const { compressAudioForWhisper } = await import("@/lib/ffmpeg-compress");
        working = await compressAudioForWhisper(working, (pct) => setProgress(3 + pct * 0.22));
        if (cancelledRef.current) return;
      }

      // Split into pieces if it's still too big even compressed — only
      // genuinely long recordings ever reach this.
      let chunkFiles: File[];
      if (working.size > WHISPER_MAX_BYTES) {
        setProgress(28, "Preparing your audio…");
        chunkFiles = (await splitAudioIntoChunks(working, CHUNK_SECONDS, (pct) => setProgress(28 + pct * 0.10))).map((c) => c.file);
        if (cancelledRef.current) return;
      } else {
        chunkFiles = [working];
      }

      // Transcribe each piece — one API call per piece, stitched back into
      // one continuous transcript with correctly-offset real timestamps.
      // Nothing about this loop is visible to the person waiting; the
      // progress bar just advances smoothly across all of it.
      let combinedText = "";
      const combinedWords: WhisperWord[] = [];
      let cumulativeOffset = 0;
      let totalDuration = 0;
      const loopSpan = 57; // 38% -> 95%

      for (let i = 0; i < chunkFiles.length; i++) {
        if (cancelledRef.current) return;
        const chunkFile = chunkFiles[i];
        const baseProgress = 38 + (i / chunkFiles.length) * loopSpan;
        const perChunkSpan = loopSpan / chunkFiles.length;
        setProgress(baseProgress, "Uploading your audio…");

        const prepRes = await fetch("/api/transcribe/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: chunkFile.name }),
          signal: controller.signal,
        });
        if (!prepRes.ok) {
          const d = await prepRes.json().catch(() => ({}));
          setState({ phase: "error", message: d.error ?? "Failed to prepare upload" });
          return;
        }
        const { signedUrl, path } = await prepRes.json();

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = baseProgress + (e.loaded / e.total) * perChunkSpan * 0.6;
              setProgress(pct);
            }
          };
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
          xhr.open("PUT", signedUrl);
          xhr.setRequestHeader("Content-Type", chunkFile.type || "audio/mpeg");
          xhr.send(chunkFile);
        });
        if (cancelledRef.current) return;

        setProgress(baseProgress + perChunkSpan * 0.6, "Transcribing your audio…");
        // The client just created this chunk, so it knows its real target
        // length — used to charge the per-user minutes budget before
        // Whisper is even called, rather than trusting an unverified guess.
        const estimatedDurationSec = await getAudioDuration(chunkFile).catch(() => CHUNK_SECONDS);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, estimatedDurationSec }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setState({ phase: "error", message: d.error ?? "Transcription failed. Try again." });
          return;
        }

        const data = await res.json();
        const chunkWords: WhisperWord[] = Array.isArray(data.words) ? data.words : [];
        combinedText += (combinedText ? " " : "") + String(data.text ?? "").trim();
        for (const w of chunkWords) combinedWords.push({ ...w, start: w.start + cumulativeOffset, end: w.end + cumulativeOffset });
        const thisChunkDuration = Number(data.duration) || estimatedDurationSec;
        cumulativeOffset += thisChunkDuration;
        totalDuration += thisChunkDuration;
      }

      setProgress(97, "Finishing up…");
      const finalDuration = totalDuration || durationSec;
      const done: DoneState = { filename: file.name, fileSize: file.size, text: combinedText, duration: finalDuration };

      // Export/cutting works from the pristine original whenever it's a
      // reasonable size — better quality than the compressed copy used
      // just to get through Whisper. Only falls back for genuinely huge
      // originals, so IndexedDB and later ffmpeg re-processing (Export
      // Cuts) never have to handle a multi-hundred-MB blob.
      const exportSourceFile = file.size <= EXPORT_SOURCE_MAX_BYTES ? file : working;

      setState({ phase: "done", file, text: done.text, duration: done.duration, liveAudio: { file: exportSourceFile, words: combinedWords } });
      try { localStorage.setItem(LS_KEY, JSON.stringify(done)); } catch {}
      saveCurrentAudio(exportSourceFile, combinedWords).catch((e) => console.error("[transcriber] failed to persist audio for refresh-survival:", e));
    } catch (e: any) {
      // A user-initiated cancel already reset state and showed its own
      // toast in cancelUpload() — don't overwrite that with an error screen.
      if (cancelledRef.current || e?.name === "AbortError") return;
      setState({ phase: "error", message: e.message ?? "Something went wrong. Try again." });
    }
  }, []);

  const transcribe = useCallback(async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setState({ phase: "error", message: "Unsupported format. Use MP3, M4A, WAV, OGG, FLAC, or AAC." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ phase: "error", message: `That file is too large (${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB) — CineFlow supports up to 2 GB per file.` });
      return;
    }
    // Compression and, for genuinely long recordings, splitting both happen
    // automatically inside here — no separate confirmation step.
    await processAndTranscribe(file);
  }, [processAndTranscribe]);

  // dragenter/dragleave fire per-element, not just for the dropzone as a
  // whole — moving the cursor from the outer box onto a child (the icon,
  // the text) fires a dragleave on the box itself, immediately followed by
  // a dragenter, which flickered the "drop to transcribe" state on and off
  // rapidly. A counter (rather than a plain boolean) only turns it off once
  // every nested enter has been matched by a leave.
  const dragCounterRef = useRef(0);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current++;
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
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
    try {
      await navigator.clipboard.writeText(state.text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
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

  // Creates the transcript's database row — the one piece both "Save
  // transcript" and "Save cut list" ultimately depend on. Pulled out on its
  // own so a cut list can trigger it too: previously, saving a cut list
  // silently required the transcript to already be saved first, with no
  // indication that was even a requirement — this way one click always
  // does whatever hasn't happened yet.
  async function persistTranscriptSave(project: Project | null): Promise<string> {
    if (state.phase !== "done") throw new Error("Nothing to save yet");
    const label = project ? project.title : "Personal";
    const saved = await saveProjectTranscript({
      projectId: project?.id ?? null,
      filename: state.file.name,
      fileSizeBytes: state.file.size,
      durationSecs: state.duration,
      transcript: state.text,
    });
    setSavedTranscriptId(saved.id);
    setSavedToProject(label);
    // Persist the save itself, not just the text — otherwise a refresh
    // forgets this transcript was ever saved at all.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) localStorage.setItem(LS_KEY, JSON.stringify({ ...JSON.parse(raw), transcriptId: saved.id, projectLabel: label }));
    } catch {}
    setHistoryKey((k) => k + 1);
    return saved.id;
  }

  function ensureProjectsLoaded() {
    if (projects.length === 0) getProjects().then(setProjects).catch(() => {});
  }

  async function saveToProject(project: Project | null) {
    if (state.phase !== "done") return;
    setSavingProject(true);
    const label = project ? project.title : "Personal";
    try {
      await persistTranscriptSave(project);
      setShowProjectPicker(false);
      setTimeout(() => setLibraryOpen(true), 400);
      toast.success(project ? `Saved to "${label}"` : "Saved to Personal");
    } catch (e: any) { toast.error(e.message ?? "Failed to save"); }
    finally { setSavingProject(false); }
  }

  // Single entry point the AI panel calls to save a cut list, regardless of
  // whether the transcript was ever explicitly saved first. That two-step
  // requirement — save the transcript, THEN a separate cut-list Save button
  // appears — was the actual cause of cut lists silently never reaching the
  // database: the second button simply didn't exist yet, with nothing
  // telling you so. This collapses both into one action.
  async function saveCutListCombined(cutList: CutListSave, project: Project | null) {
    const id = savedTranscriptId ?? (await persistTranscriptSave(project));
    await appendTranscriptCutList(id, cutList);
    // Reflect it immediately in the "Saved Cut Lists" section, and in the
    // Library's badge count, without needing to reopen the transcript.
    setSavedCutLists((prev) => [cutList, ...prev]);
    setHistoryKey((k) => k + 1);
  }

  function startEdit() {
    if (state.phase !== "done") return;
    setEditText(state.text);
    setIsEditing(true);
  }

  async function saveEdit() {
    if (state.phase !== "done") return;
    setState({ ...state, text: editText });
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) localStorage.setItem(LS_KEY, JSON.stringify({ ...JSON.parse(raw), text: editText }));
    } catch {}

    // This transcript already has a database row — persist the edit there
    // too, or "Transcript updated" would be a lie: without this, the edit
    // only lived in this browser tab and would silently vanish on reload.
    if (savedTranscriptId) {
      setSavingEdit(true);
      try {
        await updateProjectTranscriptText(savedTranscriptId, editText);
        toast.success("Transcript updated");
      } catch {
        toast.error("Updated here, but failed to save — your edit may not persist.");
      } finally {
        setSavingEdit(false);
      }
    } else {
      toast.success("Transcript updated (save it to a project to keep this permanently)");
    }
    setIsEditing(false);
  }

  function reset() {
    setState({ phase: "idle" });
    setCopied(false);
    setSavedToProject(null);
    setSavedTranscriptId(null);
    setSavedCutLists([]);
    setShowProjectPicker(false);
    setIsEditing(false);
    setLibraryOpen(false);
    try { localStorage.removeItem(LS_KEY); } catch {}
    clearCurrentAudio().catch(() => {});
  }

  function loadTranscript(t: ProjectTranscriptWithProject) {
    const fakeFile = new File([], t.filename, { type: "audio/mpeg" });
    setState({ phase: "done", file: fakeFile, text: t.transcript, duration: t.duration_secs ?? null, liveAudio: null });
    setSavedToProject(t.project_title ?? "Personal");
    setSavedTranscriptId(t.id);
    setSavedCutLists(t.cut_lists ?? []);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        filename: t.filename, fileSize: 0, text: t.transcript, duration: t.duration_secs ?? null,
        transcriptId: t.id, projectLabel: t.project_title ?? "Personal",
      }));
    } catch {}
    // A saved transcript never has live audio behind it — clear any stale
    // blob from a previous live session so it can't be mistakenly restored.
    clearCurrentAudio().catch(() => {});
  }

  // ── IDLE / ERROR ─────────────────────────────────────────────────────────
  if (state.phase === "idle" || state.phase === "error") {
    return (
      <div className="flex h-full overflow-hidden">
        <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT.join(",")} className="hidden" onChange={onFileChange} />

        {/* Left: Upload zone */}
        <div className="flex flex-1 items-center justify-center border-r border-border p-8">
          <div
            onDragEnter={onDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={onDragLeave}
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
            <p className="mt-1.5 text-xs text-muted-foreground">MP3 · M4A · WAV · OGG · FLAC · AAC</p>
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

  // ── PROCESSING: one smooth bar for compress → split → transcribe → stitch ──
  if (state.phase === "processing") {
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
          <p className="text-[11px] text-muted-foreground/60">Catching every word · large files may take a few minutes</p>
          <button
            onClick={cancelUpload}
            className="text-xs text-muted-foreground/60 hover:text-red-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── DONE: split workspace ─────────────────────────────────────────────────
  const wordCount = state.text.trim() ? state.text.trim().split(/\s+/).length : 0;

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
            <ProjectPicker
              projects={projects}
              heading="Save transcript"
              className="top-10"
              onClose={() => setShowProjectPicker(false)}
              onPick={saveToProject}
            />
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
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 disabled:opacity-60 transition-colors"
                >
                  {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
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
          <AIContentPanel
            transcript={state.text}
            filename={state.file.name}
            liveAudio={state.liveAudio}
            duration={state.duration}
            savedTranscriptId={savedTranscriptId}
            savedCutLists={savedCutLists}
            projects={projects}
            onLoadProjects={ensureProjectsLoaded}
            onSaveCutList={saveCutListCombined}
          />
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
            <TranscriptHistory key={historyKey} onLoadTranscript={loadTranscript} />
          </div>
        )}
      </div>
    </div>
  );
}
