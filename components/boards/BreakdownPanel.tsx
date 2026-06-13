"use client";

import { useState } from "react";
import { X, Sparkles, Loader2, Camera, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { createCard } from "@/lib/boards";
import type { BoardCard } from "@/lib/boards";

interface Shot {
  scene_type: string;
  location: string;
  time: string;
  camera_angle: string;
  notes: string;
}

interface BreakdownPanelProps {
  boardId: string;
  onClose: () => void;
  onAdded: (cards: BoardCard[]) => void;
}

export function BreakdownPanel({ boardId, onClose, onAdded }: BreakdownPanelProps) {
  const [scene, setScene] = useState("");
  const [loading, setLoading] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);

  async function handleBreakdown() {
    if (!scene.trim()) return;
    setLoading(true);
    setShots([]);
    setSelected(new Set());
    try {
      const res = await fetch("/api/ai/board-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "breakdown", scene }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const result: Shot[] = json.shots ?? [];
      setShots(result);
      setSelected(new Set(result.map((_, i) => i)));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "AI error");
    } finally {
      setLoading(false);
    }
  }

  function toggleShot(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    setAdding(true);
    const toAdd = shots.filter((_, i) => selected.has(i));
    const CARD_W = 260;
    const CARD_H = 180;
    const COLS = 4;
    let col = 0;
    let row = 0;

    function nextPos() {
      const pos = { x: 80 + col * CARD_W, y: 80 + row * CARD_H };
      col++;
      if (col >= COLS) { col = 0; row++; }
      return pos;
    }

    try {
      const created: BoardCard[] = [];
      for (const shot of toAdd) {
        const pos = nextPos();
        const card = await createCard(boardId, "shot", {
          scene_type: shot.scene_type,
          location: shot.location,
          time: shot.time,
          camera_angle: shot.camera_angle,
          notes: shot.notes,
        }, pos.x, pos.y);
        created.push(card);
      }
      onAdded(created);
      toast.success(`Added ${created.length} shot${created.length !== 1 ? "s" : ""} to board`);
      onClose();
    } catch {
      toast.error("Failed to add shots");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="absolute right-2 bottom-14 z-40 w-96 rounded-2xl border border-border bg-popover shadow-2xl overflow-hidden flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#d4a853]" />
          <span className="text-sm font-semibold text-foreground">AI Scene Breakdown</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scene input */}
      <div className="p-4 border-b border-border shrink-0">
        <p className="text-[11px] text-muted-foreground/60 mb-2">
          Paste a scene from your screenplay. AI will generate individual shot cards.
        </p>
        <textarea
          value={scene}
          onChange={(e) => setScene(e.target.value)}
          placeholder={`INT. COFFEE SHOP - DAY\n\nSARAH enters and scans the room...`}
          rows={6}
          className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#d4a853]/40 leading-relaxed"
        />
        <button
          onClick={handleBreakdown}
          disabled={!scene.trim() || loading}
          className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing scene…</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" /> Break Down Scene</>
          )}
        </button>
      </div>

      {/* Results */}
      {shots.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-3 pb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {shots.length} shots generated
            </p>
            <button
              onClick={() => {
                if (selected.size === shots.length) setSelected(new Set());
                else setSelected(new Set(shots.map((_, i) => i)));
              }}
              className="text-[10px] text-[#d4a853] hover:underline"
            >
              {selected.size === shots.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <div className="p-3 space-y-2">
            {shots.map((shot, i) => (
              <button
                key={i}
                onClick={() => toggleShot(i)}
                className={`w-full flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
                  selected.has(i)
                    ? "border-[#d4a853]/40 bg-[#d4a853]/5"
                    : "border-border bg-background/40 opacity-60"
                }`}
              >
                <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
                  selected.has(i) ? "border-[#d4a853] bg-[#d4a853]" : "border-muted-foreground/30"
                }`}>
                  {selected.has(i) && <Check className="h-2.5 w-2.5 text-black" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Camera className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                    {shot.scene_type && (
                      <span className="rounded bg-[#d4a853]/15 px-1 py-0.5 text-[9px] font-bold uppercase text-[#d4a853]">
                        {shot.scene_type}
                      </span>
                    )}
                    {shot.time && (
                      <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] text-muted-foreground/50 uppercase">
                        {shot.time}
                      </span>
                    )}
                    {shot.camera_angle && (
                      <span className="text-[9px] text-muted-foreground/50">{shot.camera_angle}</span>
                    )}
                  </div>
                  {shot.location && <p className="text-[11px] font-medium text-foreground line-clamp-1">{shot.location}</p>}
                  {shot.notes && <p className="text-[10px] text-muted-foreground/70 line-clamp-2 mt-0.5">{shot.notes}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {shots.length > 0 && (
        <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground/50">
            {selected.size > 0 ? `${selected.size} of ${shots.length} selected` : "Select shots to add"}
          </span>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0 || adding}
            className="flex items-center gap-1.5 rounded-xl bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Add to Board
          </button>
        </div>
      )}
    </div>
  );
}
