"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, ClipboardList, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { getWrapNotes, upsertWrapNote, deleteWrapNote } from "@/lib/supabase/queries";
import type { WrapNote } from "@/types";
import { toast } from "sonner";

interface WrapNotesTabProps {
  projectId: string;
  canEdit: boolean;
}

export function WrapNotesTab({ projectId, canEdit }: WrapNotesTabProps) {
  const [notes, setNotes] = useState<WrapNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDay, setNewDay] = useState("");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { content: string; issues: string; outstanding: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const autoSaveRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    getWrapNotes(projectId).then((data) => {
      setNotes(data);
      if (data.length > 0) setExpandedDay(data[0].production_day);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  function startEditing(note: WrapNote) {
    setEditing((prev) => ({
      ...prev,
      [note.production_day]: { content: note.content, issues: note.issues || "", outstanding: note.outstanding || "" },
    }));
  }

  async function handleAddDay() {
    const day = newDay.trim();
    if (!day) { toast.error("Enter a production day label"); return; }
    if (notes.some((n) => n.production_day === day)) { toast.error("Day already exists"); return; }
    try {
      const created = await upsertWrapNote({ project_id: projectId, production_day: day, content: "", issues: "", outstanding: "" });
      setNotes((prev) => [created, ...prev]);
      setExpandedDay(day);
      startEditing(created);
      setShowAdd(false); setNewDay("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add day");
    }
  }

  function handleChange(day: string, field: "content" | "issues" | "outstanding", val: string) {
    setEditing((prev) => ({ ...prev, [day]: { ...prev[day], [field]: val } }));
    // Autosave after 1.5s
    if (autoSaveRefs.current[day]) clearTimeout(autoSaveRefs.current[day]);
    autoSaveRefs.current[day] = setTimeout(() => saveDay(day), 1500);
  }

  async function saveDay(day: string) {
    const ed = editing[day];
    if (!ed) return;
    setSaving(day);
    try {
      const saved = await upsertWrapNote({ project_id: projectId, production_day: day, content: ed.content, issues: ed.issues, outstanding: ed.outstanding });
      setNotes((prev) => prev.map((n) => n.production_day === day ? { ...n, ...saved } : n));
    } catch { toast.error("Failed to save wrap notes"); }
    finally { setSaving(null); }
  }

  async function handleDelete(day: string) {
    const note = notes.find((n) => n.production_day === day);
    if (!note) return;
    try {
      await deleteWrapNote(note.id);
      setNotes((prev) => prev.filter((n) => n.production_day !== day));
      if (expandedDay === day) setExpandedDay(notes.find((n) => n.production_day !== day)?.production_day ?? null);
      toast.success("Day removed");
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 sm:px-5 py-3">
        <p className="text-sm font-semibold text-foreground">{notes.length} production day{notes.length !== 1 ? "s" : ""}</p>
        {canEdit && (
          <button
            onClick={() => { setShowAdd(true); setNewDay(`Day ${notes.length + 1}`); }}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add day
          </button>
        )}
      </div>

      {showAdd && (
        <div className="shrink-0 border-b border-border bg-muted/10 px-4 sm:px-5 py-3 flex items-center gap-3">
          <input
            value={newDay}
            onChange={(e) => setNewDay(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddDay()}
            placeholder="e.g. Day 1  or  April 15, 2026"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none"
          />
          <button onClick={handleAddDay} className="rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors">Add</button>
          <button onClick={() => setShowAdd(false)} className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        </div>
      )}

      <div className="px-4 sm:px-5 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="font-display font-semibold">No wrap notes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Track each production day: notes, issues, and outstanding items</p>
          </div>
        ) : (
          notes.map((note) => {
            const isOpen = expandedDay === note.production_day;
            const ed = editing[note.production_day];
            const displayContent = ed ?? note;

            return (
              <div key={note.production_day} className="overflow-hidden rounded-xl border border-border bg-card/50">
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-card transition-colors"
                  onClick={() => { setExpandedDay(isOpen ? null : note.production_day); if (!ed) startEditing(note); }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-muted-foreground">
                    {note.production_day.replace(/[^0-9]/g, "").slice(0, 2) || "D"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground">{note.production_day}</p>
                    {note.content && <p className="truncate text-xs text-muted-foreground">{note.content}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {saving === note.production_day && <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</label>
                      <textarea
                        value={displayContent.content}
                        onChange={(e) => handleChange(note.production_day, "content", e.target.value)}
                        readOnly={!canEdit}
                        placeholder="General wrap notes for the day…"
                        rows={4}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Issues</label>
                      <textarea
                        value={displayContent.issues}
                        onChange={(e) => handleChange(note.production_day, "issues", e.target.value)}
                        readOnly={!canEdit}
                        placeholder="Problems encountered…"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Outstanding</label>
                      <textarea
                        value={displayContent.outstanding}
                        onChange={(e) => handleChange(note.production_day, "outstanding", e.target.value)}
                        readOnly={!canEdit}
                        placeholder="Items still to be resolved…"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/20"
                      />
                    </div>
                    {canEdit && (
                      <div className="flex items-center justify-between pt-1">
                        <button onClick={() => handleDelete(note.production_day)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remove day</button>
                        <button
                          onClick={() => saveDay(note.production_day)}
                          disabled={saving === note.production_day}
                          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors disabled:opacity-60"
                        >
                          {saving === note.production_day ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Check className="h-3 w-3" />}
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
