"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic2, Upload, FileAudio, Loader2, ChevronDown, ChevronUp, Trash2, AlertCircle, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import {
  getProjectTranscripts,
  saveProjectTranscript,
  appendTranscriptCutList,
  deleteProjectTranscript,
  type ProjectTranscript,
  type CutListSave,
} from "@/lib/supabase/queries";


const ACCEPTED_EXT = [".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm"];

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; file: File; progress: number; label: string }
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  projectId: string;
}

export function AudioTab({ projectId }: Props) {
  const [transcripts, setTranscripts] = useState<ProjectTranscript[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectTranscripts(projectId)
      .then(setTranscripts)
      .catch(() => toast.error("Failed to load transcripts"))
      .finally(() => setLoading(false));
  }, [projectId]);
  const [upload, setUpload] = useState<UploadState>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transcribeAndSave = useCallback(async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      setUpload({ phase: "error", message: "Unsupported format. Use MP3, M4A, WAV, OGG, FLAC, or AAC." });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setUpload({ phase: "error", message: `File is ${mb} MB — Whisper's maximum is 25 MB. Try compressing or trimming the audio.` });
      return;
    }

    setUpload({ phase: "uploading", file, progress: 0, label: "Preparing…" });

    try {
      // Step 1: get signed upload URL
      const prepRes = await fetch("/api/transcribe/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      if (!prepRes.ok) {
        const d = await prepRes.json().catch(() => ({}));
        setUpload({ phase: "error", message: d.error ?? "Failed to prepare upload" });
        return;
      }
      const { signedUrl, path } = await prepRes.json();

      // Step 2: upload directly to Supabase (bypasses Vercel body limit)
      setUpload({ phase: "uploading", file, progress: 5, label: "Uploading audio…" });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 5 + (e.loaded / e.total) * 65;
            setUpload((s) => s.phase === "uploading" ? { ...s, progress: pct, label: "Uploading audio…" } : s);
          }
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
        xhr.send(file);
      });

      // Step 3: transcribe
      let prog = 72;
      const tick = setInterval(() => {
        prog = Math.min(prog + Math.random() * 3, 92);
        setUpload((s) => s.phase === "uploading" ? { ...s, progress: prog, label: "Transcribing with Whisper…" } : s);
      }, 800);
      setUpload({ phase: "uploading", file, progress: 72, label: "Transcribing with Whisper…" });

      const txRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      clearInterval(tick);

      if (!txRes.ok) {
        const d = await txRes.json().catch(() => ({}));
        setUpload({ phase: "error", message: d.error ?? "Transcription failed" });
        return;
      }
      const { text, duration } = await txRes.json();

      // Step 4: save to project
      setUpload({ phase: "uploading", file, progress: 98, label: "Saving to project…" });
      const saved = await saveProjectTranscript({
        projectId,
        filename: file.name,
        fileSizeBytes: file.size,
        durationSecs: duration ?? null,
        transcript: text,
      });

      setTranscripts((prev) => [saved, ...prev]);
      setExpanded((e) => ({ ...e, [saved.id]: true }));
      setUpload({ phase: "idle" });
      toast.success("Transcript saved to project");
    } catch (e: any) {
      setUpload({ phase: "error", message: e.message ?? "Something went wrong" });
    }
  }, [projectId]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteProjectTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transcript deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  async function handleSaveCutList(transcriptId: string, cutList: CutListSave) {
    await appendTranscriptCutList(transcriptId, cutList);
    setTranscripts((prev) => prev.map((t) =>
      t.id === transcriptId ? { ...t, cut_lists: [cutList, ...(t.cut_lists ?? [])] } : t
    ));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) transcribeAndSave(file);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      {upload.phase === "idle" || upload.phase === "error" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-10 text-center transition-colors select-none",
            dragging ? "border-[#d4a853] bg-[#d4a853]/5" : "border-border hover:border-[#d4a853]/40 hover:bg-white/[0.02]"
          )}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) transcribeAndSave(f); e.target.value = ""; }} />
          <div className={cn("mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors", dragging ? "border-[#d4a853]/40 bg-[#d4a853]/10" : "border-border bg-white/[0.03]")}>
            {dragging ? <Upload className="h-5 w-5 text-[#d4a853]" /> : <Mic2 className="h-5 w-5 text-muted-foreground" />}
          </div>
          <p className="text-sm font-semibold text-foreground">{dragging ? "Drop to transcribe" : "Upload audio to transcribe"}</p>
          <p className="mt-1 text-xs text-muted-foreground">MP3 · M4A · WAV · OGG · FLAC · AAC · up to 25 MB</p>
          {upload.phase === "error" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {upload.message}
            </div>
          )}
        </div>
      ) : (
        /* Upload in progress */
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-white/[0.02] px-8 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Loader2 className="h-5 w-5 animate-spin text-[#d4a853]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{upload.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{upload.file.name} · {formatBytes(upload.file.size)}</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-[#d4a853] transition-all duration-500" style={{ width: `${upload.progress}%` }} />
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{Math.round(upload.progress)}%</p>
          </div>
        </div>
      )}

      {/* Saved transcripts */}
      {transcripts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white/[0.01] py-12 text-center">
          <FileAudio className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No transcripts yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground/50">Upload audio from a shoot and it will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transcripts.map((t) => {
            const isOpen = expanded[t.id] ?? false;
            const wordCount = t.transcript.trim().split(/\s+/).length;
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-white/[0.02] overflow-hidden">
                {/* Transcript header */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-border">
                    <FileAudio className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{t.filename}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {t.duration_secs ? formatDuration(t.duration_secs) : "—"}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText className="h-2.5 w-2.5" />
                        {wordCount.toLocaleString()} words
                      </span>
                      <span className="text-[10px] text-muted-foreground">{formatDate(t.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                      className="rounded-lg p-1.5 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [t.id]: !isOpen }))}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-border/60 p-4 space-y-5">
                    {/* Transcript text */}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar rounded-xl border border-border bg-white/[0.02] p-4">
                        <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{t.transcript}</p>
                      </div>
                    </div>

                    {/* Saved cut lists */}
                    {t.cut_lists?.length > 0 && (
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved Cut Lists ({t.cut_lists.length})</p>
                        <div className="space-y-2">
                          {t.cut_lists.map((cl, i) => (
                            <div key={i} className="rounded-xl border border-border bg-white/[0.02] px-4 py-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-foreground">{cl.format}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(cl.saved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                              </div>
                              {cl.brief && <p className="mt-1 text-[11px] text-muted-foreground/60 italic">"{cl.brief}"</p>}
                              <p className="mt-1 text-[10px] text-muted-foreground">{cl.cuts?.length} cuts · est. {cl.total_duration}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Panel */}
                    <AIContentPanel
                      transcript={t.transcript}
                      filename={t.filename}
                      onSaveCutList={(cl) => handleSaveCutList(t.id, cl)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
