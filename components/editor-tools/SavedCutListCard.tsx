"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CutListSave } from "@/lib/supabase/queries";

// Shared between TranscriptHistory (Library) and AIContentPanel (viewing a
// loaded transcript's saved cut lists directly) — a single saved cut list,
// read-only, expandable.

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

function fmtTime(startSecs: number, endSecs: number) {
  const fmt = (secs: number) => {
    const s = Math.max(0, Math.round(secs));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  return `${fmt(startSecs)}–${fmt(endSecs)}`;
}

function fmtSecs(totalSecs: number) {
  const s = Math.max(0, Math.round(totalSecs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `0:${String(r).padStart(2, "0")}`;
}

export function SavedCutListCard({ cl }: { cl: CutListSave }) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedCuts, setExpandedCuts] = useState<Record<number, boolean>>({});

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  // Same honesty rule as the live view — a measured length from real
  // timestamps beats the AI's self-reported guess, whenever it's available.
  const resolvedCuts = cl.cuts?.filter((c) => c.real_start_sec != null && c.real_end_sec != null) ?? [];
  const measuredSec = resolvedCuts.length > 0
    ? resolvedCuts.reduce((sum, c) => sum + (c.real_end_sec! - c.real_start_sec!) + 0.3, 0)
    : null;

  return (
    <div className="rounded-xl border border-border bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{cl.format}</p>
          {cl.brief && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/50 italic truncate">
              &ldquo;{cl.brief}&rdquo;
            </p>
          )}
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {cl.cuts?.length} cuts ·{" "}
            {measuredSec != null ? <>actual {fmtSecs(measuredSec)} (real speech length)</> : <>est. {cl.total_duration}</>}
            {cl.requested_duration_sec != null && <> · target {fmtSecs(cl.requested_duration_sec)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-[10px] text-muted-foreground/50">
            {new Date(cl.saved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          {open ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60">
          {/* Cuts */}
          <div className="space-y-2 p-3">
            {cl.cuts?.map((cut, i) => {
              const isExpanded = expandedCuts[i] ?? true;
              const borderColor = LABEL_LEFT_BORDER[cut.label] ?? "border-l-zinc-600";
              const badgeColor = LABEL_COLORS[cut.label] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25";
              const hasRealTime = cut.real_start_sec != null && cut.real_end_sec != null;
              const timeLabel = hasRealTime ? fmtTime(cut.real_start_sec as number, cut.real_end_sec as number) : null;
              return (
                <div key={i} className={cn("rounded-xl border border-border border-l-2 bg-white/[0.02] overflow-hidden", borderColor)}>
                  <button
                    onClick={() => setExpandedCuts((e) => ({ ...e, [i]: !isExpanded }))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide", badgeColor)}>
                      {cut.label}
                    </span>
                    {timeLabel && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0" title="Real position in the source audio">
                        {timeLabel}
                      </span>
                    )}
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

          {/* Captions */}
          {cl.caption_suggestions?.length > 0 && (
            <div className="border-t border-border/50 px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caption Suggestions</p>
              <div className="space-y-1.5">
                {cl.caption_suggestions.map((cap, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2">
                    <p className="flex-1 text-xs text-foreground/80 leading-relaxed">{cap}</p>
                    <button onClick={() => copy(cap, `cap-${i}`)} className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      {copiedKey === `cap-${i}` ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hook options */}
          {cl.hook_options?.length > 0 && (
            <div className="border-t border-border/50 px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hook Options</p>
              <ol className="space-y-1.5">
                {cl.hook_options.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/80">
                    <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853]/15 text-[10px] font-bold text-[#d4a853]">{i + 1}</span>
                    <span className="leading-relaxed">{h}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Editor notes */}
          {cl.editor_notes && (
            <div className="border-t border-border/50 px-4 py-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Editor Notes</p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{cl.editor_notes}</p>
            </div>
          )}

          {/* Copy all */}
          <div className="border-t border-border/50 px-4 py-2.5">
            <button
              onClick={() => copy(
                cl.cuts.map((c) => `[${c.label}] "${c.quote}"${c.speaker ? ` — ${c.speaker}` : ""}\n${c.note}`).join("\n\n"),
                "all"
              )}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {copiedKey === "all" ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              Copy all cuts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
