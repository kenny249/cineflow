"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  Plus, Share2, Copy, Check, Loader2, Settings2, Printer, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import type { Board, BoardColumn, BoardCard, CardType } from "@/lib/boards";
import {
  createColumn,
  updateColumnPositions,
  updateCardPositions,
  generateShareToken,
  revokeShareToken,
  pushShotToShotList,
  pushScriptToNotes,
} from "@/lib/boards";
import { BoardColumnComponent } from "./BoardColumn";
import { BoardCardComponent } from "./BoardCard";
import { CardEditModal } from "./CardEditModal";

interface BoardViewProps {
  board: Board & { columns: BoardColumn[] };
  projectId?: string;
  readonly?: boolean;
}

export function BoardView({ board: initialBoard, projectId, readonly }: BoardViewProps) {
  const [board, setBoard] = useState(initialBoard);
  const [editingCard, setEditingCard] = useState<BoardCard | null>(null);
  const [aiCard, setAiCard] = useState<BoardCard | null>(null);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function findCard(cardId: string): { card: BoardCard; column: BoardColumn } | null {
    for (const col of board.columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) return { card, column: col };
    }
    return null;
  }

  function updateColumns(fn: (cols: BoardColumn[]) => BoardColumn[]) {
    setBoard((b) => ({ ...b, columns: fn(b.columns) }));
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "card") setActiveCard(data.card);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeData = active.data.current;
    if (activeData?.type !== "card") return;

    const activeCardId = active.id as string;
    const overData = over.data.current;

    // Find source column
    const srcResult = findCard(activeCardId);
    if (!srcResult) return;
    const { column: srcCol } = srcResult;

    let destColId: string;
    if (overData?.type === "column") {
      destColId = overData.columnId as string;
    } else if (overData?.type === "card") {
      const destResult = findCard(over.id as string);
      if (!destResult) return;
      destColId = destResult.column.id;
    } else {
      return;
    }

    if (srcCol.id === destColId) return;

    // Move card between columns optimistically
    updateColumns((cols) => {
      const src = cols.find((c) => c.id === srcCol.id)!;
      const dest = cols.find((c) => c.id === destColId)!;
      const movingCard = src.cards.find((c) => c.id === activeCardId)!;
      return cols.map((col) => {
        if (col.id === srcCol.id) return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) };
        if (col.id === destColId) return { ...col, cards: [...col.cards, { ...movingCard, column_id: destColId }] };
        return col;
      });
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    if (activeData?.type !== "card") return;

    const activeCardId = active.id as string;
    const overData = over.data.current;

    // Determine destination column and index
    let destColId: string;
    let overCardId: string | null = null;

    if (overData?.type === "column") {
      destColId = overData.columnId as string;
    } else if (overData?.type === "card") {
      const destResult = findCard(over.id as string);
      if (!destResult) return;
      destColId = destResult.column.id;
      overCardId = over.id as string;
    } else {
      return;
    }

    const destCol = board.columns.find((c) => c.id === destColId);
    if (!destCol) return;

    let finalCards = [...destCol.cards];
    const activeIdx = finalCards.findIndex((c) => c.id === activeCardId);

    if (overCardId && overCardId !== activeCardId) {
      const overIdx = finalCards.findIndex((c) => c.id === overCardId);
      if (activeIdx !== -1 && overIdx !== -1) {
        finalCards = arrayMove(finalCards, activeIdx, overIdx);
      }
    }

    // Assign new positions
    const updates = finalCards.map((c, i) => ({ id: c.id, column_id: destColId, position: i }));
    updateColumns((cols) =>
      cols.map((col) =>
        col.id === destColId
          ? { ...col, cards: finalCards.map((c, i) => ({ ...c, position: i, column_id: destColId })) }
          : col
      )
    );

    try {
      await updateCardPositions(updates);
    } catch {
      toast.error("Failed to save card position");
    }
  }

  // ── Column management ─────────────────────────────────────────────────────────

  async function addColumn() {
    setAddingColumn(true);
    try {
      const position = (board.columns.at(-1)?.position ?? 0) + 1;
      const col = await createColumn(board.id, "Untitled", position);
      updateColumns((cols) => [...cols, col]);
    } catch {
      toast.error("Failed to add column");
    } finally {
      setAddingColumn(false);
    }
  }

  function handleColumnUpdate(updated: BoardColumn) {
    updateColumns((cols) => cols.map((c) => (c.id === updated.id ? { ...c, title: updated.title } : c)));
  }

  function handleColumnDelete(columnId: string) {
    updateColumns((cols) => cols.filter((c) => c.id !== columnId));
  }

  // ── Card management ───────────────────────────────────────────────────────────

  function handleCardAdded(card: BoardCard, columnId: string) {
    updateColumns((cols) =>
      cols.map((col) =>
        col.id === columnId ? { ...col, cards: [...col.cards, card] } : col
      )
    );
  }

  function handleCardDelete(cardId: string, columnId: string) {
    updateColumns((cols) =>
      cols.map((col) =>
        col.id === columnId ? { ...col, cards: col.cards.filter((c) => c.id !== cardId) } : col
      )
    );
  }

  function handleCardSaved(updated: BoardCard) {
    updateColumns((cols) =>
      cols.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      }))
    );
  }

  // ── Push to production tools ──────────────────────────────────────────────────

  async function handlePush(card: BoardCard) {
    if (!projectId) return;
    try {
      if (card.type === "shot") {
        await pushShotToShotList(projectId, card.content);
        toast.success("Shot pushed to Shot List");
      } else if (card.type === "script") {
        await pushScriptToNotes(projectId, card.content);
        toast.success("Script pushed to Project Notes");
      }
    } catch {
      toast.error("Failed to push card");
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────────

  const shareUrl = board.share_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/board/${board.share_token}`
    : null;

  async function handleGenerateShare() {
    setShareLoading(true);
    try {
      const token = await generateShareToken(board.id);
      setBoard((b) => ({ ...b, share_token: token }));
    } catch {
      toast.error("Failed to generate share link");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRevokeShare() {
    setShareLoading(true);
    try {
      await revokeShareToken(board.id);
      setBoard((b) => ({ ...b, share_token: null }));
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Print ─────────────────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      {!readonly && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {board.columns.length} column{board.columns.length !== 1 ? "s" : ""} ·{" "}
            {board.columns.reduce((n, col) => n + col.cards.length, 0)} card{board.columns.reduce((n, col) => n + col.cards.length, 0) !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShareOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Printer className="h-3 w-3" /> Print
            </button>
          </div>
        </div>
      )}

      {/* Share panel */}
      {shareOpen && (
        <div className="border-b border-border bg-card/50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-foreground">Share link</p>
            <button onClick={() => setShareOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {shareUrl ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground font-mono truncate"
              />
              <button
                onClick={copyShareUrl}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-accent transition-colors shrink-0"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleRevokeShare}
                disabled={shareLoading}
                className="flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="h-3 w-3" /> Revoke
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateShare}
              disabled={shareLoading}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
            >
              {shareLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
              Generate share link
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">Anyone with this link can view (read-only).</p>
        </div>
      )}

      {/* Board canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full items-start gap-4 p-4">
            {board.columns.map((col) => (
              <BoardColumnComponent
                key={col.id}
                column={col}
                boardId={board.id}
                projectId={projectId}
                readonly={readonly}
                onColumnUpdate={handleColumnUpdate}
                onColumnDelete={handleColumnDelete}
                onCardEdit={setEditingCard}
                onCardAI={setAiCard}
                onCardPush={handlePush}
                onCardDelete={handleCardDelete}
                onCardAdded={handleCardAdded}
              />
            ))}

            {/* Add column button */}
            {!readonly && (
              <button
                onClick={addColumn}
                disabled={addingColumn}
                className="flex h-10 w-48 shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/50 text-xs text-muted-foreground/50 hover:border-[#d4a853]/40 hover:text-[#d4a853]/70 transition-colors"
              >
                {addingColumn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add column
              </button>
            )}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeCard && (
              <div className="opacity-90 rotate-1 shadow-2xl">
                <BoardCardComponent
                  card={activeCard}
                  projectId={projectId}
                  readonly
                  onEdit={() => {}}
                  onAI={() => {}}
                  onPush={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit Modal */}
      <CardEditModal
        card={editingCard}
        onClose={() => setEditingCard(null)}
        onSaved={handleCardSaved}
      />

      {/* AI Modal — reuses CardEditModal opened from AI context */}
      <CardEditModal
        card={aiCard}
        onClose={() => setAiCard(null)}
        onSaved={handleCardSaved}
      />
    </div>
  );
}
