"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, CheckCheck, ChevronDown, ChevronUp, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CutListSave } from "@/lib/supabase/queries";

const FORMATS = [
  { key: "reel_30",      label: "30s Reel" },
  { key: "reel_60",      label: "60s Reel" },
  { key: "tiktok",       label: "TikTok" },
  { key: "podcast",      label: "Podcast" },
  { key: "youtube_short",label: "YT Short" },
] as const;

const VIBES = ["Fast Cuts", "Emotional", "Comedic", "Hype", "Cinematic"] as const;

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

type CutList = CutListSave;

interface Props {
  transcript: string;
  filename: string;
  onSaveCutList?: (cutList: CutList) => Promise<void>;
}

function useCopyText() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }
  return { copiedKey, copy };
}

export function AIContentPanel({ transcript, filename, onSaveCutList }: Props) {
  const [format, setFormat] = useState<string>("reel_30");
  const [vibes, setVibes] = useState<string[]>([]);
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const [cutList, setCutList] = useState<CutList | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedCuts, setExpandedCuts] = useState<Record<number, boolean>>({});
  const { copiedKey, copy } = useCopyText();

  function toggleVibe(v: string) {
    setVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  }

  async function generate() {
    setGenerating(true);
    setCutList(null);
    setSaved(false);
    try {
      const res = await fetch("/api/transcribe/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, format, brief, vibes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "AI generation failed");
        return;
      }
      const { cutList: cl } = await res.json();
      setCutList({ ...cl, brief, saved_at: new Date().toISOString() });
      // auto-scroll to results
      setTimeout(() => document.getElementById("cut-list-output")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch {
      toast.error("Generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveList() {
    if (!cutList || !onSaveCutList) return;
    setSaving(true);
    try {
      await onSaveCutList(cutList);
      setSaved(true);
      toast.success("Cut list saved to project");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#d4a853]/15 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d4a853]/15">
          <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">AI Content Intelligence</p>
          <p className="text-[11px] text-muted-foreground">Turn this transcript into an editorial cut list</p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Format */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</p>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
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

        {/* Vibe */}
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

        {/* Director's Brief */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Director&apos;s Brief</p>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder={`Describe your vision...\ne.g. "Start with birthday wishes, quick cuts that flow like one sentence, upbeat energy, end on a laugh"`}
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
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating cut list…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Generate Cut List</>
          )}
        </button>
      </div>

      {/* Output */}
      {cutList && (
        <div id="cut-list-output" className="border-t border-[#d4a853]/15">
          {/* Result header */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-bold text-foreground">{cutList.format}</p>
              <p className="text-xs text-muted-foreground">Est. {cutList.total_duration}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copy(
                  cutList.cuts.map((c) => `[${c.label}] "${c.quote}"${c.speaker ? ` — ${c.speaker}` : ""}\n${c.note}`).join("\n\n"),
                  "all"
                )}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
              >
                {copiedKey === "all" ? <CheckCheck className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                Copy All
              </button>
              {onSaveCutList && (
                <button
                  onClick={saveList}
                  disabled={saving || saved}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    saved
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border border-border text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  )}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {saved ? "Saved" : "Save to Project"}
                </button>
              )}
            </div>
          </div>

          {/* Cut list */}
          <div className="space-y-2 px-5 pb-5">
            {cutList.cuts.map((cut, i) => {
              const isExpanded = expandedCuts[i] ?? true;
              const borderColor = LABEL_LEFT_BORDER[cut.label] ?? "border-l-zinc-600";
              const badgeColor = LABEL_COLORS[cut.label] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/25";
              return (
                <div key={i} className={cn("rounded-xl border border-border border-l-2 bg-white/[0.02] overflow-hidden", borderColor)}>
                  <button
                    onClick={() => setExpandedCuts((e) => ({ ...e, [i]: !isExpanded }))}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide", badgeColor)}>
                      {cut.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{cut.timecode_hint}</span>
                    <span className="flex-1 truncate text-xs text-foreground/80">"{cut.quote}"</span>
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
          {cutList.caption_suggestions?.length > 0 && (
            <div className="border-t border-border/50 px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption Suggestions</p>
              <div className="space-y-2">
                {cutList.caption_suggestions.map((cap, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
                    <p className="flex-1 text-xs text-foreground/80 leading-relaxed">{cap}</p>
                    <button
                      onClick={() => copy(cap, `cap-${i}`)}
                      className="mt-0.5 shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      {copiedKey === `cap-${i}` ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hook options */}
          {cutList.hook_options?.length > 0 && (
            <div className="border-t border-border/50 px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hook Options</p>
              <ol className="space-y-2">
                {cutList.hook_options.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/80">
                    <span className="shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a853]/15 text-[10px] font-bold text-[#d4a853]">{i + 1}</span>
                    <span className="leading-relaxed">{h}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Editor notes */}
          {cutList.editor_notes && (
            <div className="border-t border-border/50 px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Notes</p>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">{cutList.editor_notes}</p>
            </div>
          )}

          {/* Regenerate */}
          <div className="border-t border-border/50 px-5 py-3">
            <button
              onClick={generate}
              disabled={generating}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              {generating ? "Regenerating…" : "↺ Regenerate with different cut"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
