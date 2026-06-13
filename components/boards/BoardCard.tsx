"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  StickyNote, ScrollText, Camera, Image as ImageIcon, Video, CheckSquare, Link2,
  MoreHorizontal, Trash2, Edit3, Sparkles, ArrowUpRight, GripVertical,
  Check, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { BoardCard as BoardCardType, CardType } from "@/lib/boards";
import { deleteCard } from "@/lib/boards";

export const CARD_COLORS = [
  { label: "Default", value: null, bg: "bg-card", border: "border-border" },
  { label: "Gold",    value: "gold",   bg: "bg-[#d4a853]/10", border: "border-[#d4a853]/40" },
  { label: "Blue",    value: "blue",   bg: "bg-blue-500/10",  border: "border-blue-500/40"  },
  { label: "Green",   value: "green",  bg: "bg-emerald-500/10", border: "border-emerald-500/40" },
  { label: "Purple",  value: "purple", bg: "bg-purple-500/10", border: "border-purple-500/40" },
  { label: "Red",     value: "red",    bg: "bg-red-500/10",   border: "border-red-500/40"   },
];

export const CARD_TYPE_ICONS: Record<CardType, React.ReactNode> = {
  note:      <StickyNote  className="h-3 w-3" />,
  script:    <ScrollText  className="h-3 w-3" />,
  shot:      <Camera      className="h-3 w-3" />,
  image:     <ImageIcon   className="h-3 w-3" />,
  video:     <Video       className="h-3 w-3" />,
  checklist: <CheckSquare className="h-3 w-3" />,
  link:      <Link2       className="h-3 w-3" />,
};

const CARD_TYPE_LABELS: Record<CardType, string> = {
  note:      "Note",
  script:    "Script",
  shot:      "Shot",
  image:     "Image",
  video:     "Video",
  checklist: "Checklist",
  link:      "Link",
};

interface BoardCardProps {
  card: BoardCardType;
  projectId?: string;
  readonly?: boolean;
  onEdit: (card: BoardCardType) => void;
  onAI: (card: BoardCardType) => void;
  onPush: (card: BoardCardType) => void;
  onDelete: (cardId: string) => void;
}

export function BoardCardComponent({
  card,
  projectId,
  readonly,
  onEdit,
  onAI,
  onPush,
  onDelete,
}: BoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkItems, setCheckItems] = useState<boolean[]>(
    () => (card.content.items as { text: string; done: boolean }[] | undefined)?.map((i) => i.done) ?? []
  );

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: readonly,
    data: { type: "card", card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const colorCfg = CARD_COLORS.find((c) => c.value === (card.color ?? null)) ?? CARD_COLORS[0];

  async function handleDelete() {
    setMenuOpen(false);
    try {
      await deleteCard(card.id);
      onDelete(card.id);
    } catch {
      toast.error("Failed to delete card");
    }
  }

  async function toggleCheckItem(index: number) {
    const next = [...checkItems];
    next[index] = !next[index];
    setCheckItems(next);
    // Optimistically update — parent will sync on next load
  }

  const canPush = projectId && (card.type === "shot" || card.type === "script");

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border ${colorCfg.bg} ${colorCfg.border} p-3 shadow-sm transition-shadow hover:shadow-md cursor-default select-none`}
    >
      {/* Drag handle */}
      {!readonly && (
        <button
          {...attributes}
          {...listeners}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity touch-none"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}

      {/* Card type badge */}
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
          {CARD_TYPE_ICONS[card.type]}
          {CARD_TYPE_LABELS[card.type]}
        </span>
        {!readonly && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-50 min-w-[140px] rounded-xl border border-border bg-popover py-1 shadow-xl"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button onClick={() => { setMenuOpen(false); onEdit(card); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                  <Edit3 className="h-3 w-3" /> Edit
                </button>
                <button onClick={() => { setMenuOpen(false); onAI(card); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                  <Sparkles className="h-3 w-3 text-[#d4a853]" /> AI Enhance
                </button>
                {canPush && (
                  <button onClick={() => { setMenuOpen(false); onPush(card); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors">
                    <ArrowUpRight className="h-3 w-3 text-emerald-400" /> Push to {card.type === "shot" ? "Shot List" : "Notes"}
                  </button>
                )}
                <div className="my-1 border-t border-border" />
                <button onClick={handleDelete} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card content */}
      <CardContent card={card} checkItems={checkItems} onToggleCheck={toggleCheckItem} onEdit={onEdit} />
    </div>
  );
}

function str(v: unknown): string { return (v as string) ?? ""; }

function CardContent({
  card,
  checkItems,
  onToggleCheck,
  onEdit,
}: {
  card: BoardCardType;
  checkItems: boolean[];
  onToggleCheck: (i: number) => void;
  onEdit: (card: BoardCardType) => void;
}) {
  const c = card.content;

  if (card.type === "note") {
    const title = str(c.title);
    const text = str(c.text);
    return (
      <div onClick={() => onEdit(card)} className="cursor-pointer">
        {title && <p className="mb-1 text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-5 whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  if (card.type === "script") {
    const title = str(c.title);
    const content = str(c.content);
    return (
      <div onClick={() => onEdit(card)} className="cursor-pointer">
        {title && <p className="mb-1 text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        <p className="font-mono text-[11px] text-muted-foreground leading-relaxed line-clamp-6 whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  if (card.type === "shot") {
    const sceneType = str(c.scene_type);
    const location = str(c.location);
    const cameraAngle = str(c.camera_angle);
    const notes = str(c.notes);
    return (
      <div onClick={() => onEdit(card)} className="cursor-pointer space-y-1">
        {sceneType && (
          <span className="inline-block rounded bg-[#d4a853]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#d4a853]">
            {sceneType}
          </span>
        )}
        {location && <p className="text-xs font-medium text-foreground">{location}</p>}
        {cameraAngle && <p className="text-[11px] text-muted-foreground">{cameraAngle}</p>}
        {notes && <p className="text-[11px] text-muted-foreground/70 line-clamp-2">{notes}</p>}
      </div>
    );
  }

  if (card.type === "image") {
    const url = str(c.url);
    const caption = str(c.caption);
    return (
      <div onClick={() => onEdit(card)} className="cursor-pointer">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={caption || "Image"} className="mb-1.5 w-full rounded-lg object-cover max-h-40" />
        ) : (
          <div className="mb-1.5 flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
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
      <div onClick={() => onEdit(card)} className="cursor-pointer">
        {url ? (
          <video src={url} className="mb-1.5 w-full rounded-lg max-h-32 object-cover" controls={false} />
        ) : (
          <div className="mb-1.5 flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
            <Video className="h-6 w-6 text-muted-foreground/30" />
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
    const done = checkItems.filter(Boolean).length;
    return (
      <div>
        {title && <p className="mb-2 text-xs font-semibold text-foreground">{title}</p>}
        <div className="space-y-1">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => onToggleCheck(i)}
              className="flex w-full items-start gap-2 text-left"
            >
              <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${checkItems[i] ? "border-[#d4a853] bg-[#d4a853]" : "border-muted-foreground/40"}`}>
                {checkItems[i] && <Check className="h-2.5 w-2.5 text-black" />}
              </span>
              <span className={`text-xs leading-relaxed ${checkItems[i] ? "line-through text-muted-foreground/40" : "text-foreground"}`}>
                {item.text}
              </span>
            </button>
          ))}
        </div>
        {items.length > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground/50">{done}/{items.length} done</p>
        )}
      </div>
    );
  }

  if (card.type === "link") {
    const title = str(c.title);
    const url = str(c.url);
    const description = str(c.description);
    return (
      <div className="space-y-1">
        {title && <p className="text-xs font-semibold text-foreground line-clamp-1">{title}</p>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:underline truncate"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {url}
          </a>
        )}
        {description && <p className="text-[11px] text-muted-foreground line-clamp-3">{description}</p>}
      </div>
    );
  }

  return null;
}
