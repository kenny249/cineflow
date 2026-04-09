"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Move, Check, Upload } from "lucide-react";

interface PhotoCropModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (dataUrl: string, position: { x: number; y: number; scale: number }) => void;
  initialUrl?: string;
}

export function PhotoCropModal({ open, onClose, onApply, initialUrl }: PhotoCropModalProps) {
  const [imgSrc, setImgSrc] = useState<string>(initialUrl ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 50, y: 50 }); // percentage offsets
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, px: 0, py: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && initialUrl) {
      setImgSrc(initialUrl);
      setImgLoaded(false);
      setScale(1);
      setPos({ x: 50, y: 50 });
    }
    if (!open) {
      setUrlInput("");
      setImgLoaded(false);
    }
  }, [open, initialUrl]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgSrc(e.target?.result as string);
      setScale(1);
      setPos({ x: 50, y: 50 });
      setImgLoaded(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const handleUrlApply = () => {
    const val = urlInput.trim();
    if (!val) return;
    try { new URL(val); } catch { return; }
    setImgSrc(val);
    setScale(1);
    setPos({ x: 50, y: 50 });
    setImgLoaded(false);
  };

  // Drag-to-reposition
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imgLoaded) return;
    e.preventDefault();
    setDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y });
  }, [imgLoaded, pos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.mx) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.my) / rect.height) * 100;
    setPos({
      x: Math.max(0, Math.min(100, dragStart.px - dx * (1 / scale))),
      y: Math.max(0, Math.min(100, dragStart.py - dy * (1 / scale))),
    });
  }, [dragging, dragStart, scale]);

  // Touch drag
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!imgLoaded) return;
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y });
  }, [imgLoaded, pos]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging || !previewRef.current) return;
    const t = e.touches[0];
    const rect = previewRef.current.getBoundingClientRect();
    const dx = ((t.clientX - dragStart.mx) / rect.width) * 100;
    const dy = ((t.clientY - dragStart.my) / rect.height) * 100;
    setPos({
      x: Math.max(0, Math.min(100, dragStart.px - dx * (1 / scale))),
      y: Math.max(0, Math.min(100, dragStart.py - dy * (1 / scale))),
    });
  }, [dragging, dragStart, scale]);

  const stopDrag = () => setDragging(false);

  const handleApply = () => {
    onApply(imgSrc, { x: pos.x, y: pos.y, scale });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="font-display text-sm font-semibold text-foreground">Edit Cover Photo</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview / drop zone */}
          <div
            ref={previewRef}
            className={`relative aspect-video w-full overflow-hidden rounded-xl border-2 border-dashed transition-all ${
              imgLoaded ? "border-transparent cursor-grab active:cursor-grabbing" : "border-border bg-muted/50 cursor-default"
            }`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={stopDrag}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {imgSrc ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full select-none pointer-events-none"
                  style={{
                    objectFit: "cover",
                    objectPosition: `${pos.x}% ${pos.y}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${pos.x}% ${pos.y}%`,
                    transition: dragging ? "none" : "transform 0.15s ease",
                  }}
                  onLoad={() => setImgLoaded(true)}
                  draggable={false}
                />
                {imgLoaded && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 backdrop-blur-sm">
                    <Move className="h-3 w-3 text-white/70" />
                    <span className="text-[10px] text-white/70">Drag to reposition</span>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload className="h-8 w-8" />
                <span className="text-xs">Click to upload or drag & drop</span>
              </button>
            )}
          </div>

          {/* Zoom slider */}
          {imgLoaded && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScale((s) => Math.max(0.8, s - 0.1))}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0.8}
                max={2.5}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 h-1.5 appearance-none rounded-full bg-border accent-[#d4a853] cursor-pointer"
              />
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <span className="text-[10px] text-muted-foreground w-8 text-right">{(scale * 100).toFixed(0)}%</span>
            </div>
          )}

          {/* URL input */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Or paste an image URL…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleUrlApply(); }}
              className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#d4a853]/50 transition-colors"
            />
            <button
              onClick={handleUrlApply}
              className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
            >
              Load
            </button>
          </div>

          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-[#d4a853]/40 hover:text-[#d4a853] transition-colors flex items-center justify-center gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload from device
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-5 py-3.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!imgLoaded && !imgSrc}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#d4a853] py-2 text-xs font-bold text-black hover:bg-[#d4a853]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="h-3.5 w-3.5" />
            Apply Photo
          </button>
        </div>
      </div>
    </div>
  );
}
