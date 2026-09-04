"use client";

import { useRef, useState } from "react";
import {
  Sparkles, Loader2, Copy, CheckCheck, ChevronDown, ChevronUp, Save,
  Download, ArrowRight, FileText, Users, Scissors, Clapperboard, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CutListSave } from "@/lib/supabase/queries";
import { findQuoteTimestamp, type WhisperWord } from "@/lib/transcript-align";
import { buildMarkerFile, NLE_LABELS, NEEDS_FRAME_RATE, IMPORT_INSTRUCTIONS, MARKER_FRAME_RATES, type NleTarget } from "@/lib/marker-export";
import { SavedCutListCard } from "@/components/editor-tools/SavedCutListCard";
import { ProjectPicker } from "@/components/editor-tools/ProjectPicker";
import type { Project } from "@/types";

const NLE_TARGETS: NleTarget[] = ["fcpx", "premiere", "resolve", "universal"];

function fmtTime(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ── Format definitions ────────────────────────────────────────────────────────

const VIDEO_FORMATS = [
  { key: "reel_30",       label: "30s Reel" },
  { key: "reel_60",       label: "60s Reel" },
  { key: "tiktok",        label: "TikTok" },
  { key: "podcast",       label: "Podcast" },
  { key: "youtube_short", label: "YT Short" },
] as const;

const PRODUCTION_FORMATS = [
  { key: "commercial",  label: "Commercial" },
  { key: "brand_video", label: "Website / Brand" },
  { key: "testimonial", label: "Testimonial" },
  { key: "trailer",     label: "Trailer / Sizzle" },
  { key: "wedding",     label: "Wedding Highlight" },
  { key: "documentary", label: "Documentary" },
] as const;

const MEETING_FORMATS = [
  { key: "meeting_summary", label: "Meeting Summary" },
  { key: "key_takeaways",   label: "Key Takeaways" },
] as const;

const VIBES = ["Fast Cuts", "Emotional", "Comedic", "Hype", "Cinematic"] as const;

// "Auto" preserves today's behavior (the format's own built-in target).
// Everything else is an explicit deliverable spec — the way agencies
// actually think about length (a media buy is sold as :15/:30/:60, not
// "15-60 seconds").
const DURATION_OPTIONS = [
  { key: "auto",   label: "Auto" },
  { key: "15",     label: ":15" },
  { key: "30",     label: ":30" },
  { key: "60",     label: ":60" },
  { key: "90",     label: ":90" },
  { key: "120",    label: "2 min" },
  { key: "custom", label: "Custom" },
] as const;

function fmtDuration(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

// Every format that produces a cut list (not a text summary) gets the Vibe
// picker and "Director's Brief" framing — Production formats included.
const VIDEO_FORMAT_KEYS = new Set([...VIDEO_FORMATS, ...PRODUCTION_FORMATS].map((f) => f.key));

// ── Label styling ─────────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  "HOOK":           "bg-amber-500/15 text-amber-400 border-amber-500/25",
  "CORE MESSAGE":   "bg-blue-500/15 text-blue-400 border-blue-500/25",
  "STORY BEAT":     "bg-sky-500/15 text-sky-400 border-sky-500/25",
  "HUMOR BEAT":     "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  "EMOTIONAL BEAT": "bg-violet-500/15 text-violet-400 border-violet-500/25",
  "ENERGY HIT":     "bg-orange-500/15 text-orange-400 border-orange-500/25",
  "TRANSITION":     "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
  "CALLBACK":       "bg-pink-500/15 text-pink-400 border-pink-500/25",
  "CLOSE":          "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "OUTRO":          "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

const LABEL_LEFT_BORDER: Record<string, string> = {
  "HOOK":           "border-l-amber-500",
  "CORE MESSAGE":   "border-l-blue-500",
  "STORY BEAT":     "border-l-sky-500",
  "HUMOR BEAT":     "border-l-yellow-500",
  "EMOTIONAL BEAT": "border-l-violet-500",
  "ENERGY HIT":     "border-l-orange-500",
  "TRANSITION":     "border-l-zinc-600",
  "CALLBACK":       "border-l-pink-500",
  "CLOSE":          "border-l-emerald-500",
  "OUTRO":          "border-l-zinc-600",
};

// ── Output types ──────────────────────────────────────────────────────────────

type MeetingSummaryData = {
  overview: string;
  topics: string[];
  key_decisions: string[];
  action_items: string[];
  notable_quotes?: { quote: string; speaker?: string | null }[];
};

type KeyTakeawaysData = {
  summary: string;
  takeaways: { headline: string; detail: string }[];
};

type AIOutput =
  | { kind: "cut_list"; data: CutListSave }
  | { kind: "meeting_summary"; data: MeetingSummaryData }
  | { kind: "key_takeaways"; data: KeyTakeawaysData };

// ── Helper ────────────────────────────────────────────────────────────────────

function useCopyText() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }
  return { copiedKey, copy };
}

function meetingText(d: MeetingSummaryData): string {
  let t = `MEETING SUMMARY\n\nOVERVIEW\n${d.overview}`;
  if (d.topics.length) t += `\n\nTOPICS DISCUSSED\n${d.topics.map((x) => `• ${x}`).join("\n")}`;
  if (d.key_decisions.length) t += `\n\nKEY DECISIONS\n${d.key_decisions.map((x) => `✓ ${x}`).join("\n")}`;
  if (d.action_items.length) t += `\n\nACTION ITEMS\n${d.action_items.map((x) => `→ ${x}`).join("\n")}`;
  if (d.notable_quotes?.length) t += `\n\nNOTABLE QUOTES\n${d.notable_quotes.map((q) => `"${q.quote}"${q.speaker ? ` — ${q.speaker}` : ""}`).join("\n")}`;
  return t.trim();
}

function takeawaysText(d: KeyTakeawaysData): string {
  let t = `KEY TAKEAWAYS`;
  if (d.summary) t += `\n\n${d.summary}`;
  t += `\n\n${d.takeaways.map((tk, i) => `${i + 1}. ${tk.headline}\n   ${tk.detail}`).join("\n\n")}`;
  return t.trim();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  transcript: string;
  filename: string;
  // `file` is null when this transcript's word timestamps were restored
  // from a saved transcript but its audio wasn't fetched into memory (or
  // was never durably stored) — grounding cut-list quotes to real timestamps
  // only needs `words`; only Export Cuts (real ffmpeg bytes) needs `file`.
  liveAudio?: { file: File | null; words: WhisperWord[] } | null;
  duration?: number | null;
  // Whether the transcript itself already has a database row — when it
  // doesn't yet, saving a cut list also has to ask which project it belongs
  // to (same choice the standalone transcript-save flow offers) before it
  // can save anything, since there's nowhere to attach it yet.
  savedTranscriptId?: string | null;
  onSaveCutList?: (cutList: CutListSave, project: Project | null) => Promise<void>;
  savedCutLists?: CutListSave[];
  projects?: Project[];
  onLoadProjects?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIContentPanel({
  transcript, filename, liveAudio, duration, savedTranscriptId, onSaveCutList, savedCutLists, projects, onLoadProjects,
}: Props) {
  const [format, setFormat] = useState<string>("reel_30");
  const [vibes, setVibes] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<AIOutput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [expandedCuts, setExpandedCuts] = useState<Record<number, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [nleTarget, setNleTarget] = useState<NleTarget>("fcpx");
  const [exportFps, setExportFps] = useState<number>(30);
  const [targetDurationKey, setTargetDurationKey] = useState<string>("auto");
  const [customSeconds, setCustomSeconds] = useState("");
  const { copiedKey, copy } = useCopyText();
  const outputRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [showSavePicker, setShowSavePicker] = useState(false);

  const isVideo = VIDEO_FORMAT_KEYS.has(format as any);

  // The AI's "total_duration" is just a guess. Whenever real timestamps
  // resolved, prefer a measured length — the sum of each matched cut's real
  // duration (plus the same padding the export applies) — over trusting a
  // number the model invented.
  const measuredDurationSec = (() => {
    if (!output || output.kind !== "cut_list") return null;
    const resolved = output.data.cuts.filter((c) => c.real_start_sec != null && c.real_end_sec != null);
    if (resolved.length === 0) return null;
    return resolved.reduce((sum, c) => sum + (c.real_end_sec! - c.real_start_sec!) + 0.3, 0);
  })();

  // null = "auto", use the format's own built-in target
  function resolveTargetSeconds(): number | null {
    if (targetDurationKey === "auto") return null;
    if (targetDurationKey === "custom") {
      const n = parseInt(customSeconds, 10);
      // The input's max is just a UI hint — clamp for real, so a pasted or
      // typed-past-the-limit value can't produce a malformed request.
      return Number.isFinite(n) && n > 0 ? Math.min(n, 600) : null;
    }
    const n = parseInt(targetDurationKey, 10);
    return Number.isFinite(n) ? n : null;
  }

  function toggleVibe(v: string) {
    setVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }

  function selectFormat(key: string) {
    setFormat(key);
    setOutput(null);
    setSaved(false);
    setShowSavePicker(false);
  }

  async function generate() {
    setGenerating(true);
    setOutput(null);
    setSaved(false);
    setShowSavePicker(false);
    const requestedDurationSec = isVideo ? resolveTargetSeconds() : null;
    try {
      const res = await fetch("/api/transcribe/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript, format, brief: context,
          vibes: isVideo ? vibes : [],
          targetDurationSec: requestedDurationSec,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "AI generation failed");
        return;
      }
      const json = await res.json();

      if (json.type === "cut_list") {
        const words = liveAudio?.words ?? [];
        const cuts = (json.cutList.cuts ?? []).map((c: CutListSave["cuts"][number]) => {
          if (words.length === 0) return c;
          const match = findQuoteTimestamp(c.quote, words);
          return match
            ? { ...c, real_start_sec: match.start, real_end_sec: match.end }
            : c;
        });
        setOutput({
          kind: "cut_list",
          data: { ...json.cutList, cuts, brief: context, saved_at: new Date().toISOString(), requested_duration_sec: requestedDurationSec },
        });
      } else if (json.type === "meeting_summary") {
        setOutput({ kind: "meeting_summary", data: json.summary });
      } else if (json.type === "key_takeaways") {
        setOutput({ kind: "key_takeaways", data: json.takeaways });
      } else {
        toast.error("Got an unexpected response. Try again.");
        return;
      }

      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      toast.error("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  // One button, one action, regardless of whether the transcript has ever
  // been saved before. If it hasn't, `project` is undefined on the first
  // call — instead of failing or saving into a void, this opens the same
  // "which project" choice the standalone transcript-save flow offers,
  // right here, then saves both the transcript and this cut list together
  // as soon as one is picked.
  async function saveList(project?: Project | null) {
    if (!output || output.kind !== "cut_list" || !onSaveCutList) return;
    if (!savedTranscriptId && project === undefined) {
      setShowSavePicker(true);
      onLoadProjects?.();
      return;
    }
    setShowSavePicker(false);
    setSaving(true);
    try {
      await onSaveCutList(output.data, project ?? null);
      setSaved(true);
      toast.success(savedTranscriptId ? "Cut list saved to project" : "Transcript & cut list saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function exportCuts() {
    if (!output || output.kind !== "cut_list" || !liveAudio?.file) return;
    const resolvable = output.data.cuts
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.real_start_sec != null && x.c.real_end_sec != null);

    if (resolvable.length === 0) {
      toast.error("None of these soundbites could be matched to an exact timestamp.");
      return;
    }

    setExporting(true);
    setExportProgress(0);
    try {
      const { exportCutsZip } = await import("@/lib/audio-export");
      const cuts = resolvable.map(({ c, i }) => ({
        index: i + 1,
        label: c.label,
        quote: c.quote,
        start: c.real_start_sec as number,
        end: c.real_end_sec as number,
      }));
      const totalDuration = duration ?? Math.max(...cuts.map((c) => c.end)) + 1;
      const markerFile = buildMarkerFile(nleTarget, cuts, totalDuration, exportFps);
      const { blob, includedCount } = await exportCutsZip(liveAudio.file, cuts, 0.15, setExportProgress, markerFile);

      const url = URL.createObjectURL(blob);
      const baseName = filename.replace(/\.[^.]+$/, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-soundbites.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      const skipped = output.data.cuts.length - includedCount;
      const nleLabel = NLE_LABELS[nleTarget];
      toast.success(
        skipped > 0
          ? `Exported ${includedCount} soundbites + ${nleLabel} markers — ${skipped} couldn't be matched to an exact timestamp.`
          : `Exported ${includedCount} soundbites + ${nleLabel} markers`
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed. Try again.");
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  }

  async function downloadPDF() {
    if (!output) return;
    setPdfLoading(true);
    try {
      let aiContent: Record<string, unknown>;
      let suffix: string;

      if (output.kind === "cut_list") {
        aiContent = { type: "cut_list", ...output.data };
        suffix = "cut-list";
      } else if (output.kind === "meeting_summary") {
        aiContent = { type: "meeting_summary", ...output.data };
        suffix = "meeting-summary";
      } else {
        aiContent = { type: "key_takeaways", ...output.data };
        suffix = "key-takeaways";
      }

      const res = await fetch("/api/transcribe/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, aiContent }),
      });
      if (!res.ok) throw new Error("PDF failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const baseName = filename.replace(/\.[^.]+$/, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-${suffix}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("PDF downloaded");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("PDF generation failed");
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const generateLabel = format === "meeting_summary"
    ? "Generate Meeting Summary"
    : format === "key_takeaways"
    ? "Extract Key Takeaways"
    : "Generate Cut List";

  return (
    <div className="rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#d4a853]/15 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a853]/15">
          <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">AI Content Intelligence</p>
          <p className="text-[11px] text-muted-foreground">Cut lists, meeting summaries, and key takeaways</p>
        </div>
      </div>

      <div ref={controlsRef} className="space-y-5 p-5">

        {/* Video formats */}
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Video</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {VIDEO_FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => selectFormat(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  format === f.key
                    ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                    : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Production formats */}
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <Clapperboard className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Production</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRODUCTION_FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => selectFormat(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  format === f.key
                    ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                    : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting formats */}
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <Users className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calls &amp; Meetings</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {MEETING_FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => selectFormat(f.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  format === f.key
                    ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                    : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Length — video only */}
        {isVideo && (
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Length <span className="font-normal normal-case text-muted-foreground/50">— optional</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setTargetDurationKey(d.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    targetDurationKey === d.key
                      ? "border-[#d4a853] bg-[#d4a853]/15 text-[#d4a853]"
                      : "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
              {targetDurationKey === "custom" && (
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-white/[0.03] px-3 py-1 transition-colors focus-within:border-[#d4a853]/50 focus-within:ring-1 focus-within:ring-[#d4a853]/30">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={customSeconds}
                    onChange={(e) => setCustomSeconds(e.target.value)}
                    placeholder="22"
                    autoFocus
                    className="w-10 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              )}
            </div>
            {/* Set the expectation before they ever see a mismatch — the AI
                picks quotes by reading the transcript, before real timestamps
                exist to check against, so the assembled length is aimed at
                the target, not locked to it. Saying so here means "Actual
                0:37" on a :30 target reads as normal, not broken. */}
            {targetDurationKey !== "auto" && (
              <p className="mt-2 text-[11px] text-muted-foreground/50 leading-relaxed">
                A target, not a guarantee — real speech doesn&apos;t cut to the exact second, so the finished length can land a few seconds off.
              </p>
            )}
          </div>
        )}

        {/* Vibe — video only */}
        {isVideo && (
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Vibe <span className="font-normal normal-case text-muted-foreground/50">— optional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button
                  key={v}
                  onClick={() => toggleVibe(v)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-all",
                    vibes.includes(v)
                      ? "border-white/20 bg-white/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-white/20 hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Context / Director's Brief */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isVideo ? "Director's Brief" : "Context"}
            <span className="ml-1 font-normal normal-case text-muted-foreground/50">— optional</span>
          </p>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={3}
            placeholder={isVideo
              ? `Describe your vision...\ne.g. "Start with birthday wishes, quick cuts that flow like one sentence"`
              : `Add context about this call...\ne.g. "Client discovery call with Sarah about Q3 marketing budget"`
            }
            className="w-full resize-none rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-[#d4a853]/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Generate */}
        <button
          onClick={generate}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black hover:bg-[#d4a853]/90 disabled:opacity-60 transition-colors"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {generateLabel}</>
          )}
        </button>
      </div>

      {/* ── OUTPUT ─────────────────────────────────────────────────────────── */}

      {output && (
        <div ref={outputRef} className="border-t border-[#d4a853]/15">

          {/* ── CUT LIST ── */}
          {output.kind === "cut_list" && (
            <>
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{output.data.format}</p>
                    <p className="text-xs text-muted-foreground">
                      {output.data.requested_duration_sec != null && (
                        <>Target {fmtDuration(output.data.requested_duration_sec)} · </>
                      )}
                      {measuredDurationSec != null ? (
                        <>Actual {fmtDuration(measuredDurationSec)} <span className="text-muted-foreground/40">(real speech length)</span></>
                      ) : (
                        <>Est. {output.data.total_duration}</>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    ↑ Change settings
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={generate}
                    disabled={generating}
                    title="Generate a new attempt with the same settings"
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60 transition-colors"
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    {generating ? "Regenerating…" : "Regenerate"}
                  </button>
                  {liveAudio?.file && (
                    <>
                      <select
                        value={nleTarget}
                        onChange={(e) => setNleTarget(e.target.value as NleTarget)}
                        disabled={exporting}
                        title="Which editor's marker format to include"
                        className="shrink-0 rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-xs text-muted-foreground disabled:opacity-60 transition-colors focus:border-[#d4a853]/50 focus:outline-none"
                      >
                        {NLE_TARGETS.map((t) => (
                          <option key={t} value={t}>{NLE_LABELS[t]}</option>
                        ))}
                      </select>
                      {NEEDS_FRAME_RATE[nleTarget] && (
                        <select
                          value={exportFps}
                          onChange={(e) => setExportFps(Number(e.target.value))}
                          disabled={exporting}
                          title="Your project's frame rate — markers are timecode-based and only land in the right place if this matches"
                          className="shrink-0 rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-xs text-muted-foreground disabled:opacity-60 transition-colors focus:border-[#d4a853]/50 focus:outline-none"
                        >
                          {MARKER_FRAME_RATES.map((fps) => (
                            <option key={fps} value={fps}>{fps} fps</option>
                          ))}
                        </select>
                      )}
                      <button
                        onClick={exportCuts}
                        disabled={exporting}
                        title="Cut soundbites and download markers + audio for your editor"
                        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 disabled:opacity-60 transition-colors"
                      >
                        {exporting ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> {exportProgress}%</>
                        ) : (
                          <><Scissors className="h-3 w-3" /> Export Cuts</>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => copy(
                      output.data.cuts.map((c) => `[${c.label}] "${c.quote}"${c.speaker ? ` — ${c.speaker}` : ""}\n${c.note}`).join("\n\n"),
                      "all"
                    )}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                  >
                    {copiedKey === "all" ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={pdfLoading}
                    className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                  {onSaveCutList && (
                    <div className="relative shrink-0">
                      <button
                        onClick={() => saveList()}
                        disabled={saving || saved}
                        className={cn(
                          "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                          saved
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border border-border text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                        )}
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        {saved ? "Saved" : "Save"}
                      </button>

                      {showSavePicker && (
                        <ProjectPicker
                          projects={projects ?? []}
                          heading="Save transcript & cut list"
                          className="top-9"
                          onClose={() => setShowSavePicker(false)}
                          onPick={saveList}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!liveAudio && (
                <p className="px-5 pb-3 text-[11px] text-muted-foreground/50 leading-relaxed">
                  No exact timestamps for this transcript — either it predates timestamp support, or the page was refreshed before the audio finished saving. Exact timestamps and clip export need those, so transcribe this file again to get both.
                </p>
              )}

              {liveAudio && !liveAudio.file && (
                <p className="px-5 pb-3 text-[11px] text-muted-foreground/50 leading-relaxed">
                  Soundbites above are matched to exact timestamps, but this transcript&apos;s audio isn&apos;t loaded right now, so clip export isn&apos;t available here — reopen it from a fresh transcription in this tab to export cuts.
                </p>
              )}

              {liveAudio?.file && (
                <p className="px-5 pb-3 text-[11px] text-muted-foreground/50 leading-relaxed">
                  {IMPORT_INSTRUCTIONS[nleTarget]}
                  {NEEDS_FRAME_RATE[nleTarget] && " Set the fps above to match your project's real frame rate — a mismatch shifts every marker by a fraction of a second."}
                </p>
              )}

              <div className="space-y-2 px-5 pb-5">
                {output.data.cuts.map((cut, i) => {
                  const isExpanded = expandedCuts[i] ?? true;
                  const borderColor = LABEL_LEFT_BORDER[cut.label] ?? "border-l-zinc-600";
                  const badgeColor = LABEL_COLORS[cut.label] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25";
                  const hasRealTime = cut.real_start_sec != null && cut.real_end_sec != null;
                  const timeLabel = hasRealTime
                    ? `${fmtTime(cut.real_start_sec as number)}–${fmtTime(cut.real_end_sec as number)}`
                    : null;
                  return (
                    <div key={i} className={cn("rounded-xl border border-border border-l-2 bg-white/[0.02] overflow-hidden", borderColor)}>
                      <button
                        onClick={() => setExpandedCuts((e) => ({ ...e, [i]: !isExpanded }))}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      >
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide", badgeColor)}>
                          {cut.label}
                        </span>
                        {timeLabel ? (
                          <span className="text-[10px] text-muted-foreground/60 shrink-0" title="Real position in the source audio">
                            {timeLabel}
                          </span>
                        ) : liveAudio ? (
                          <span className="text-[10px] text-muted-foreground/30 shrink-0" title="Couldn't be matched to an exact timestamp">
                            —
                          </span>
                        ) : null}
                        <span className="flex-1 truncate text-xs text-foreground/80">&ldquo;{cut.quote}&rdquo;</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border/50 px-4 pb-3 pt-2.5 space-y-2">
                          <p className="text-sm font-medium text-foreground leading-snug">
                            &ldquo;{cut.quote}&rdquo;
                            {cut.speaker && <span className="ml-2 text-xs text-muted-foreground">— {cut.speaker}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground/70 leading-relaxed">{cut.note}</p>
                          <button
                            onClick={() => copy(`"${cut.quote}"${cut.speaker ? ` — ${cut.speaker}` : ""}`, `cut-${i}`)}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            {copiedKey === `cut-${i}` ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            Copy quote
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {output.data.caption_suggestions?.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption Suggestions</p>
                  <div className="space-y-2">
                    {output.data.caption_suggestions.map((cap, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
                        <p className="flex-1 text-xs text-foreground/80 leading-relaxed">{cap}</p>
                        <button onClick={() => copy(cap, `cap-${i}`)} className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                          {copiedKey === `cap-${i}` ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.data.hook_options?.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hook Options</p>
                  <ol className="space-y-2">
                    {output.data.hook_options.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/80">
                        <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853]/15 text-[10px] font-bold text-[#d4a853]">{i + 1}</span>
                        <span className="leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {output.data.editor_notes && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Notes</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">{output.data.editor_notes}</p>
                </div>
              )}
            </>
          )}

          {/* ── MEETING SUMMARY ── */}
          {output.kind === "meeting_summary" && (
            <>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-sm font-bold text-foreground">Meeting Summary</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="whitespace-nowrap text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    ↑ Change settings
                  </button>
                  <button
                    onClick={generate}
                    disabled={generating}
                    title="Generate a new attempt with the same settings"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60 transition-colors"
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    {generating ? "Regenerating…" : "Regenerate"}
                  </button>
                  <button
                    onClick={() => copy(meetingText(output.data), "all")}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                  >
                    {copiedKey === "all" ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={pdfLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                </div>
              </div>

              <div className="px-5 pb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overview</p>
                <p className="text-sm text-foreground/85 leading-relaxed">{output.data.overview}</p>
              </div>

              {output.data.topics.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Topics Discussed</p>
                  <ul className="space-y-2">
                    {output.data.topics.map((topic, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4a853]" />
                        <span className="leading-relaxed">{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {output.data.key_decisions.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Decisions</p>
                  <ul className="space-y-2">
                    {output.data.key_decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" />
                        <span className="leading-relaxed">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {output.data.action_items.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action Items</p>
                  <ul className="space-y-2">
                    {output.data.action_items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#d4a853]" />
                        <span className="leading-relaxed font-medium">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {output.data.notable_quotes && output.data.notable_quotes.length > 0 && (
                <div className="border-t border-border/50 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notable Quotes</p>
                  <div className="space-y-2">
                    {output.data.notable_quotes.map((q, i) => (
                      <div key={i} className="rounded-xl border border-border bg-white/[0.02] px-4 py-3">
                        <p className="text-sm italic text-foreground/85 leading-relaxed">&ldquo;{q.quote}&rdquo;</p>
                        {q.speaker && <p className="mt-1 text-xs text-muted-foreground">— {q.speaker}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── KEY TAKEAWAYS ── */}
          {output.kind === "key_takeaways" && (
            <>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-sm font-bold text-foreground">Key Takeaways</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="whitespace-nowrap text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    ↑ Change settings
                  </button>
                  <button
                    onClick={generate}
                    disabled={generating}
                    title="Generate a new attempt with the same settings"
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground disabled:opacity-60 transition-colors"
                  >
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    {generating ? "Regenerating…" : "Regenerate"}
                  </button>
                  <button
                    onClick={() => copy(takeawaysText(output.data), "all")}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                  >
                    {copiedKey === "all" ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={pdfLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#d4a853]/90 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    PDF
                  </button>
                </div>
              </div>

              {output.data.summary && (
                <div className="px-5 pb-3">
                  <p className="text-xs text-muted-foreground/70 italic leading-relaxed">{output.data.summary}</p>
                </div>
              )}

              <div className="space-y-2 px-5 pb-5">
                {output.data.takeaways.map((t, i) => (
                  <div key={i} className="rounded-xl border border-border bg-white/[0.02] px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4a853]/15 text-[10px] font-bold text-[#d4a853] mt-0.5">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-snug">{t.headline}</p>
                        <p className="mt-1 text-xs text-muted-foreground/80 leading-relaxed">{t.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Saved history lives at the bottom, not the top — saving inserts a
          new card here every time, and this section sitting above the
          active work area meant every save pushed your current scroll
          position down, which looked exactly like an unwanted jump to the
          top. Down here, saving never displaces anything you're looking at. */}
      {savedCutLists && savedCutLists.length > 0 && (
        <div className="border-t border-[#d4a853]/15 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Saved Cut Lists <span className="normal-case font-normal text-muted-foreground/50">({savedCutLists.length})</span>
          </p>
          <div className="space-y-1.5">
            {savedCutLists.map((cl, i) => (
              <SavedCutListCard key={i} cl={cl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
