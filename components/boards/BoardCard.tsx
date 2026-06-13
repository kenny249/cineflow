"use client";

import { useState, useRef } from "react";
import {
  StickyNote, ScrollText, Camera, Image as ImageIcon, Video, CheckSquare, Link2,
  MapPin, User, MoreHorizontal, Trash2, Edit3, Sparkles, ArrowUpRight, Check,
  ExternalLink, Plus, X,
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
  location:  { label: "Location",  icon: <MapPin      className="h-3 w-3" /> },
  character: { label: "Character", icon: <User        className="h-3 w-3" /> },
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface BoardCardProps {
  card: BoardCardType;
  projectId?: string;
  readonly?: boolean;
  isDragging?: boolean;
  startInlineEdit?: boolean;
  onDragStart: (card: BoardCardType, startEvent: { clientX: number; clientY: number }) => void;
  onUpdate: (card: BoardCardType) => void;
  onOpenModal: (card: BoardCardType) => void;
  onAI: (card: BoardCardType) => void;
  onPush: (card: BoardCardType) => void;
  onDelete: (cardId: string) => void;
}

export function str(v: unknown): string { return (v as string) ?? ""; }

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

  const colorCfg = CARD_COLORS.find((c) => c.value === (card.color ?? null)) ?? CARD_COLORS[0];

  // ── Drag detection ──────────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent) {
    if (readonly || inlineEditing) return;
    e.stopPropagation();

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
    if (card.type === "link") return; // link card — click on the anchor itself
    if (card.type === "checklist") return; // checklist is already interactive
    setInlineEditing(true);
  }

  // ── Blur/focus management for inline editors ────────────────────────────────

  function handleFieldBlur() {
    clearTimeout(blurTimeout.current);
    blurTimeout.current = setTimeout(() => setInlineEditing(false), 150);
  }

  function handleFieldFocus() {
    clearTimeout(blurTimeout.current);
  }

  // ── Save helpers ────────────────────────────────────────────────────────────

  async function saveContent(newContent: Record<string, unknown>) {
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
  const hasAI = card.type === "note" || card.type === "script" || card.type === "shot";

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
                  onClick={() => { setMenuOpen(false); setInlineEditing(true); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                {hasAI && (
                  <button
                    onClick={() => { setMenuOpen(false); onAI(card); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    <Sparkles className="h-3 w-3 text-[#d4a853]" /> AI Enhance
                  </button>
                )}
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
        {inlineEditing && !readonly ? (
          <InlineEditor
            card={card}
            onBlur={handleFieldBlur}
            onFocus={handleFieldFocus}
            onSave={saveContent}
            onClose={() => setInlineEditing(false)}
          />
        ) : (
          <CardBody card={card} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

// ── Inline editor (handles all card types) ────────────────────────────────────

function InlineEditor({
  card,
  onBlur,
  onFocus,
  onSave,
  onClose,
}: {
  card: BoardCardType;
  onBlur: () => void;
  onFocus: () => void;
  onSave: (content: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>({ ...card.content });

  function f(key: string): string { return (form[key] as string) ?? ""; }
  function set(key: string, val: unknown) { setForm((p) => ({ ...p, [key]: val })); }

  function save() {
    onSave(form);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  }

  const sharedProps = { onBlur, onFocus, onKeyDown: handleKeyDown };

  function Actions() {
    return (
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/40 mt-2">
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
    );
  }

  if (card.type === "note") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("title")}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Title…"
        autoFocus
        {...sharedProps}
        className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
      />
      <textarea
        value={f("text")}
        onChange={(e) => set("text", e.target.value)}
        placeholder="Write your note…"
        rows={5}
        {...sharedProps}
        onBlur={(e) => { save(); sharedProps.onBlur(); void e; }}
        className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "script") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("title")}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Scene title…"
        autoFocus
        {...sharedProps}
        className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
      />
      <textarea
        value={f("content")}
        onChange={(e) => set("content", e.target.value)}
        placeholder="Script content…"
        rows={6}
        {...sharedProps}
        className="w-full resize-none bg-transparent font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "shot") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <div className="flex gap-1.5">
        <select
          value={f("scene_type")}
          onChange={(e) => set("scene_type", e.target.value)}
          autoFocus
          {...sharedProps}
          className="flex-1 rounded-md border border-border bg-background/50 px-2 py-1 text-[10px] text-foreground outline-none focus:border-[#d4a853]/50"
        >
          <option value="">Scene…</option>
          {["INT", "EXT", "INT/EXT", "EXT/INT"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select
          value={f("time")}
          onChange={(e) => set("time", e.target.value)}
          {...sharedProps}
          className="flex-1 rounded-md border border-border bg-background/50 px-2 py-1 text-[10px] text-foreground outline-none focus:border-[#d4a853]/50"
        >
          <option value="">Time…</option>
          {["DAY", "NIGHT", "DAWN", "DUSK", "MAGIC HOUR", "CONTINUOUS"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <input
        value={f("location")}
        onChange={(e) => set("location", e.target.value)}
        placeholder="Location…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <input
        value={f("camera_angle")}
        onChange={(e) => set("camera_angle", e.target.value)}
        placeholder="Camera angle…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <textarea
        value={f("notes")}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Shot notes…"
        rows={3}
        {...sharedProps}
        className="w-full resize-none rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50 leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "location") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("name")}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Location name…"
        autoFocus
        {...sharedProps}
        className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
      />
      <input
        value={f("address")}
        onChange={(e) => set("address", e.target.value)}
        placeholder="Address or description…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <select
        value={f("time_of_day")}
        onChange={(e) => set("time_of_day", e.target.value)}
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground outline-none focus:border-[#d4a853]/50"
      >
        <option value="">Time of day…</option>
        {["DAY", "NIGHT", "DAWN", "DUSK", "MAGIC HOUR"].map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
      <input
        value={f("requirements")}
        onChange={(e) => set("requirements", e.target.value)}
        placeholder="Requirements (permits, power…)"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <textarea
        value={f("notes")}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Notes…"
        rows={2}
        {...sharedProps}
        className="w-full resize-none rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50 leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "character") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("character_name")}
        onChange={(e) => set("character_name", e.target.value)}
        placeholder="Character name…"
        autoFocus
        {...sharedProps}
        className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
      />
      <input
        value={f("actor")}
        onChange={(e) => set("actor", e.target.value)}
        placeholder="Actor / talent…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <input
        value={f("appears_in")}
        onChange={(e) => set("appears_in", e.target.value)}
        placeholder="Appears in (scenes, episodes…)"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <textarea
        value={f("notes")}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="Character notes, arc, wardrobe…"
        rows={3}
        {...sharedProps}
        className="w-full resize-none rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50 leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "image") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("url")}
        onChange={(e) => set("url", e.target.value)}
        placeholder="Image URL…"
        autoFocus
        type="url"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <input
        value={f("caption")}
        onChange={(e) => set("caption", e.target.value)}
        placeholder="Caption…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <Actions />
    </div>
  );

  if (card.type === "video") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("url")}
        onChange={(e) => set("url", e.target.value)}
        placeholder="Video URL…"
        autoFocus
        type="url"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <input
        value={f("title")}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Title…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <Actions />
    </div>
  );

  if (card.type === "link") return (
    <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
      <input
        value={f("url")}
        onChange={(e) => set("url", e.target.value)}
        placeholder="https://…"
        autoFocus
        type="url"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <input
        value={f("title")}
        onChange={(e) => set("title", e.target.value)}
        placeholder="Link title…"
        {...sharedProps}
        className="w-full rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50"
      />
      <textarea
        value={f("description")}
        onChange={(e) => set("description", e.target.value)}
        placeholder="Description…"
        rows={2}
        {...sharedProps}
        className="w-full resize-none rounded-md border border-border bg-background/50 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[#d4a853]/50 leading-relaxed"
      />
      <Actions />
    </div>
  );

  if (card.type === "checklist") {
    const items = (form.items as { text: string; done: boolean }[]) ?? [];
    function addItem() { set("items", [...items, { text: "", done: false }]); }
    function removeItem(i: number) { set("items", items.filter((_, idx) => idx !== i)); }
    function updateItemText(i: number, text: string) {
      const next = [...items];
      next[i] = { ...next[i], text };
      set("items", next);
    }
    return (
      <div onPointerDown={(e) => e.stopPropagation()} className="space-y-1.5">
        <input
          value={f("title")}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Checklist title…"
          autoFocus
          {...sharedProps}
          className="w-full bg-transparent text-xs font-semibold text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/50 pb-1"
        />
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={item.text}
                onChange={(e) => updateItemText(i, e.target.value)}
                placeholder={`Item ${i + 1}…`}
                {...sharedProps}
                className="flex-1 rounded border border-border bg-background/50 px-2 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#d4a853]/50"
              />
              <button onClick={() => removeItem(i)} className="text-muted-foreground/30 hover:text-red-400 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
        <Actions />
      </div>
    );
  }

  return null;
}

// ── Card body (read-only display) ──────────────────────────────────────────────

function CardBody({ card, onUpdate }: { card: BoardCardType; onUpdate: (c: BoardCardType) => void }) {
  const c = card.content;

  if (card.type === "note") {
    const title = str(c.title);
    const text = str(c.text);
    return (
      <div className="space-y-0.5">
        {title && <p className="text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap min-h-[1.5rem]">
          {text || <span className="text-muted-foreground/30 italic">Click to edit…</span>}
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
          <p className="text-xs text-muted-foreground/30 italic">Click to edit…</p>
        )}
      </div>
    );
  }

  if (card.type === "location") {
    const name = str(c.name);
    const address = str(c.address);
    const timeOfDay = str(c.time_of_day);
    const requirements = str(c.requirements);
    const notes = str(c.notes);
    return (
      <div className="space-y-1">
        {name ? (
          <p className="text-xs font-semibold text-foreground line-clamp-1">{name}</p>
        ) : (
          <p className="text-xs text-muted-foreground/30 italic">Click to edit…</p>
        )}
        {address && (
          <div className="flex items-start gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground line-clamp-2">{address}</p>
          </div>
        )}
        {timeOfDay && (
          <span className="inline-block rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400">
            {timeOfDay}
          </span>
        )}
        {requirements && (
          <p className="text-[10px] text-muted-foreground/60 line-clamp-2">Needs: {requirements}</p>
        )}
        {notes && <p className="text-[11px] text-muted-foreground/70 line-clamp-2">{notes}</p>}
      </div>
    );
  }

  if (card.type === "character") {
    const name = str(c.character_name);
    const actor = str(c.actor);
    const appearsIn = str(c.appears_in);
    const notes = str(c.notes);
    return (
      <div className="space-y-1">
        {name ? (
          <p className="text-xs font-semibold text-foreground line-clamp-1">{name}</p>
        ) : (
          <p className="text-xs text-muted-foreground/30 italic">Click to edit…</p>
        )}
        {actor && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <p className="text-[11px] text-muted-foreground">{actor}</p>
          </div>
        )}
        {appearsIn && (
          <p className="text-[10px] text-muted-foreground/60 line-clamp-1">Scenes: {appearsIn}</p>
        )}
        {notes && <p className="text-[11px] text-muted-foreground/70 line-clamp-3">{notes}</p>}
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
        {!url && !caption && <p className="text-xs text-muted-foreground/30 italic">Click to add image URL…</p>}
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
        {!url && <p className="text-xs text-muted-foreground/30 italic">Click to add video URL…</p>}
      </div>
    );
  }

  if (card.type === "checklist") {
    const title = str(c.title);
    const items = (c.items as { text: string; done: boolean }[]) ?? [];
    const doneCount = items.filter((i) => i.done).length;
    return <ChecklistBody card={card} title={title} items={items} doneCount={doneCount} onUpdate={onUpdate} />;
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
  onUpdate,
}: {
  card: BoardCardType;
  title: string;
  items: { text: string; done: boolean }[];
  doneCount: number;
  onUpdate: (c: BoardCardType) => void;
}) {
  const [localItems, setLocalItems] = useState(items);

  async function toggle(index: number) {
    const next = localItems.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setLocalItems(next);
    const newContent = { ...card.content, items: next };
    try {
      await updateCard(card.id, { content: newContent });
      onUpdate({ ...card, content: newContent });
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
          <button key={i} onClick={() => toggle(i)} className="flex w-full items-start gap-2 text-left">
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
