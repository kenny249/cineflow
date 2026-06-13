"use client";

import { useEffect, useState } from "react";
import { X, Download, Loader2, Camera, StickyNote, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createCard } from "@/lib/boards";
import type { BoardCard } from "@/lib/boards";

interface ImportPanelProps {
  boardId: string;
  projectId: string;
  onClose: () => void;
  onImported: (cards: BoardCard[]) => void;
}

type ShotItem = { id: string; label: string; selected: boolean };
type NoteItem = { id: string; title: string; body: string; selected: boolean };

export function ImportPanel({ boardId, projectId, onClose, onImported }: ImportPanelProps) {
  const [shotItems, setShotItems] = useState<ShotItem[]>([]);
  const [noteItems, setNoteItems] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: lists } = await supabase
        .from("shot_lists")
        .select("id")
        .eq("project_id", projectId)
        .limit(5);

      const shotListIds = (lists ?? []).map((l: { id: string }) => l.id);
      let shots: ShotItem[] = [];
      if (shotListIds.length > 0) {
        const { data: items } = await supabase
          .from("shot_list_items")
          .select("id, label")
          .in("shot_list_id", shotListIds)
          .order("sort_order")
          .limit(50);
        shots = (items ?? []).map((i: { id: string; label: string }) => ({ id: i.id, label: i.label, selected: false }));
      }

      const { data: notes } = await supabase
        .from("project_notes")
        .select("id, title, body")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      const noteList: NoteItem[] = (notes ?? []).map((n: { id: string; title: string; body: string }) => ({
        id: n.id,
        title: n.title || "Untitled Note",
        body: n.body || "",
        selected: false,
      }));

      setShotItems(shots);
      setNoteItems(noteList);
      setLoading(false);
    }
    load();
  }, [projectId]);

  function toggleShot(id: string) {
    setShotItems((prev) => prev.map((s) => s.id === id ? { ...s, selected: !s.selected } : s));
  }

  function toggleNote(id: string) {
    setNoteItems((prev) => prev.map((n) => n.id === id ? { ...n, selected: !n.selected } : n));
  }

  const selectedShots = shotItems.filter((s) => s.selected);
  const selectedNotes = noteItems.filter((n) => n.selected);
  const totalSelected = selectedShots.length + selectedNotes.length;

  async function handleImport() {
    if (totalSelected === 0) return;
    setImporting(true);

    let x = 80;
    let y = 80;
    const COLS = 4;
    const CARD_W = 260;
    const CARD_H = 180;
    let col = 0;
    let row = 0;

    function nextPos() {
      const pos = { x: x + col * CARD_W, y: y + row * CARD_H };
      col++;
      if (col >= COLS) { col = 0; row++; }
      return pos;
    }

    try {
      const created: BoardCard[] = [];

      for (const shot of selectedShots) {
        const pos = nextPos();
        const card = await createCard(boardId, "shot", {
          notes: shot.label,
        }, pos.x, pos.y);
        created.push(card);
      }

      for (const note of selectedNotes) {
        const pos = nextPos();
        const card = await createCard(boardId, "note", {
          title: note.title,
          text: note.body,
        }, pos.x, pos.y);
        created.push(card);
      }

      onImported(created);
      toast.success(`Imported ${created.length} card${created.length !== 1 ? "s" : ""}`);
      onClose();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="absolute right-2 bottom-14 z-40 w-80 rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-[#d4a853]" />
          <span className="text-sm font-semibold text-foreground">Import from Project</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : (
          <>
            {shotItems.length > 0 && (
              <div className="p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                  <Camera className="h-3 w-3" /> Shot List ({shotItems.length})
                </p>
                <div className="space-y-1">
                  {shotItems.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleShot(s.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent transition-colors"
                    >
                      <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                        s.selected ? "border-[#d4a853] bg-[#d4a853]" : "border-muted-foreground/30"
                      }`}>
                        {s.selected && <Check className="h-2.5 w-2.5 text-black" />}
                      </span>
                      <span className="text-xs text-foreground line-clamp-2 leading-relaxed">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {noteItems.length > 0 && (
              <div className="p-3 border-t border-border">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2 flex items-center gap-1.5">
                  <StickyNote className="h-3 w-3" /> Notes ({noteItems.length})
                </p>
                <div className="space-y-1">
                  {noteItems.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => toggleNote(n.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent transition-colors"
                    >
                      <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                        n.selected ? "border-[#d4a853] bg-[#d4a853]" : "border-muted-foreground/30"
                      }`}>
                        {n.selected && <Check className="h-2.5 w-2.5 text-black" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground line-clamp-1">{n.title}</p>
                        {n.body && <p className="text-[10px] text-muted-foreground/60 line-clamp-1">{n.body}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {shotItems.length === 0 && noteItems.length === 0 && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground/50">No items found in this project.</p>
                <p className="text-xs text-muted-foreground/30 mt-1">Add shot list items or notes first.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground/50">
          {totalSelected > 0 ? `${totalSelected} selected` : "Select items to import"}
        </span>
        <button
          onClick={handleImport}
          disabled={totalSelected === 0 || importing}
          className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Import to Board
        </button>
      </div>
    </div>
  );
}
