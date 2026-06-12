"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileAudio, Copy, Download, CheckCheck, X, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCEPTED_EXT = [".mp3", ".mp4", ".m4a", ".wav", ".ogg", ".flac", ".aac", ".webm"];
const MAX_MB = 500;
const MAX_BYTES = MAX_MB * 1024 * 1024;

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

export function AudioTranscriber() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (file.size > MAX_BYTES) return `File is ${formatBytes(file.size)} — max is ${MAX_MB} MB.`;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_EXT.includes(ext)) {
      return "Unsupported format. Use MP3, M4A, WAV, OGG, FLAC, or AAC.";
    }
    return null;
  }

  const transcribe = useCallback(async (file: File) => {
    const err = validateFile(file);
    if (err) { setState({ phase: "error", message: err }); return; }

    setState({ phase: "uploading", file, progress: 0, label: "Preparing upload…" });

    try {
      // Step 1: get a signed upload URL from our API
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

      // Step 2: PUT file directly to Supabase Storage (bypasses Vercel body limit)
      setState({ phase: "uploading", file, progress: 5, label: "Uploading audio…" });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 5 + (e.loaded / e.total) * 65;
            setState((s) =>
              s.phase === "uploading" ? { ...s, progress: pct, label: "Uploading audio…" } : s
            );
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "audio/mpeg");
        xhr.send(file);
      });

      // Step 3: send path to our API — it downloads from Supabase and calls Whisper
      setState({ phase: "uploading", file, progress: 72, label: "Transcribing with Whisper…" });

      // Simulate progress while waiting for Whisper
      let prog = 72;
      const tick = setInterval(() => {
        prog = Math.min(prog + Math.random() * 4, 92);
        setState((s) =>
          s.phase === "uploading" ? { ...s, progress: prog, label: "Transcribing with Whisper…" } : s
        );
      }, 800);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      clearInterval(tick);

      if (!transcribeRes.ok) {
        const d = await transcribeRes.json().catch(() => ({}));
        setState({ phase: "error", message: d.error ?? "Transcription failed. Try again." });
        return;
      }

      const data = await transcribeRes.json();
      setState({ phase: "done", file, text: data.text ?? "", duration: data.duration ?? null });
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
        a.href = url;
        a.download = `${basename}-transcript.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        toast.success("Transcript downloaded");
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  function reset() {
    setState({ phase: "idle" });
    setCopied(false);
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
            dragging
              ? "border-[#d4a853] bg-[#d4a853]/5"
              : "border-border hover:border-[#d4a853]/50 hover:bg-white/[0.02]"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT.join(",")}
            className="hidden"
            onChange={onFileChange}
          />
          <div className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
            dragging ? "border-[#d4a853]/40 bg-[#d4a853]/10" : "border-border bg-white/[0.03]"
          )}>
            {dragging
              ? <Upload className="h-6 w-6 text-[#d4a853]" />
              : <FileAudio className="h-6 w-6 text-muted-foreground" />
            }
          </div>
          <p className="text-sm font-semibold text-foreground">
            {dragging ? "Drop to transcribe" : "Drop audio here or click to browse"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            MP3 · M4A · WAV · OGG · FLAC · AAC · up to {MAX_MB} MB
          </p>

          {state.phase === "error" && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {state.message}
            </div>
          )}
        </div>
      )}

      {/* Uploading / transcribing */}
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
              <div
                className="h-full rounded-full bg-[#d4a853] transition-all duration-500"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">{Math.round(state.progress)}%</p>
          </div>
          <p className="text-[11px] text-muted-foreground/60">Powered by OpenAI Whisper · large files may take 30–60s</p>
        </div>
      )}

      {/* Done */}
      {state.phase === "done" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <FileAudio className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{state.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(state.file.size)}
                {state.duration ? ` · ${formatDuration(state.duration)}` : ""}
                {" · "}{state.text.trim().split(/\s+/).length.toLocaleString()} words
              </p>
            </div>
            <button onClick={reset} className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-border bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
              <div className="flex items-center gap-2">
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
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#d4a853]/90 disabled:opacity-50 transition-colors"
                >
                  {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {pdfLoading ? "Generating…" : "Download PDF"}
                </button>
              </div>
            </div>
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar p-5">
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">{state.text}</p>
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground transition-colors"
          >
            + Transcribe another file
          </button>
        </div>
      )}
    </div>
  );
}
