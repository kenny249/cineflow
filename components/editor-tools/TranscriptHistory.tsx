"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronUp, Clock, FileAudio, FileText,
  FolderOpen, Loader2, Pencil, Search, Trash2, User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import { SavedCutListCard } from "@/components/editor-tools/SavedCutListCard";
import { SyncedTranscript } from "@/components/editor-tools/SyncedTranscript";
import {
  getAllUserTranscripts,
  appendTranscriptCutList,
  deleteProjectTranscript,
  updateProjectTranscriptText,
  type ProjectTranscriptWithProject,
  type CutListSave,
} from "@/lib/supabase/queries";

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  // Fetched lazily, only once a row is actually expanded — no point signing
  // a playback URL for every saved transcript up front.
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

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

  function toggleExpand(t: ProjectTranscriptWithProject) {
    setExpanded((e) => {
      const opening = !(e[t.id] ?? false);
      if (opening && t.audio_path && !audioUrls[t.id]) {
        fetch(`/api/transcribe/audio-url?id=${t.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.url) setAudioUrls((prev) => ({ ...prev, [t.id]: d.url })); })
          .catch(() => {});
      }
      return { ...e, [t.id]: opening };
    });
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
              const wordCount = t.transcript.trim() ? t.transcript.trim().split(/\s+/).length : 0;
              const isEditingThis = editingId === t.id;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-white/[0.02] overflow-hidden">
                  {/* Row — click to load (sidebar mode) or expand (drawer mode) */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                    onClick={() => onLoadTranscript ? onLoadTranscript(t) : toggleExpand(t)}
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
                          <div className="max-h-72 overflow-y-auto custom-scrollbar rounded-xl border border-border bg-white/[0.02] p-4">
                            <SyncedTranscript
                              text={t.transcript}
                              words={t.words ?? []}
                              audioUrl={audioUrls[t.id] ?? null}
                            />
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
                        liveAudio={t.words && t.words.length > 0 ? { file: null, words: t.words } : null}
                        duration={t.duration_secs}
                        savedTranscriptId={t.id}
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
