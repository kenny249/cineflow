"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  StickyNote, ScrollText, Camera, CheckSquare, Link2, Image as ImageIcon, Video,
  MapPin, User, Share2, Copy, Check, Loader2, Trash2, X, ZoomIn, ZoomOut,
  Maximize2, Printer, Download, Sparkles, Square, Eye, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { Board, BoardCard, CardType, BoardWithCards, SharePermission } from "@/lib/boards";
import {
  createCard, updateCard, updateCardPosition, deleteCard, generateShareToken, revokeShareToken,
  setSharePermission, pushShotToShotList, pushScriptToNotes,
} from "@/lib/boards";
import { createPublicBoardActions } from "@/lib/boards-public-client";
import { createClient } from "@/lib/supabase/client";
import { BoardCardComponent } from "./BoardCard";
import { CardEditModal } from "./CardEditModal";
import { ImportPanel } from "./ImportPanel";
import { BreakdownPanel } from "./BreakdownPanel";

// Broadcast-only realtime — deliberately not postgres_changes, which would
// require a public SELECT policy on board_cards (the exact hole closed
// earlier: a policy that grants read access to anyone with the anon key
// isn't safe just because the channel name itself is hard to guess).
// Broadcast doesn't touch table RLS at all; the actual data stays gated by
// the token-checked fetch/mutation routes, this only relays "something
// changed, go re-check" between everyone currently looking at this board.
type BoardBroadcastPayload =
  | { type: "created"; card: BoardCard }
  | { type: "updated"; card: BoardCard }
  | { type: "deleted"; cardId: string };

// ── Types ──────────────────────────────────────────────────────────────────────

type DragState =
  | { type: "card"; cardId: string; cardStartX: number; cardStartY: number; pointerStartX: number; pointerStartY: number; currentDx: number; currentDy: number }
  | { type: "pan"; panStartX: number; panStartY: number; pointerStartX: number; pointerStartY: number }
  | { type: "resize"; cardId: string; cardStartWidth: number; cardStartHeight: number; pointerStartX: number; pointerStartY: number; currentWidth: number; currentHeight: number };

const MIN_CARD_WIDTH = 180;
const MIN_NOTE_HEIGHT = 80;

// ── Default card content per type ─────────────────────────────────────────────

const DEFAULT_CONTENT: Record<CardType, Record<string, unknown>> = {
  note:      { title: "", text: "" },
  script:    { title: "", content: "" },
  shot:      { scene_type: "INT", location: "", time: "DAY", camera_angle: "", notes: "" },
  image:     { url: "", caption: "" },
  video:     { url: "", title: "", notes: "" },
  checklist: { title: "", items: [] },
  link:      { url: "", title: "", description: "" },
  location:  { name: "", address: "", time_of_day: "DAY", requirements: "", notes: "" },
  character: { character_name: "", actor: "", appears_in: "", notes: "" },
  frame:     { title: "" },
};

const TOOLBAR_TYPES: { type: CardType; icon: React.ReactNode; label: string }[] = [
  { type: "note",      icon: <StickyNote  className="h-4 w-4" />, label: "Note"      },
  { type: "frame",     icon: <Square      className="h-4 w-4" />, label: "Frame"     },
  { type: "script",    icon: <ScrollText  className="h-4 w-4" />, label: "Script"    },
  { type: "shot",      icon: <Camera      className="h-4 w-4" />, label: "Shot"      },
  { type: "location",  icon: <MapPin      className="h-4 w-4" />, label: "Location"  },
  { type: "character", icon: <User        className="h-4 w-4" />, label: "Character" },
  { type: "checklist", icon: <CheckSquare className="h-4 w-4" />, label: "Checklist" },
  { type: "link",      icon: <Link2       className="h-4 w-4" />, label: "Link"      },
  { type: "image",     icon: <ImageIcon   className="h-4 w-4" />, label: "Image"     },
  { type: "video",     icon: <Video       className="h-4 w-4" />, label: "Video"     },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface BoardViewProps {
  board: BoardWithCards;
  projectId?: string;
  readonly?: boolean;
  /** Present only on the public share page when the link is in "anyone can
   *  edit" mode — routes every mutation through the token-checked public
   *  API instead of the authenticated (RLS-based) path, since there's no
   *  logged-in user at all in that context. */
  shareToken?: string;
}

export function BoardView({ board: initialBoard, projectId, readonly, shareToken }: BoardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Set only when the card being dragged is a frame — every other card
  // that geometrically sits inside its bounds at drag-start, so the whole
  // group moves together. Membership is recomputed fresh on every drag,
  // never stored, so it always reflects what's visually inside the frame
  // right now rather than some stale snapshot.
  const frameGroupRef = useRef<{ id: string; startX: number; startY: number }[] | null>(null);

  const [cards, _setCards] = useState<BoardCard[]>(initialBoard.cards);
  const [pan, _setPan] = useState({ x: 60, y: 60 });
  const [zoom, _setZoom] = useState(1);
  const [board, setBoard] = useState(initialBoard);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [resizingCardId, setResizingCardId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<BoardCard | null>(null);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<SharePermission>("view");
  const [copied, setCopied] = useState(false);
  const [addingType, setAddingType] = useState<CardType | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const cardsRef = useRef<BoardCard[]>(initialBoard.cards);
  const panRef = useRef({ x: 60, y: 60 });
  const zoomRef = useRef(1);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Which persistence layer this view writes through — the normal
  // authenticated one, or (only on a public "anyone can edit" share link)
  // the token-checked public API. Nothing else about the canvas changes.
  const boardActions = useMemo(
    () => (shareToken ? createPublicBoardActions(shareToken) : { createCard, updateCard, updateCardPosition, deleteCard }),
    [shareToken]
  );

  const setCards = useCallback((fn: (c: BoardCard[]) => BoardCard[]) => {
    const next = fn(cardsRef.current);
    cardsRef.current = next;
    _setCards(next);
  }, []);

  // ── Live sync ─────────────────────────────────────────────────────────────────
  // Everyone currently looking at this board — the owner's dashboard, any
  // other tab, and anyone on an "anyone can edit" share link — joins the
  // same channel and relays every change. Without this, two people editing
  // at once would silently overwrite each other until one of them refreshed.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`board:${board.id}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "card_change" }, ({ payload }: { payload: BoardBroadcastPayload }) => {
        if (payload.type === "created") {
          setCards((prev) => (prev.some((c) => c.id === payload.card.id) ? prev : [...prev, payload.card]));
        } else if (payload.type === "updated") {
          setCards((prev) => prev.map((c) => (c.id === payload.card.id ? { ...c, ...payload.card } : c)));
        } else if (payload.type === "deleted") {
          setCards((prev) => prev.filter((c) => c.id !== payload.cardId));
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [board.id, setCards]);

  function broadcastChange(payload: BoardBroadcastPayload) {
    channelRef.current?.send({ type: "broadcast", event: "card_change", payload });
  }

  const setPan = useCallback((p: { x: number; y: number }) => {
    panRef.current = p;
    _setPan(p);
  }, []);

  const setZoom = useCallback((z: number) => {
    zoomRef.current = z;
    _setZoom(z);
  }, []);

  // ── Window pointer event listeners ───────────────────────────────────────────

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const dr = dragRef.current;
      if (!dr) return;

      if (dr.type === "card") {
        const dx = (e.clientX - dr.pointerStartX) / zoomRef.current;
        const dy = (e.clientY - dr.pointerStartY) / zoomRef.current;
        dr.currentDx = dx;
        dr.currentDy = dy;
        const el = document.querySelector(`[data-card-id="${dr.cardId}"]`) as HTMLElement | null;
        if (el) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.zIndex = "50";
        }
        // Dragging a frame carries everything currently inside it along —
        // move each grouped card's own DOM node by the same delta live,
        // exactly like the frame itself, before anything is persisted.
        if (frameGroupRef.current) {
          for (const g of frameGroupRef.current) {
            const gel = document.querySelector(`[data-card-id="${g.id}"]`) as HTMLElement | null;
            if (gel) gel.style.transform = `translate(${dx}px, ${dy}px)`;
          }
        }
      } else if (dr.type === "resize") {
        const dx = (e.clientX - dr.pointerStartX) / zoomRef.current;
        const dy = (e.clientY - dr.pointerStartY) / zoomRef.current;
        const newWidth = Math.max(MIN_CARD_WIDTH, dr.cardStartWidth + dx);
        const newHeight = Math.max(MIN_NOTE_HEIGHT, dr.cardStartHeight + dy);
        dr.currentWidth = newWidth;
        dr.currentHeight = newHeight;
        const el = document.querySelector(`[data-card-id="${dr.cardId}"]`) as HTMLElement | null;
        if (el) {
          el.style.width = `${newWidth}px`;
          const target = el.querySelector('[data-resize-target="height"]') as HTMLElement | null;
          if (target) target.style.height = `${newHeight}px`;
        }
      } else {
        const x = dr.panStartX + (e.clientX - dr.pointerStartX);
        const y = dr.panStartY + (e.clientY - dr.pointerStartY);
        panRef.current = { x, y };
        if (worldRef.current) {
          worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoomRef.current})`;
        }
      }
    }

    async function onUp() {
      const dr = dragRef.current;
      dragRef.current = null;
      if (!dr) return;

      if (dr.type === "card") {
        const el = document.querySelector(`[data-card-id="${dr.cardId}"]`) as HTMLElement | null;
        if (el) { el.style.transform = ""; el.style.zIndex = ""; }

        const dx = dr.currentDx;
        const dy = dr.currentDy;
        const moved = Math.abs(dx) > 3 || Math.abs(dy) > 3;
        if (moved) {
          const newX = dr.cardStartX + dx;
          const newY = dr.cardStartY + dy;
          setCards((prev) => prev.map((c) => c.id === dr.cardId ? { ...c, x: newX, y: newY } : c));
          boardActions.updateCardPosition(dr.cardId, newX, newY)
            .then(() => broadcastChange({ type: "updated", card: { ...cardsRef.current.find((c) => c.id === dr.cardId)!, x: newX, y: newY } }))
            .catch(() => toast.error("Failed to save position"));
        }

        if (frameGroupRef.current) {
          for (const g of frameGroupRef.current) {
            const gel = document.querySelector(`[data-card-id="${g.id}"]`) as HTMLElement | null;
            if (gel) gel.style.transform = "";
            if (moved) {
              const gNewX = g.startX + dx;
              const gNewY = g.startY + dy;
              setCards((prev) => prev.map((c) => c.id === g.id ? { ...c, x: gNewX, y: gNewY } : c));
              boardActions.updateCardPosition(g.id, gNewX, gNewY)
                .then(() => broadcastChange({ type: "updated", card: { ...cardsRef.current.find((c) => c.id === g.id)!, x: gNewX, y: gNewY } }))
                .catch(() => toast.error("Failed to save position"));
            }
          }
          frameGroupRef.current = null;
        }

        setDraggingCardId(null);
      } else if (dr.type === "resize") {
        const newWidth = Math.round(dr.currentWidth);
        const newHeight = Math.round(dr.currentHeight);
        setCards((prev) => prev.map((c) => c.id === dr.cardId ? { ...c, width: newWidth, height: newHeight } : c));
        boardActions.updateCard(dr.cardId, { width: newWidth, height: newHeight })
          .then(() => broadcastChange({ type: "updated", card: { ...cardsRef.current.find((c) => c.id === dr.cardId)!, width: newWidth, height: newHeight } }))
          .catch(() => toast.error("Failed to save size"));
        setResizingCardId(null);
      } else {
        setPan({ x: panRef.current.x, y: panRef.current.y });
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [setCards, setPan, boardActions]);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(0.2, Math.min(3, oldZoom * factor));

      const wx = (mx - panRef.current.x) / oldZoom;
      const wy = (my - panRef.current.y) / oldZoom;
      const newPan = { x: mx - wx * newZoom, y: my - wy * newZoom };

      zoomRef.current = newZoom;
      panRef.current = newPan;

      if (worldRef.current) {
        worldRef.current.style.transform = `translate(${newPan.x}px, ${newPan.y}px) scale(${newZoom})`;
      }

      setZoom(newZoom);
      setPan(newPan);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom, setPan]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function getViewCenter(): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect() ?? { width: 800, height: 600 };
    return {
      x: (rect.width / 2 - panRef.current.x) / zoomRef.current - 120,
      y: (rect.height / 2 - panRef.current.y) / zoomRef.current - 80,
    };
  }

  function screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: (sx - rect.left - panRef.current.x) / zoomRef.current,
      y: (sy - rect.top - panRef.current.y) / zoomRef.current,
    };
  }

  // ── Canvas pointer events ─────────────────────────────────────────────────────

  function handleCanvasPointerDown(e: React.PointerEvent) {
    // Panning is how you look around a board, not how you change it — it
    // stays available in read-only mode (wheel-zoom already did), unlike
    // adding/moving/editing cards, which stay fully blocked below.
    if (e.button !== 0) return;
    dragRef.current = {
      type: "pan",
      panStartX: panRef.current.x,
      panStartY: panRef.current.y,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
    };
  }

  function handleCanvasDoubleClick(e: React.PointerEvent) {
    if (readonly) return;
    const pos = screenToWorld(e.clientX, e.clientY);
    addCardAt("note", pos.x - 120, pos.y - 40);
  }

  // ── Card drag start ──────────────────────────────────────────────────────────

  function startCardDrag(card: BoardCard, startEvent: { clientX: number; clientY: number }) {
    dragRef.current = {
      type: "card",
      cardId: card.id,
      cardStartX: card.x,
      cardStartY: card.y,
      pointerStartX: startEvent.clientX,
      pointerStartY: startEvent.clientY,
      currentDx: 0,
      currentDy: 0,
    };

    if (card.type === "frame") {
      const fw = card.width ?? 320;
      const fh = card.height ?? 220;
      frameGroupRef.current = cardsRef.current
        .filter((c) =>
          c.id !== card.id && c.type !== "frame" &&
          c.x >= card.x && c.y >= card.y && c.x <= card.x + fw && c.y <= card.y + fh
        )
        .map((c) => ({ id: c.id, startX: c.x, startY: c.y }));
    } else {
      frameGroupRef.current = null;
    }

    setDraggingCardId(card.id);
  }

  // ── Card resize start ──────────────────────────────────────────────────────
  // Measures the card's actual current on-screen size rather than assuming a
  // constant, so a not-yet-resized card (no stored width/height) starts the
  // drag from wherever it really is instead of jumping to a guessed default.
  function startCardResize(card: BoardCard, startEvent: { clientX: number; clientY: number }) {
    const el = document.querySelector(`[data-card-id="${card.id}"]`) as HTMLElement | null;
    const rect = el?.getBoundingClientRect();
    const startWidth = card.width ?? (rect ? rect.width / zoomRef.current : 240);
    const startHeight = card.height ?? (rect ? rect.height / zoomRef.current : 132);
    dragRef.current = {
      type: "resize",
      cardId: card.id,
      cardStartWidth: startWidth,
      cardStartHeight: startHeight,
      pointerStartX: startEvent.clientX,
      pointerStartY: startEvent.clientY,
      currentWidth: startWidth,
      currentHeight: startHeight,
    };
    setResizingCardId(card.id);
  }

  // ── Add card ──────────────────────────────────────────────────────────────────

  async function addCardAt(type: CardType, x: number, y: number) {
    setAddingType(type);
    try {
      const card = await boardActions.createCard(board.id, type, DEFAULT_CONTENT[type], x, y);
      setCards((prev) => [...prev, card]);
      broadcastChange({ type: "created", card });
      // open inline edit for all types (checklist and link use modal-style inline editor)
      setNewCardId(card.id);
    } catch {
      toast.error("Failed to add card");
    } finally {
      setAddingType(null);
    }
  }

  function addCardAtCenter(type: CardType) {
    const center = getViewCenter();
    const offset = cards.length * 20;
    addCardAt(type, center.x + (offset % 100), center.y + (offset % 60));
  }

  // ── Card callbacks ────────────────────────────────────────────────────────────
  // Called after a card's own content/color/etc. has *already* been
  // persisted (by BoardCard's inline editor, the checklist toggle, or the AI
  // enhance modal) — this just reflects it into shared state and relays it
  // to everyone else watching this board.

  function handleCardUpdate(updated: BoardCard) {
    setCards((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
    setNewCardId(null);
    broadcastChange({ type: "updated", card: updated });
  }

  function handleCardDelete(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    broadcastChange({ type: "deleted", cardId });
  }

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

  function handlePanelCards(newCards: BoardCard[]) {
    setCards((prev) => [...prev, ...newCards]);
  }

  // ── Zoom controls ─────────────────────────────────────────────────────────────

  function adjustZoom(factor: number) {
    const newZoom = Math.max(0.2, Math.min(3, zoomRef.current * factor));
    const rect = containerRef.current?.getBoundingClientRect() ?? { width: 800, height: 600 };
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (cx - panRef.current.x) / zoomRef.current;
    const wy = (cy - panRef.current.y) / zoomRef.current;
    const newPan = { x: cx - wx * newZoom, y: cy - wy * newZoom };
    setZoom(newZoom);
    setPan(newPan);
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${newPan.x}px, ${newPan.y}px) scale(${newZoom})`;
    }
  }

  function fitToScreen() {
    if (cards.length === 0) { setZoom(1); setPan({ x: 60, y: 60 }); return; }
    const PADDING = 80;
    const minX = Math.min(...cards.map((c) => c.x));
    const minY = Math.min(...cards.map((c) => c.y));
    const maxX = Math.max(...cards.map((c) => c.x + 240));
    const maxY = Math.max(...cards.map((c) => c.y + 160));
    const rect = containerRef.current?.getBoundingClientRect() ?? { width: 800, height: 600 };
    const scaleX = (rect.width - PADDING * 2) / (maxX - minX);
    const scaleY = (rect.height - PADDING * 2) / (maxY - minY);
    const newZoom = Math.max(0.2, Math.min(1, Math.min(scaleX, scaleY)));
    const newPan = { x: PADDING - minX * newZoom, y: PADDING - minY * newZoom };
    setZoom(newZoom);
    setPan(newPan);
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${newPan.x}px, ${newPan.y}px) scale(${newZoom})`;
    }
  }

  // ── Share ─────────────────────────────────────────────────────────────────────

  const shareUrl = board.share_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/board/${board.share_token}`
    : null;

  async function handleGenerateShare(permission: SharePermission) {
    setShareLoading(true);
    try {
      const token = await generateShareToken(board.id, permission);
      setBoard((b) => ({ ...b, share_token: token, share_permission: permission }));
    } catch { toast.error("Failed to generate link"); }
    finally { setShareLoading(false); }
  }

  async function handleRevokeShare() {
    setShareLoading(true);
    try {
      await revokeShareToken(board.id);
      setBoard((b) => ({ ...b, share_token: null }));
    } catch { toast.error("Failed to revoke link"); }
    finally { setShareLoading(false); }
  }

  async function handleChangePermission(permission: SharePermission) {
    const prev = board.share_permission;
    setBoard((b) => ({ ...b, share_permission: permission })); // optimistic
    try {
      await setSharePermission(board.id, permission);
    } catch {
      setBoard((b) => ({ ...b, share_permission: prev }));
      toast.error("Failed to update permission");
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // Frames always render behind every other card, regardless of creation
  // order — otherwise a frame created after a note would sit on top and
  // cover it (frames have no z-index of their own; DOM order is what
  // stacks siblings, so this is the only thing that keeps that consistent).
  const orderedCards = useMemo(
    () => [...cards.filter((c) => c.type === "frame"), ...cards.filter((c) => c.type !== "frame")],
    [cards]
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Top right actions */}
      {!readonly && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {/* Share manages the link itself (permission, revoke) — owner
              only, even when this render is an anonymous editor on an
              "anyone can edit" link. Being allowed to edit cards is not
              the same as being allowed to control who else can. */}
          {!shareToken && (
            <button
              onClick={() => setShareOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      )}

      {/* Share panel */}
      {shareOpen && (
        <div className="absolute top-12 right-3 z-30 w-80 rounded-2xl border border-border bg-card shadow-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Share board</p>
            <button onClick={() => setShareOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {shareUrl ? (
            <div className="space-y-2">
              <input readOnly value={shareUrl} className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground font-mono truncate" />
              <div className="flex gap-2">
                <button onClick={copyShareUrl} className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-xs hover:bg-accent transition-colors">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <button onClick={handleRevokeShare} disabled={shareLoading} className="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors">
                  <Trash2 className="h-3 w-3" /> Revoke
                </button>
              </div>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  onClick={() => handleChangePermission("view")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    board.share_permission === "view" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-3 w-3" /> Can view
                </button>
                <button
                  onClick={() => handleChangePermission("edit")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    board.share_permission === "edit" ? "bg-[#d4a853]/15 text-[#d4a853]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-3 w-3" /> Can edit
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/50">
                {board.share_permission === "edit"
                  ? "Anyone with this link can add, move, and edit cards — no account needed. Changes sync live."
                  : "Anyone with this link can view the board — read-only, no account needed."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  onClick={() => setPendingPermission("view")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    pendingPermission === "view" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-3 w-3" /> Can view
                </button>
                <button
                  onClick={() => setPendingPermission("edit")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                    pendingPermission === "edit" ? "bg-[#d4a853]/15 text-[#d4a853]" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-3 w-3" /> Can edit
                </button>
              </div>
              <button onClick={() => handleGenerateShare(pendingPermission)} disabled={shareLoading} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#d4a853] px-3 py-2 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors">
                {shareLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                Generate share link
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import panel */}
      {importOpen && projectId && (
        <ImportPanel
          boardId={board.id}
          projectId={projectId}
          onClose={() => setImportOpen(false)}
          onImported={handlePanelCards}
        />
      )}

      {/* AI Breakdown panel */}
      {breakdownOpen && (
        <BreakdownPanel
          boardId={board.id}
          onClose={() => setBreakdownOpen(false)}
          onAdded={handlePanelCards}
        />
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ cursor: dragRef.current?.type === "pan" ? "grabbing" : "default" }}
        onPointerDown={handleCanvasPointerDown}
        onDoubleClick={handleCanvasDoubleClick as unknown as React.MouseEventHandler}
      >
        {cards.length === 0 && !readonly && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none select-none z-10">
            <p className="text-sm text-muted-foreground/40">Double-click anywhere to add a note</p>
            <p className="text-xs text-muted-foreground/25">or use the toolbar below to add cards</p>
          </div>
        )}

        {/* World */}
        <div
          ref={worldRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transformOrigin: "0 0",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            willChange: "transform",
          }}
        >
          {orderedCards.map((card) => (
            <div key={card.id} style={{ position: "absolute", left: card.x, top: card.y }}>
              <BoardCardComponent
                card={card}
                projectId={projectId}
                readonly={readonly}
                disableAI={!!shareToken}
                actions={boardActions}
                isDragging={draggingCardId === card.id}
                isResizing={resizingCardId === card.id}
                startInlineEdit={newCardId === card.id}
                onDragStart={startCardDrag}
                onResizeStart={startCardResize}
                onUpdate={handleCardUpdate}
                onOpenModal={setModalCard}
                onAI={setModalCard}
                onPush={handlePush}
                onDelete={handleCardDelete}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom toolbar */}
      {!readonly && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 rounded-2xl border border-border bg-card/95 backdrop-blur-md px-2.5 py-2 shadow-xl">
          {TOOLBAR_TYPES.map(({ type, icon, label }) => (
            <button
              key={type}
              title={label}
              onClick={() => addCardAtCenter(type)}
              disabled={addingType !== null}
              className="flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            >
              {addingType === type ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
              <span className="text-[9px] font-medium">{label}</span>
            </button>
          ))}

          <div className="mx-1.5 h-6 w-px bg-border" />

          {/* Production tools */}
          {projectId && (
            <button
              title="Import from project"
              onClick={() => { setBreakdownOpen(false); setImportOpen((o) => !o); }}
              className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors ${
                importOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Download className="h-4 w-4" />
              <span className="text-[9px] font-medium">Import</span>
            </button>
          )}

          {!shareToken && (
            <button
              title="AI Scene Breakdown"
              onClick={() => { setImportOpen(false); setBreakdownOpen((o) => !o); }}
              className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors ${
                breakdownOpen ? "bg-[#d4a853]/20 text-[#d4a853]" : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-[9px] font-medium">AI Break</span>
            </button>
          )}

          <div className="mx-1.5 h-6 w-px bg-border" />

          {/* Zoom */}
          <button onClick={() => adjustZoom(0.85)} title="Zoom out" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[38px] text-center text-[11px] text-muted-foreground/60 font-mono tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => adjustZoom(1.18)} title="Zoom in" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={fitToScreen} title="Fit to screen" className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hint */}
      {!readonly && cards.length > 0 && (
        <div className="absolute bottom-5 right-4 z-10 flex items-center gap-2 text-[10px] text-muted-foreground/30 select-none pointer-events-none">
          <span>Scroll to zoom · Drag canvas to pan · Double-click to add note</span>
        </div>
      )}

      {/* Edit modal (AI Enhance) */}
      <CardEditModal
        card={modalCard}
        onClose={() => setModalCard(null)}
        onSaved={(updated) => {
          handleCardUpdate(updated);
          setModalCard(null);
        }}
      />
    </div>
  );
}
