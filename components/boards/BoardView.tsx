"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  StickyNote, ScrollText, Camera, CheckSquare, Link2, Image as ImageIcon, Video,
  MapPin, User, Share2, Copy, Check, Loader2, Trash2, X, ZoomIn, ZoomOut,
  Maximize2, Printer, Download, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Board, BoardCard, CardType, BoardWithCards } from "@/lib/boards";
import {
  createCard, updateCardPosition, generateShareToken, revokeShareToken,
  pushShotToShotList, pushScriptToNotes,
} from "@/lib/boards";
import { BoardCardComponent } from "./BoardCard";
import { CardEditModal } from "./CardEditModal";
import { ImportPanel } from "./ImportPanel";
import { BreakdownPanel } from "./BreakdownPanel";

// ── Types ──────────────────────────────────────────────────────────────────────

type DragState =
  | { type: "card"; cardId: string; cardStartX: number; cardStartY: number; pointerStartX: number; pointerStartY: number; currentDx: number; currentDy: number }
  | { type: "pan"; panStartX: number; panStartY: number; pointerStartX: number; pointerStartY: number };

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
};

const TOOLBAR_TYPES: { type: CardType; icon: React.ReactNode; label: string }[] = [
  { type: "note",      icon: <StickyNote  className="h-4 w-4" />, label: "Note"      },
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
}

export function BoardView({ board: initialBoard, projectId, readonly }: BoardViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [cards, _setCards] = useState<BoardCard[]>(initialBoard.cards);
  const [pan, _setPan] = useState({ x: 60, y: 60 });
  const [zoom, _setZoom] = useState(1);
  const [board, setBoard] = useState(initialBoard);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<BoardCard | null>(null);
  const [newCardId, setNewCardId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addingType, setAddingType] = useState<CardType | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const cardsRef = useRef<BoardCard[]>(initialBoard.cards);
  const panRef = useRef({ x: 60, y: 60 });
  const zoomRef = useRef(1);

  const setCards = useCallback((fn: (c: BoardCard[]) => BoardCard[]) => {
    const next = fn(cardsRef.current);
    cardsRef.current = next;
    _setCards(next);
  }, []);

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
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          const newX = dr.cardStartX + dx;
          const newY = dr.cardStartY + dy;
          setCards((prev) => prev.map((c) => c.id === dr.cardId ? { ...c, x: newX, y: newY } : c));
          updateCardPosition(dr.cardId, newX, newY).catch(() => toast.error("Failed to save position"));
        }
        setDraggingCardId(null);
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
  }, [setCards, setPan]);

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
    if (readonly || e.button !== 0) return;
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
    setDraggingCardId(card.id);
  }

  // ── Add card ──────────────────────────────────────────────────────────────────

  async function addCardAt(type: CardType, x: number, y: number) {
    setAddingType(type);
    try {
      const card = await createCard(board.id, type, DEFAULT_CONTENT[type], x, y);
      setCards((prev) => [...prev, card]);
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

  function handleCardUpdate(updated: BoardCard) {
    setCards((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c));
    setNewCardId(null);
  }

  function handleCardDelete(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
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

  async function handleGenerateShare() {
    setShareLoading(true);
    try {
      const token = await generateShareToken(board.id);
      setBoard((b) => ({ ...b, share_token: token }));
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

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Top right actions */}
      {!readonly && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          <button
            onClick={() => setShareOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card/90 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </button>
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
            </div>
          ) : (
            <button onClick={handleGenerateShare} disabled={shareLoading} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#d4a853] px-3 py-2 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors">
              {shareLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
              Generate share link
            </button>
          )}
          <p className="text-[10px] text-muted-foreground/50">Anyone with the link can view (read-only).</p>
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
          {cards.map((card) => (
            <div key={card.id} style={{ position: "absolute", left: card.x, top: card.y }}>
              <BoardCardComponent
                card={card}
                projectId={projectId}
                readonly={readonly}
                isDragging={draggingCardId === card.id}
                startInlineEdit={newCardId === card.id}
                onDragStart={startCardDrag}
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
