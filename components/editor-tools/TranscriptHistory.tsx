"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, FileAudio, FileText, FolderOpen, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AIContentPanel } from "@/components/editor-tools/AIContentPanel";
import {
  getAllUserTranscripts,
  appendTranscriptCutList,
  deleteProjectTranscript,
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

export function TranscriptHistory() {
  const [transcripts, setTranscripts] = useState<ProjectTranscriptWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

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

  // Group by project
  const grouped = transcripts.reduce<Record<string, { title: string; items: ProjectTranscriptWithProject[] }>>((acc, t) => {
    if (!acc[t.project_id]) acc[t.project_id] = { title: t.project_title, items: [] };
    acc[t.project_id].items.push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([projectId, group]) => (
        <div key={projectId}>
          {/* Project header */}
          <div className="mb-2 flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 text-[#d4a853]" />
            <p className="text-xs font-semibold text-[#d4a853]">{group.title}</p>
            <span className="text-[10px] text-muted-foreground/40">{group.items.length} transcript{group.items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-2">
            {group.items.map((t) => {
              const isOpen = expanded[t.id] ?? false;
              const wordCount = t.transcript.trim().split(/\s+/).length;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-white/[0.02] overflow-hidden">
                  {/* Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
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
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting === t.id}
                        className="rounded-lg p-1.5 text-muted-foreground/30 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => setExpanded((e) => ({ ...e, [t.id]: !isOpen }))}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] transition-colors"
                      >
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded */}
                  {isOpen && (
                    <div className={cn("border-t border-border/60 p-4 space-y-5")}>
                      {/* Transcript text */}
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
                        <div className="max-h-52 overflow-y-auto custom-scrollbar rounded-xl border border-border bg-white/[0.02] p-4">
                          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{t.transcript}</p>
                        </div>
                      </div>

                      {/* Saved cut lists */}
                      {t.cut_lists?.length > 0 && (
                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saved Cut Lists</p>
                          <div className="space-y-1.5">
                            {t.cut_lists.map((cl, i) => (
                              <div key={i} className="rounded-xl border border-border bg-white/[0.02] px-4 py-2.5">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-foreground">{cl.format}</p>
                                  <p className="text-[10px] text-muted-foreground">{new Date(cl.saved_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                                </div>
                                {cl.brief && <p className="mt-0.5 text-[11px] text-muted-foreground/50 italic">"{cl.brief}"</p>}
                                <p className="mt-0.5 text-[10px] text-muted-foreground">{cl.cuts?.length} cuts · est. {cl.total_duration}</p>
                              </div>
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
      ))}
    </div>
  );
}
