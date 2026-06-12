"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronUp, Clock, Copy, CheckCheck, FileAudio, FileText,
  FolderOpen, Loader2, Pencil, Search, Trash2, User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import {
  getAllUserTranscripts,
  appendTranscriptCutList,
  deleteProjectTranscript,
  updateProjectTranscriptText,
  type ProjectTranscriptWithProject,
  type CutListSave,
} from "@/lib/supabase/queries";

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

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SavedCutListCard({ cl }: { cl: CutListSave }) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedCuts, setExpandedCuts] = useState<Record<number, boolean>>({});

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

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
            {cl.cuts?.length} cuts · est. {cl.total_duration}
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
              return (
                <div key={i} className={cn("rounded-xl border border-border border-l-2 bg-white/[0.02] overflow-hidden", borderColor)}>
                  <button
                    onClick={() => setExpandedCuts((e) => ({ ...e, [i]: !isExpanded }))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide", badgeColor)}>
                      {cut.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{cut.timecode_hint}</span>
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

interface TranscriptHistoryProps {
  onLoadTranscript?: (t: ProjectTranscriptWithProject) => void;
}

export function TranscriptHistory({ onLoadTranscript }: TranscriptHistoryProps = {}) {
  const [transcripts, setTranscripts] = useState<ProjectTranscriptWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Per-transcript inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    getAllUserTranscripts()
      .then(setTranscripts)
      .catch(() => toast.error("Failed to load transcript history"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteProjectTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transcript deleted");
    } catch { toast.error("Failed to delete"); }
    finally { setDeleting(null); }
  }

  async function handleSaveCutList(transcriptId: string, cutList: CutListSave) {
    await appendTranscriptCutList(transcriptId, cutList);
    setTranscripts((prev) => prev.map((t) =>
      t.id === transcriptId ? { ...t, cut_lists: [cutList, ...(t.cut_lists ?? [])] } : t
    ));
  }

  function startEdit(t: ProjectTranscriptWithProject) {
    setEditingId(t.id);
    setEditText(t.transcript);
  }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    try {
      await updateProjectTranscriptText(id, editText);
      setTranscripts((prev) => prev.map((t) => t.id === id ? { ...t, transcript: editText } : t));
      setEditingId(null);
      toast.success("Transcript updated");
    } catch { toast.error("Failed to save changes"); }
    finally { setSavingEdit(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
    </div>
  );

  if (transcripts.length === 0) return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <FileAudio className="mx-auto mb-2 h-6 w-6 text-muted-foreground/25" />
      <p className="text-sm text-muted-foreground/50">No saved transcripts yet</p>
      <p className="mt-0.5 text-xs text-muted-foreground/30">Save a transcript to a project and it will appear here</p>
    </div>
  );

  const filtered = search.trim()
    ? transcripts.filter((t) => t.filename.toLowerCase().includes(search.toLowerCase()) || (t.project_title ?? "").toLowerCase().includes(search.toLowerCase()))
    : transcripts;

  const PERSONAL_KEY = "__personal__";

  // Group by project (null project_id → personal)
  const grouped = filtered.reduce<Record<string, { title: string | null; items: ProjectTranscriptWithProject[] }>>((acc, t) => {
    const key = t.project_id ?? PERSONAL_KEY;
    if (!acc[key]) acc[key] = { title: t.project_title, items: [] };
    acc[key].items.push(t);
    return acc;
  }, {});

  // Personal group always first
  const sortedEntries = Object.entries(grouped).sort(([a], [b]) => {
    if (a === PERSONAL_KEY) return -1;
    if (b === PERSONAL_KEY) return 1;
    return 0;
  });

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by filename or project…"
          className="w-full rounded-xl border border-border bg-white/[0.02] py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-[#d4a853]/40 focus:outline-none transition-colors"
        />
      </div>

      {filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground/50">No transcripts match &ldquo;{search}&rdquo;</p>
      )}

      {sortedEntries.map(([groupKey, group]) => {
        const isPersonal = groupKey === PERSONAL_KEY;
        return (
        <div key={groupKey}>
          {/* Group header */}
          <div className="mb-2 flex items-center gap-2">
            {isPersonal
              ? <User className="h-3.5 w-3.5 text-muted-foreground/60" />
              : <FolderOpen className="h-3.5 w-3.5 text-[#d4a853]" />
            }
            <p className={cn("text-xs font-semibold", isPersonal ? "text-muted-foreground/80" : "text-[#d4a853]")}>
              {isPersonal ? "Personal" : group.title}
            </p>
            <span className="text-[10px] text-muted-foreground/40">{group.items.length} transcript{group.items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2">
            {group.items.map((t) => {
              const isOpen = expanded[t.id] ?? false;
              const wordCount = t.transcript.trim().split(/\s+/).length;
              const isEditingThis = editingId === t.id;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-white/[0.02] overflow-hidden">
                  {/* Row — click to load (sidebar mode) or expand (drawer mode) */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => onLoadTranscript ? onLoadTranscript(t) : setExpanded((e) => ({ ...e, [t.id]: !isOpen }))}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white/[0.03]">
                      <FileAudio className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{t.filename}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {t.duration_secs != null && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />{formatDuration(t.duration_secs)}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <FileText className="h-2.5 w-2.5" />{wordCount.toLocaleString()} words
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(t.created_at)}</span>
                        {t.cut_lists?.length > 0 && (
                          <span className="rounded-full bg-[#d4a853]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#d4a853]">
                            {t.cut_lists.length} cut list{t.cut_lists.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        disabled={deleting === t.id}
                        className="rounded-lg p-1.5 text-muted-foreground/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                      {onLoadTranscript ? (
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground/30" />
                      ) : (
                        <div className="rounded-lg p-1.5 text-muted-foreground/50 pointer-events-none">
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded — only in drawer mode */}
                  {isOpen && !onLoadTranscript && (
                    <div className={cn("border-t border-border/60 p-4 space-y-5")}>
                      {/* Transcript text */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-white/[0.06] transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(t.id)}
                                disabled={savingEdit}
                                className="flex items-center gap-1 rounded-lg bg-[#d4a853] px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-[#d4a853]/90 disabled:opacity-60 transition-colors"
                              >
                                {savingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Save
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(t)}
                              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3 w-3" /> Edit
                            </button>
                          )}
                        </div>
                        {isEditingThis ? (
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full resize-none rounded-xl border border-[#d4a853]/30 bg-white/[0.03] p-4 text-sm leading-7 text-foreground focus:border-[#d4a853]/60 focus:outline-none transition-colors"
                            rows={Math.max(8, editText.split("\n").length)}
                          />
                        ) : (
                          <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-border bg-white/[0.02] p-4">
                            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{t.transcript}</p>
                          </div>
                        )}
                      </div>

                      {/* Saved cut lists — fully expandable */}
                      {t.cut_lists?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Saved Cut Lists <span className="normal-case font-normal text-muted-foreground/50">— click to expand</span>
                          </p>
                          <div className="space-y-1.5">
                            {t.cut_lists.map((cl, i) => (
                              <SavedCutListCard key={i} cl={cl} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI panel — saves cut lists to this transcript */}
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
        </div>
        );
      })}
    </div>
  );
}
