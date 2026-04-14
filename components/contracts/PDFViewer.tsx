"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import type { SignatureField } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FieldDropMode = "sender" | "recipient" | "text" | "date" | null;

interface PDFViewerProps {
  url: string;
  fields?: SignatureField[];
  dropMode?: FieldDropMode;
  onFieldPlace?: (field: Omit<SignatureField, "id">) => void;
  onFieldClick?: (field: SignatureField) => void;
  onFieldDelete?: (id: string) => void;
  onFieldMove?: (id: string, x: number, y: number) => void;
  highlightRole?: "sender" | "recipient";
  className?: string;
}

interface PageDimensions {
  width: number;
  height: number;
}

interface DragState {
  fieldId: string;
  startClientX: number;
  startClientY: number;
  originalX: number;
  originalY: number;
  offsetPdfX: number;
  offsetPdfY: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PDFViewer({
  url,
  fields = [],
  dropMode = null,
  onFieldPlace,
  onFieldClick,
  onFieldDelete,
  onFieldMove,
  highlightRole,
  className = "",
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const nativeWidthRef = useRef<number>(0);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  // ── Drag state ───────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragMoved = useRef(false);

  const computeFitScale = useCallback(() => {
    if (!containerRef.current || !nativeWidthRef.current) return 1.0;
    const containerW = containerRef.current.clientWidth - 32;
    if (containerW <= 0) return 1.0;
    return Math.max(0.5, Math.min(containerW / nativeWidthRef.current, 2.5));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        const firstPage = await pdf.getPage(1);
        nativeWidthRef.current = firstPage.view[2];
        await new Promise((r) => requestAnimationFrame(r));
        if (!cancelled) setScale(computeFitScale());
        setLoading(false);
      } catch {
        if (!cancelled) setError("Failed to load PDF");
        setLoading(false);
      }
    }
    loadPDF();
    return () => { cancelled = true; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderPage = useCallback(async () => {
    if (!pdfRef.current || !canvasRef.current) return;
    try {
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
      const page = await pdfRef.current.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageDims({ width: page.view[2], height: page.view[3] });
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (e: any) {
      if (e?.name !== "RenderingCancelledException") console.error("PDF render error", e);
    }
  }, [currentPage, scale]);

  useEffect(() => {
    if (!loading && pdfRef.current) renderPage();
  }, [loading, renderPage]);

  function pdfToScreen(x: number, y: number): { left: number; top: number } {
    if (!pageDims) return { left: 0, top: 0 };
    return { left: x * scale, top: (pageDims.height - y) * scale };
  }

  // ── Drag helpers ─────────────────────────────────────────────────────────────

  function startDragFromEvent(
    field: SignatureField,
    clientX: number,
    clientY: number
  ) {
    if (dropMode || !onFieldMove) return false;
    dragMoved.current = false;
    setDragging({
      fieldId: field.id,
      startClientX: clientX,
      startClientY: clientY,
      originalX: field.x,
      originalY: field.y,
      offsetPdfX: 0,
      offsetPdfY: 0,
    });
    return true;
  }

  function handleFieldMouseDown(e: React.MouseEvent, field: SignatureField) {
    if (!startDragFromEvent(field, e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function handleFieldTouchStart(e: React.TouchEvent, field: SignatureField) {
    if (!startDragFromEvent(field, e.touches[0].clientX, e.touches[0].clientY)) return;
    e.stopPropagation();
    // Note: don't preventDefault here — breaks scroll when not dragging
  }

  function updateDragOffset(clientX: number, clientY: number) {
    if (!dragging) return;
    const dx = clientX - dragging.startClientX;
    const dy = clientY - dragging.startClientY;
    if (!dragMoved.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dragMoved.current = true;
    setDragging((p) => p ? { ...p, offsetPdfX: dx / scale, offsetPdfY: -dy / scale } : null);
  }

  function commitDrag() {
    if (dragging && dragMoved.current && onFieldMove) {
      onFieldMove(dragging.fieldId, dragging.originalX + dragging.offsetPdfX, dragging.originalY + dragging.offsetPdfY);
    }
    setDragging(null);
  }

  function handleContainerMouseMove(e: React.MouseEvent) { updateDragOffset(e.clientX, e.clientY); }
  function handleContainerTouchMove(e: React.TouchEvent) { updateDragOffset(e.touches[0].clientX, e.touches[0].clientY); }
  function handleContainerMouseUp() { commitDrag(); }
  function handleContainerTouchEnd() { commitDrag(); }

  // ── Click handler ─────────────────────────────────────────────────────────────

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragMoved.current) { dragMoved.current = false; return; }
    if (!dropMode || !onFieldPlace || !pageDims) return;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pdfX = (e.clientX - rect.left) / scale;
    const pdfY = pageDims.height - (e.clientY - rect.top) / scale;
    const isTextOrDate = dropMode === "text" || dropMode === "date";
    const fieldW = isTextOrDate ? 160 : 180;
    const fieldH = isTextOrDate ? 36 : 50;
    onFieldPlace({
      page: currentPage,
      x: pdfX - fieldW / 2,
      y: pdfY - fieldH / 2,
      width: fieldW,
      height: fieldH,
      role: dropMode === "sender" ? "sender" : "recipient",
      type: isTextOrDate ? (dropMode as "text" | "date") : "signature",
      value: dropMode === "date"
        ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "",
    });
  }

  const pageFields = fields.filter((f) => f.page === currentPage);
  const canDrag = !!onFieldMove && !dropMode;

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 py-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[70px] text-center text-xs text-muted-foreground">
            {numPages > 0 ? `${currentPage} / ${numPages}` : "—"}
          </span>
          <button onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {dropMode && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              dropMode === "sender" ? "bg-[#d4a853]/20 text-[#d4a853]" :
              dropMode === "recipient" ? "bg-sky-500/20 text-sky-400" :
              "bg-violet-500/20 text-violet-400"
            }`}>
              Click to place {dropMode === "sender" ? "your sig" : dropMode === "recipient" ? "recipient sig" : dropMode} field
            </span>
          )}
          {canDrag && !dropMode && (
            <span className="text-[10px] text-muted-foreground/50">Drag to reposition</span>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[42px] text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.25))} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={() => setScale(computeFitScale())} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Fit to width">
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 ${
          dropMode ? "cursor-crosshair" : dragging ? "cursor-grabbing select-none" : ""
        }`}
        onClick={handleCanvasClick}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={() => { if (dragging) { setDragging(null); dragMoved.current = false; } }}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerTouchEnd}
      >
        {loading && (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="relative mx-auto w-fit p-4">
            <canvas ref={canvasRef} className="block shadow-lg" style={{ background: "white" }} />

            {pageDims && pageFields.map((field) => {
              const fieldType = field.type ?? "signature";
              const isDraggingThis = dragging?.fieldId === field.id;
              const renderX = field.x + (isDraggingThis ? dragging!.offsetPdfX : 0);
              const renderY = field.y + (isDraggingThis ? dragging!.offsetPdfY : 0);
              const { left, top } = pdfToScreen(renderX, renderY + field.height);
              const w = field.width * scale;
              const h = field.height * scale;
              const isHovered = hoveredFieldId === field.id;
              const dragCursor = canDrag ? (isDraggingThis ? "cursor-grabbing" : "cursor-grab") : "";

              // ── Text / Date overlay ──────────────────────────────────
              if (fieldType === "text" || fieldType === "date") {
                return (
                  <div
                    key={field.id}
                    className={`absolute flex items-center rounded border-2 border-dashed select-none overflow-hidden transition-colors
                      ${isDraggingThis ? "border-violet-500 shadow-lg opacity-90" : "border-violet-400/80 hover:border-violet-500"}
                      ${dragCursor}
                      ${onFieldClick && !canDrag ? "cursor-pointer" : ""}
                    `}
                    style={{
                      left: left + 16, top: top + 16, width: w, height: h,
                      zIndex: isDraggingThis ? 50 : 10,
                      touchAction: onFieldMove ? "none" : "auto",
                      background: "rgba(255,255,255,0.15)",
                    }}
                    onMouseEnter={() => setHoveredFieldId(field.id)}
                    onMouseLeave={() => setHoveredFieldId(null)}
                    onMouseDown={(e) => handleFieldMouseDown(e, field)}
                    onTouchStart={(e) => handleFieldTouchStart(e, field)}
                    onClick={(e) => { e.stopPropagation(); if (!dragMoved.current && onFieldClick) onFieldClick(field); }}
                  >
                    <span
                      className="px-2 text-[11px] font-semibold truncate w-full"
                      style={{ color: field.value ? "#111111" : "#9333ea", opacity: field.value ? 1 : 0.7 }}
                    >
                      {field.value || (fieldType === "date" ? "Click to set date" : "Click to enter text")}
                    </span>
                    {onFieldDelete && isHovered && !isDraggingThis && (
                      <button
                        className="absolute -top-2 -right-2 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600 shadow"
                        onClick={(e) => { e.stopPropagation(); onFieldDelete(field.id); }}
                      >×</button>
                    )}
                  </div>
                );
              }

              // ── Signature overlay ────────────────────────────────────
              const isHighlighted = highlightRole === field.role;
              const isSender = field.role === "sender";
              return (
                <div
                  key={field.id}
                  className={`absolute flex flex-col items-center justify-center border-2 rounded select-none transition-colors
                    ${isSender ? "border-[#d4a853] bg-[#d4a853]/10" : "border-sky-400 bg-sky-400/10"}
                    ${isHighlighted ? "animate-pulse ring-2 ring-offset-1 ring-sky-400/50" : ""}
                    ${isDraggingThis ? "shadow-lg opacity-90 scale-[1.02]" : ""}
                    ${dragCursor}
                    ${onFieldClick && !canDrag ? "cursor-pointer hover:opacity-90" : ""}
                  `}
                  style={{
                    left: left + 16, top: top + 16, width: w, height: h,
                    zIndex: isDraggingThis ? 50 : 10,
                    touchAction: onFieldMove ? "none" : "auto",
                  }}
                  onMouseEnter={() => setHoveredFieldId(field.id)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                  onMouseDown={(e) => handleFieldMouseDown(e, field)}
                  onTouchStart={(e) => handleFieldTouchStart(e, field)}
                  onClick={(e) => { e.stopPropagation(); if (!dragMoved.current && onFieldClick) onFieldClick(field); }}
                >
                  {(field as any).signatureData ? (
                    <img src={(field as any).signatureData} alt="Signature" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <>
                      <span className={`text-[10px] font-semibold ${isSender ? "text-[#d4a853]" : "text-sky-400"}`}>
                        {isSender ? "Your Signature" : "Sign Here"}
                      </span>
                      {isSender && onFieldClick && !canDrag && (
                        <span className="text-[9px] mt-0.5 text-[#d4a853]/60">Click to sign</span>
                      )}
                      {!isSender && (
                        <span className="text-[9px] mt-0.5 text-sky-400/60">
                          {highlightRole === "recipient" ? "Tap to sign" : "Recipient signs via link"}
                        </span>
                      )}
                    </>
                  )}
                  {onFieldDelete && isHovered && !isDraggingThis && (
                    <button
                      className="absolute -top-2 -right-2 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] leading-none hover:bg-red-600 shadow"
                      onClick={(e) => { e.stopPropagation(); onFieldDelete(field.id); }}
                    >×</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
