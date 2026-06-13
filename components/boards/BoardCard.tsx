"use client";

import { useState, useRef } from "react";
import {
  StickyNote, ScrollText, Camera, Image as ImageIcon, Video, CheckSquare, Link2,
  MoreHorizontal, Trash2, Edit3, Sparkles, ArrowUpRight, Check, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { BoardCard as BoardCardType, CardType } from "@/lib/boards";
import { deleteCard, updateCard } from "@/lib/boards";

// ── Constants ──────────────────────────────────────────────────────────────────

export const CARD_COLORS = [
  { value: null,     bg: "bg-[#141414]",       border: "border-border",          dot: "bg-zinc-600"    },
  { value: "gold",   bg: "bg-[#d4a853]/10",    border: "border-[#d4a853]/40",    dot: "bg-[#d4a853]"   },
  { value: "blue",   bg: "bg-blue-500/10",     border: "border-blue-500/40",     dot: "bg-blue-500"    },
  { value: "green",  bg: "bg-emerald-500/10",  border: "border-emerald-500/40",  dot: "bg-emerald-500" },
  { value: "purple", bg: "bg-purple-500/10",   border: "border-purple-500/40",   dot: "bg-purple-500"  },
  { value: "red",    bg: "bg-red-500/10",      border: "border-red-500/40",      dot: "bg-red-500"     },
];

export const CARD_TYPE_META: Record<CardType, { label: string; icon: React.ReactNode }> = {
  note:      { label: "Note",      icon: <StickyNote  className="h-3 w-3" /> },
  script:    { label: "Script",    icon: <ScrollText  className="h-3 w-3" /> },
  shot:      { label: "Shot",      icon: <Camera      className="h-3 w-3" /> },
  image:     { label: "Image",     icon: <ImageIcon   className="h-3 w-3" /> },
  video:     { label: "Video",     icon: <Video       className="h-3 w-3" /> },
  checklist: { label: "Checklist", icon: <CheckSquare className="h-3 w-3" /> },
  link:      { label: "Link",      icon: <Link2       className="h-3 w-3" /> },
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BoardCardProps {
  card: BoardCardType;
  projectId?: string;
  readonly?: boolean;
  isDragging?: boolean;
  startInlineEdit?: boolean; // true when card was just created
  onDragStart: (card: BoardCardType, startEvent: { clientX: number; clientY: number }) => void;
  onUpdate: (card: BoardCardType) => void;
  onOpenModal: (card: BoardCardType) => void;
  onAI: (card: BoardCardType) => void;
  onPush: (card: BoardCardType) => void;
  onDelete: (cardId: string) => void;
}

function str(v: unknown): string { return (v as string) ?? ""; }

// ── Card component ─────────────────────────────────────────────────────────────

export function BoardCardComponent({
  card,
  projectId,
  readonly,
  isDragging,
  startInlineEdit,
  onDragStart,
  onUpdate,
  onOpenModal,
  onAI,
  onPush,
  onDelete,
}: BoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(startInlineEdit ?? false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canInlineEdit = card.type === "note" || card.type === "script";

  const colorCfg = CARD_COLORS.find((c) => c.value === (card.color ?? null)) ?? CARD_COLORS[0];

  // ── Drag detection ──────────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent) {
    if (readonly || inlineEditing) return;
    e.stopPropagation(); // prevent canvas pan

    const startX = e.clientX;
    const startY = e.clientY;
    let dragged = false;

    function onMove(ev: PointerEvent) {
      if (!dragged && (Math.abs(ev.clientX - startX) > 5 || Math.abs(ev.clientY - startY) > 5)) {
        dragged = true;
        cleanup();
        onDragStart(card, { clientX: startX, clientY: startY });
      }
    }

    function onUp() {
      cleanup();
      if (!dragged) handleCardClick();
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleCardClick() {
    if (canInlineEdit) {
      setInlineEditing(true);
    } else {
      onOpenModal(card);
    }
  }

  // ── Inline edit ─────────────────────────────────────────────────────────────

  function handleFieldBlur() {
    clearTimeout(blurTimeout.current);
    blurTimeout.current = setTimeout(() => {
      setInlineEditing(false);
    }, 150);
  }

  function handleFieldFocus() {
    clearTimeout(blurTimeout.current);
  }

  async function saveInlineNote(title: string, text: string) {
    const newContent = { ...card.content, title, text };
    try {
      await updateCard(card.id, { content: newContent });
      onUpdate({ ...card, content: newContent });
    } catch {
      toast.error("Failed to save");
    }
  }

  async function saveInlineScript(title: string, content: string) {
    const newContent = { ...card.content, title, content };
    try {
      await updateCard(card.id, { content: newContent });
      onUpdate({ ...card, content: newContent });
    } catch {
      toast.error("Failed to save");
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete() {
    setMenuOpen(false);
    try {
      await deleteCard(card.id);
      onDelete(card.id);
    } catch {
      toast.error("Failed to delete card");
    }
  }

  const canPush = projectId && (card.type === "shot" || card.type === "script");

  return (
    <div
      data-card-id={card.id}
      onPointerDown={handlePointerDown}
      className={`group relative w-60 rounded-2xl border shadow-md transition-shadow select-none
        ${colorCfg.bg} ${colorCfg.border}
        ${isDragging ? "shadow-2xl opacity-60 rotate-1" : "hover:shadow-lg"}
        ${inlineEditing ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
      `}
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1.5">
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
          {CARD_TYPE_META[card.type].icon}
          {CARD_TYPE_META[card.type].label}
        </span>

        {!readonly && (
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-muted-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-50 min-w-[150px] rounded-xl border border-border bg-popover py-1 shadow-xl"
                onMouseLeave={() => setMenuOpen(false)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setMenuOpen(false); onOpenModal(card); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onAI(card); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Sparkles className="h-3 w-3 text-[#d4a853]" /> AI Enhance
                </button>
                {canPush && (
                  <button
                    onClick={() => { setMenuOpen(false); onPush(card); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" />
                    Push to {card.type === "shot" ? "Shot List" : "Notes"}
                  </button>
                )}
                <div className="my-1 border-t border-border" />
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-3 pb-3">
        {inlineEditing && canInlineEdit ? (
          <InlineEditor
            card={card}
            onBlur={handleFieldBlur}
            onFocus={handleFieldFocus}
            onSaveNote={saveInlineNote}
            onSaveScript={saveInlineScript}
            onClose={() => setInlineEditing(false)}
          />
        ) : (
          <CardBody card={card} />
        )}
      </div>
    </div>
  );
}

// ── Inline editor ──────────────────────────────────────────────────────────────

function InlineEditor({
  card,
  onBlur,
  onFocus,
  onSaveNote,
  onSaveScript,
  onClose,
}: {
  card: BoardCardType;
  onBlur: () => void;
  onFocus: () => void;
  onSaveNote: (title: string, text: string) => void;
  onSaveScript: (title: string, content: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(str(card.content.title));
  const [body, setBody] = useState(str(card.type === "script" ? card.content.content : card.content.text));

  function save() {
    if (card.type === "note") onSaveNote(title, body);
    if (card.type === "script") onSaveScript(title, body);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        placeholder="Title…"
        className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={(e) => { save(); onBlur(); }}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        placeholder={card.type === "script" ? "Script content…" : "Write your note…"}
        rows={5}
        autoFocus
        className={`w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none leading-relaxed ${card.type === "script" ? "font-mono" : ""}`}
      />
      <div className="flex items-center justify-end gap-1.5 pt-1">
        <button onClick={onClose} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground px-1.5">
          Cancel
        </button>
        <button
          onClick={save}
          className="flex items-center gap-0.5 rounded-lg bg-[#d4a853] px-2.5 py-0.5 text-[10px] font-semibold text-black hover:bg-[#c49843] transition-colors"
        >
          <Check className="h-2.5 w-2.5" /> Save
        </button>
      </div>
    </div>
  );
}

// ── Card body (read-only display) ──────────────────────────────────────────────

function CardBody({ card }: { card: BoardCardType }) {
  const c = card.content;

  if (card.type === "note") {
    const title = str(c.title);
    const text = str(c.text);
    return (
      <div className="space-y-0.5">
        {title && <p className="text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap min-h-[1.5rem]">
          {text || <span className="text-muted-foreground/30 italic">Empty note — click to edit</span>}
        </p>
      </div>
    );
  }

  if (card.type === "script") {
    const title = str(c.title);
    const content = str(c.content);
    return (
      <div className="space-y-0.5">
        {title && <p className="text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed line-clamp-7 whitespace-pre-wrap min-h-[1.5rem]">
          {content || <span className="text-muted-foreground/30 italic">Click to write…</span>}
        </p>
      </div>
    );
  }

  if (card.type === "shot") {
    const sceneType = str(c.scene_type);
    const location = str(c.location);
    const time = str(c.time);
    const cameraAngle = str(c.camera_angle);
    const notes = str(c.notes);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {sceneType && (
            <span className="rounded bg-[#d4a853]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#d4a853]">
              {sceneType}
            </span>
          )}
          {time && (
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-muted-foreground/60 uppercase">
              {time}
            </span>
          )}
        </div>
        {location && <p className="text-xs font-medium text-foreground">{location}</p>}
        {cameraAngle && <p className="text-[11px] text-muted-foreground">{cameraAngle}</p>}
        {notes && <p className="text-[11px] text-muted-foreground/70 line-clamp-3">{notes}</p>}
        {!sceneType && !location && !notes && (
          <p className="text-xs text-muted-foreground/30 italic">Click ··· to edit</p>
        )}
      </div>
    );
  }

  if (card.type === "image") {
    const url = str(c.url);
    const caption = str(c.caption);
    return (
      <div>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={caption || "Image"} className="mb-1.5 w-full rounded-lg object-cover max-h-40" />
        ) : (
          <div className="mb-1.5 flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
            <ImageIcon className="h-6 w-6 text-muted-foreground/20" />
          </div>
        )}
        {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
      </div>
    );
  }

  if (card.type === "video") {
    const url = str(c.url);
    const title = str(c.title);
    const notes = str(c.notes);
    return (
      <div>
        {url ? (
          <video src={url} className="mb-1.5 w-full rounded-lg max-h-32 object-cover bg-black" />
        ) : (
          <div className="mb-1.5 flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
            <Video className="h-6 w-6 text-muted-foreground/20" />
          </div>
        )}
        {title && <p className="text-xs font-medium text-foreground">{title}</p>}
        {notes && <p className="text-[11px] text-muted-foreground/70 line-clamp-2">{notes}</p>}
      </div>
    );
  }

  if (card.type === "checklist") {
    const title = str(c.title);
    const items = (c.items as { text: string; done: boolean }[]) ?? [];
    const doneCount = items.filter((i) => i.done).length;
    return (
      <ChecklistBody card={card} title={title} items={items} doneCount={doneCount} />
    );
  }

  if (card.type === "link") {
    const title = str(c.title);
    const url = str(c.url);
    const description = str(c.description);
    return (
      <div className="space-y-1" onPointerDown={(e) => e.stopPropagation()}>
        {title && <p className="text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:underline truncate"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {url}
          </a>
        )}
        {description && <p className="text-[11px] text-muted-foreground line-clamp-3">{description}</p>}
        {!title && !url && <p className="text-xs text-muted-foreground/30 italic">Click ··· to edit</p>}
      </div>
    );
  }

  return null;
}

// ── Checklist body (interactive) ───────────────────────────────────────────────

function ChecklistBody({
  card,
  title,
  items,
  doneCount,
}: {
  card: BoardCardType;
  title: string;
  items: { text: string; done: boolean }[];
  doneCount: number;
}) {
  const [localItems, setLocalItems] = useState(items);

  async function toggle(index: number) {
    const next = localItems.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setLocalItems(next);
    try {
      await updateCard(card.id, { content: { ...card.content, items: next } });
    } catch {
      toast.error("Failed to update");
      setLocalItems(items);
    }
  }

  return (
    <div onPointerDown={(e) => e.stopPropagation()}>
      {title && <p className="mb-2 text-xs font-semibold text-foreground">{title}</p>}
      <div className="space-y-1.5">
        {localItems.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="flex w-full items-start gap-2 text-left"
          >
            <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
              localItems[i].done ? "border-[#d4a853] bg-[#d4a853]" : "border-muted-foreground/40"
            }`}>
              {localItems[i].done && <Check className="h-2.5 w-2.5 text-black" />}
            </span>
            <span className={`text-xs leading-relaxed ${localItems[i].done ? "line-through text-muted-foreground/40" : "text-foreground"}`}>
              {item.text}
            </span>
          </button>
        ))}
      </div>
      {localItems.length > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground/40">{doneCount}/{localItems.length} done</p>
      )}
      {localItems.length === 0 && (
        <p className="text-xs text-muted-foreground/30 italic">Click ··· to add items</p>
      )}
    </div>
  );
}
