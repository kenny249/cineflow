"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import type { SignatureField } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PDFViewerProps {
  url: string;
  fields?: SignatureField[];
  dropMode?: "sender" | "recipient" | null;
  onFieldPlace?: (field: Omit<SignatureField, "id">) => void;
  onFieldClick?: (field: SignatureField) => void;
  highlightRole?: "sender" | "recipient"; // pulse-highlight fields of this role
  className?: string;
}

interface PageDimensions {
  width: number;  // PDF points
  height: number; // PDF points
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PDFViewer({
  url,
  fields = [],
  dropMode = null,
  onFieldPlace,
  onFieldClick,
  highlightRole,
  className = "",
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageDims, setPageDims] = useState<PageDimensions | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  // Load pdfjs lazily (client-only)
  useEffect(() => {
    let cancelled = false;
    async function loadPDF() {
      try {
        setLoading(true);
        setError(null);
        const pdfjsLib = await import("pdfjs-dist");
        // Use CDN worker — avoids Next.js webpack worker bundling issues
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (e) {
        if (!cancelled) setError("Failed to load PDF");
        setLoading(false);
      }
    }
    loadPDF();
    return () => { cancelled = true; };
  }, [url]);

  // Render current page to canvas
  const renderPage = useCallback(async () => {
    if (!pdfRef.current || !canvasRef.current) return;
    try {
      // Cancel any in-progress render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

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
      if (e?.name !== "RenderingCancelledException") {
        console.error("PDF render error", e);
      }
    }
  }, [currentPage, scale]);

  useEffect(() => {
    if (!loading && pdfRef.current) renderPage();
  }, [loading, renderPage]);

  // Coordinate helpers: screen → PDF points
  function screenToPDF(e: React.MouseEvent<HTMLDivElement>) {
    if (!canvasRef.current || !pageDims) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    // canvas CSS size matches canvas pixel size (since we set canvas.width/height = viewport)
    // viewport = page.getViewport({ scale }), so 1 canvas px = 1 CSS px
    const pdfX = relX / scale;
    const pdfY = pageDims.height - relY / scale; // PDF y is from bottom
    return { pdfX, pdfY };
  }

  // PDF points → CSS pixels on the rendered canvas
  function pdfToScreen(x: number, y: number): { left: number; top: number } {
    if (!pageDims) return { left: 0, top: 0 };
    return {
      left: x * scale,
      top: (pageDims.height - y) * scale,
    };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!dropMode || !onFieldPlace || !pageDims) return;
    const pos = screenToPDF(e);
    if (!pos) return;
    const fieldW = 180; // pts
    const fieldH = 50;  // pts
    onFieldPlace({
      page: currentPage,
      x: pos.pdfX - fieldW / 2,
      y: pos.pdfY - fieldH / 2,
      width: fieldW,
      height: fieldH,
      role: dropMode,
    });
  }

  const pageFields = fields.filter((f) => f.page === currentPage);

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[70px] text-center text-xs text-muted-foreground">
            {numPages > 0 ? `${currentPage} / ${numPages}` : "—"}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.75, s - 0.25))}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[42px] text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        {dropMode && (
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            dropMode === "sender"
              ? "bg-[#d4a853]/20 text-[#d4a853]"
              : "bg-sky-500/20 text-sky-400"
          }`}>
            Click to place {dropMode === "sender" ? "your" : "recipient"} field
          </span>
        )}
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 ${
          dropMode ? "cursor-crosshair" : ""
        }`}
        onClick={handleCanvasClick}
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
            <canvas
              ref={canvasRef}
              className="block shadow-lg"
              style={{ background: "white" }}
            />

            {/* Signature field overlays */}
            {pageDims && pageFields.map((field) => {
              const { left, top } = pdfToScreen(field.x, field.y + field.height);
              const w = field.width * scale;
              const h = field.height * scale;
              const isHighlighted = highlightRole === field.role;
              const isSender = field.role === "sender";

              return (
                <div
                  key={field.id}
                  className={`absolute flex flex-col items-center justify-center border-2 rounded transition-all select-none
                    ${isSender
                      ? "border-[#d4a853] bg-[#d4a853]/10"
                      : "border-sky-400 bg-sky-400/10"
                    }
                    ${isHighlighted ? "animate-pulse ring-2 ring-offset-1 ring-sky-400/50 cursor-pointer" : ""}
                    ${onFieldClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}
                  `}
                  style={{
                    left: left + 16, // +16 for the p-4 padding
                    top: top + 16,
                    width: w,
                    height: h,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFieldClick) onFieldClick(field);
                  }}
                >
                  {/* Signature image if signed */}
                  {field.role === "sender" && (field as any).signatureData ? (
                    <img
                      src={(field as any).signatureData}
                      alt="Signature"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <>
                      <span className={`text-[10px] font-semibold ${isSender ? "text-[#d4a853]" : "text-sky-400"}`}>
                        {isSender ? "Your Signature" : "Sign Here"}
                      </span>
                      {isHighlighted && (
                        <span className="text-[9px] text-sky-400/70 mt-0.5">Click to sign</span>
                      )}
                    </>
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
