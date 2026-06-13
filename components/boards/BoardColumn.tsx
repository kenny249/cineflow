"use client";

import { useState, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import type { BoardColumn as BoardColumnType, BoardCard, CardType } from "@/lib/boards";
import { createCard, updateColumnTitle, deleteColumn } from "@/lib/boards";
import { BoardCardComponent } from "./BoardCard";

const CARD_TYPE_OPTIONS: { type: CardType; label: string }[] = [
  { type: "note",      label: "Note" },
  { type: "script",    label: "Script" },
  { type: "shot",      label: "Shot" },
  { type: "checklist", label: "Checklist" },
  { type: "link",      label: "Link" },
  { type: "image",     label: "Image" },
  { type: "video",     label: "Video" },
];

const DEFAULT_CONTENT: Record<CardType, Record<string, unknown>> = {
  note:      { title: "", text: "" },
  script:    { title: "", content: "" },
  shot:      { scene_type: "INT", location: "", time: "DAY", camera_angle: "", notes: "" },
  image:     { url: "", caption: "" },
  video:     { url: "", title: "", notes: "" },
  checklist: { title: "", items: [] },
  link:      { url: "", title: "", description: "" },
};

interface BoardColumnProps {
  column: BoardColumnType;
  boardId: string;
  projectId?: string;
  readonly?: boolean;
  onColumnUpdate: (column: BoardColumnType) => void;
  onColumnDelete: (columnId: string) => void;
  onCardEdit: (card: BoardCard) => void;
  onCardAI: (card: BoardCard) => void;
  onCardPush: (card: BoardCard) => void;
  onCardDelete: (cardId: string, columnId: string) => void;
  onCardAdded: (card: BoardCard, columnId: string) => void;
}

export function BoardColumnComponent({
  column,
  boardId,
  projectId,
  readonly,
  onColumnUpdate,
  onColumnDelete,
  onCardEdit,
  onCardAI,
  onCardPush,
  onCardDelete,
  onCardAdded,
}: BoardColumnProps) {
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const cardIds = column.cards.map((c) => c.id);

  async function addCard(type: CardType) {
    setAddMenuOpen(false);
    setAdding(true);
    try {
      const position = (column.cards.at(-1)?.position ?? 0) + 1;
      const card = await createCard(boardId, column.id, type, DEFAULT_CONTENT[type], position);
      onCardAdded(card, column.id);
      // immediately open edit modal
      onCardEdit(card);
    } catch {
      toast.error("Failed to add card");
    } finally {
      setAdding(false);
    }
  }

  async function saveTitle() {
    setEditingTitle(false);
    if (titleInput.trim() === column.title) return;
    try {
      await updateColumnTitle(column.id, titleInput.trim() || "Untitled");
      onColumnUpdate({ ...column, title: titleInput.trim() || "Untitled" });
    } catch {
      toast.error("Failed to rename column");
      setTitleInput(column.title);
    }
  }

  async function handleDeleteColumn() {
    setColMenuOpen(false);
    if (column.cards.length > 0 && !confirm(`Delete "${column.title}" and its ${column.cards.length} card(s)?`)) return;
    try {
      await deleteColumn(column.id);
      onColumnDelete(column.id);
    } catch {
      toast.error("Failed to delete column");
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col rounded-2xl border border-border bg-[#0e0e0e]/60 backdrop-blur-sm">
      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/50">
        {editingTitle ? (
          <input
            ref={titleRef}
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleInput(column.title); } }}
            className="flex-1 bg-transparent text-xs font-semibold text-foreground outline-none border-b border-[#d4a853]/50 pb-0.5"
            autoFocus
          />
        ) : (
          <button
            onClick={() => !readonly && setEditingTitle(true)}
            className="flex-1 text-left text-xs font-semibold text-foreground hover:text-[#d4a853] transition-colors"
          >
            {column.title}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/50 shrink-0">{column.cards.length}</span>
        {!readonly && (
          <div className="relative shrink-0">
            <button
              onClick={() => setColMenuOpen((o) => !o)}
              className="rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-all"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {colMenuOpen && (
              <div
                className="absolute right-0 top-6 z-50 min-w-[130px] rounded-xl border border-border bg-popover py-1 shadow-xl"
                onMouseLeave={() => setColMenuOpen(false)}
              >
                <button
                  onClick={() => { setColMenuOpen(false); setEditingTitle(true); setTimeout(() => titleRef.current?.focus(), 50); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={handleDeleteColumn}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete column
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards list */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[60px] space-y-2 overflow-y-auto px-2 py-2 custom-scrollbar transition-colors ${isOver ? "bg-[#d4a853]/5" : ""}`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <BoardCardComponent
              key={card.id}
              card={card}
              projectId={projectId}
              readonly={readonly}
              onEdit={onCardEdit}
              onAI={onCardAI}
              onPush={onCardPush}
              onDelete={(cardId) => onCardDelete(cardId, column.id)}
            />
          ))}
        </SortableContext>
        {column.cards.length === 0 && !isOver && (
          <div className="flex h-16 items-center justify-center">
            <p className="text-[10px] text-muted-foreground/30">Drop cards here</p>
          </div>
        )}
      </div>

      {/* Add card button */}
      {!readonly && (
        <div className="relative border-t border-border/50 p-2">
          <button
            onClick={() => setAddMenuOpen((o) => !o)}
            disabled={adding}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
          {addMenuOpen && (
            <div
              className="absolute bottom-10 left-2 right-2 z-50 rounded-xl border border-border bg-popover py-1 shadow-xl"
              onMouseLeave={() => setAddMenuOpen(false)}
            >
              {CARD_TYPE_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => addCard(type)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
