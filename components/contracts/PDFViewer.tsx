"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Wand2 } from "lucide-react";
import type { SignatureField } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PDFViewerProps {
  url: string;
  fields?: SignatureField[];
  dropMode?: "sender" | "recipient" | null;
  onFieldPlace?: (field: Omit<SignatureField, "id">) => void;
  onFieldClick?: (field: SignatureField) => void;
  onAutoDetect?: (fields: Omit<SignatureField, "id">[]) => void;
  highlightRole?: "sender" | "recipient"; // pulse-highlight fields of this role
  className?: string;
}

interface PageDimensions {
  width: number;  // PDF points
  height: number; // PDF points
}

// ── Signature field detection ─────────────────────────────────────────────────

async function detectSignatureFields(pdf: any): Promise<Omit<SignatureField, "id">[]> {
  const results: Omit<SignatureField, "id">[] = [];

  for (let pn = 1; pn <= pdf.numPages; pn++) {
    const page = await pdf.getPage(pn);
    const content = await page.getTextContent();
    const rawItems = (content.items as any[])
      .filter((i) => i.str?.trim())
      .map((i) => ({ str: i.str.trim(), x: i.transform[4], y: i.transform[5] }));

    // Sort top-to-bottom (highest y = top in PDF space)
    rawItems.sort((a, b) => b.y - a.y);

    const LABEL_RE = /accepted\s*by|sign\s*here|signature|authorized\s*sign|client\s*sign|sign\s*below/i;
    const LINE_RE = /^[_\-]{6,}$/;

    for (let i = 0; i < rawItems.length; i++) {
      const { str, x, y } = rawItems[i];
      if (!LABEL_RE.test(str) || str.length > 60) continue;

      // Look for a dash/underscore line below this label (within 80pts)
      const lineBelow = rawItems.slice(i + 1).find(
        (t) => LINE_RE.test(t.str) && Math.abs(t.x - x) < 200 && y - t.y > 0 && y - t.y < 80
      );

      const fieldY = lineBelow ? lineBelow.y - 5 : y - 60;
      const fieldX = lineBelow ? lineBelow.x - 5 : x;

      // Deduplicate — skip if we already placed a field very close
      const duplicate = results.some(
        (r) => r.page === pn && Math.abs(r.x - fieldX) < 80 && Math.abs(r.y - fieldY) < 40
      );
      if (!duplicate) {
        results.push({ page: pn, x: fieldX, y: fieldY, width: 190, height: 50, role: "recipient" });
      }
    }

    // Also catch standalone signature lines not preceded by a matched label
    for (const { str, x, y } of rawItems) {
      if (!LINE_RE.test(str) || str.length < 8) continue;
      const alreadyCovered = results.some(
        (r) => r.page === pn && Math.abs(r.x - x) < 100 && Math.abs(r.y - y) < 40
      );
      if (!alreadyCovered) {
        results.push({ page: pn, x: x - 5, y: y - 5, width: 190, height: 50, role: "recipient" });
      }
    }
  }

  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PDFViewer({
  url,
  fields = [],
  dropMode = null,
  onFieldPlace,
  onFieldClick,
  onAutoDetect,
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
  const [detecting, setDetecting] = useState(false);

  // Load pdfjs lazily (client-only)
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
        setLoading(false);

        // Auto-detect signature fields after PDF loads
        if (onAutoDetect) {
          setDetecting(true);
          try {
            const detected = await detectSignatureFields(pdf);
            if (!cancelled && detected.length > 0) onAutoDetect(detected);
          } finally {
            if (!cancelled) setDetecting(false);
          }
        }
      } catch {
        if (!cancelled) setError("Failed to load PDF");
        setLoading(false);
      }
    }
    loadPDF();
    return () => { cancelled = true; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render current page to canvas
  const renderPage = useCallback(async () => {
    if (!pdfRef.current || !canvasRef.current) return;
    try {
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
      if (e?.name !== "RenderingCancelledException") console.error("PDF render error", e);
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
    const pdfX = relX / scale;
    const pdfY = pageDims.height - relY / scale;
    return { pdfX, pdfY };
  }

  // PDF points → CSS pixels on the rendered canvas
  function pdfToScreen(x: number, y: number): { left: number; top: number } {
    if (!pageDims) return { left: 0, top: 0 };
    return { left: x * scale, top: (pageDims.height - y) * scale };
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!dropMode || !onFieldPlace || !pageDims) return;
    const pos = screenToPDF(e);
    if (!pos) return;
    const fieldW = 180;
    const fieldH = 50;
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
        <div className="flex items-center gap-2">
          {detecting && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Wand2 className="h-3 w-3 animate-pulse" /> Scanning…
            </span>
          )}
          {dropMode && (
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
              dropMode === "sender" ? "bg-[#d4a853]/20 text-[#d4a853]" : "bg-sky-500/20 text-sky-400"
            }`}>
              Click to place {dropMode === "sender" ? "your" : "recipient"} field
            </span>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setScale((s) => Math.max(0.75, s - 0.25))} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[42px] text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.25))} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 ${dropMode ? "cursor-crosshair" : ""}`}
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
            <canvas ref={canvasRef} className="block shadow-lg" style={{ background: "white" }} />

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
                    ${isSender ? "border-[#d4a853] bg-[#d4a853]/10" : "border-sky-400 bg-sky-400/10"}
                    ${isHighlighted ? "animate-pulse ring-2 ring-offset-1 ring-sky-400/50 cursor-pointer" : ""}
                    ${onFieldClick ? "cursor-pointer hover:opacity-90" : "cursor-default"}
                  `}
                  style={{ left: left + 16, top: top + 16, width: w, height: h }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFieldClick) onFieldClick(field);
                  }}
                >
                  {field.role === "sender" && (field as any).signatureData ? (
                    <img src={(field as any).signatureData} alt="Signature" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <>
                      <span className={`text-[10px] font-semibold ${isSender ? "text-[#d4a853]" : "text-sky-400"}`}>
                        {isSender ? "Your Signature" : "Sign Here"}
                      </span>
                      {isHighlighted && <span className="text-[9px] text-sky-400/70 mt-0.5">Click to sign</span>}
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
