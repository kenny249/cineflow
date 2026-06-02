"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Download, ImageIcon, FileIcon, X } from "lucide-react";

// ─── Logo mark SVGs ──────────────────────────────────────────────────────────
// Brief: flow of a project. Progression, momentum, forward motion.

// Concept 1 — Nodes: three project phases as ascending milestone circles on a flow line.
// Small → medium → large: the project grows as it moves through production.
function MarkNodes({ size = 64, color = "#d4a853" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="12" y1="52" x2="52" y2="12" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <circle cx="12" cy="52" r="6" fill={color} />
      <circle cx="32" cy="32" r="9" fill={color} />
      <circle cx="52" cy="12" r="12" fill={color} />
    </svg>
  );
}

// Concept 2 — Frames: three film frames advancing forward, each larger than the last.
// The project scales as it moves — a small idea becomes a delivered film.
function MarkFrames({ size = 64, color = "#d4a853" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="48" width="12" height="12" rx="2" fill={color} />
      <rect x="22" y="25" width="17" height="17" rx="2" fill={color} />
      <rect x="41" y="4" width="22" height="22" rx="2" fill={color} />
    </svg>
  );
}

// Concept 3 — Playhead: the video timeline playhead — exactly where you are in the project.
// The most specific shape in video production. One triangle, one bar.
function MarkPlayhead({ size = 64, color = "#d4a853" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="38" width="56" height="8" rx="4" fill={color} />
      <polygon points="30,8 50,8 40,38" fill={color} />
    </svg>
  );
}

// ─── Logo candidate card ─────────────────────────────────────────────────────

function LogoCard({ label, mark, description }: {
  label: string;
  mark: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-zinc-300">{label}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{description}</p>
      </div>

      {/* On dark */}
      <div className="mx-4 mb-3 flex flex-col items-center justify-center gap-4 rounded-lg bg-[#080808] border border-white/[0.04] py-8">
        <div className="flex flex-col items-center gap-3">
          {mark}
          <p className="font-display text-xl font-bold tracking-[0.1em] text-white" style={{ fontFamily: "var(--font-syne)" }}>
            CINEFLOW
          </p>
        </div>
        <div className="flex items-center gap-6 opacity-60">
          <div className="flex items-center gap-2">
            {mark}
            <p className="font-display text-sm font-bold tracking-[0.1em] text-white" style={{ fontFamily: "var(--font-syne)" }}>
              CINEFLOW
            </p>
          </div>
        </div>
        {/* Small sizes */}
        <div className="flex items-center gap-4">
          {[64, 40, 24, 16].map((sz) => (
            <div key={sz} className="flex flex-col items-center gap-1">
              <MarkFrameAt size={sz} mark={mark} />
              <span className="text-[9px] text-zinc-700">{sz}px</span>
            </div>
          ))}
        </div>
      </div>

      {/* On light */}
      <div className="mx-4 mb-4 flex items-center justify-center gap-6 rounded-lg bg-white py-6">
        <div className="flex flex-col items-center gap-2">
          <LightMark mark={mark} size={48} />
          <p className="font-display text-sm font-bold tracking-[0.1em] text-[#080808]" style={{ fontFamily: "var(--font-syne)" }}>
            CINEFLOW
          </p>
        </div>
        <LightMark mark={mark} size={32} />
        <LightMark mark={mark} size={20} />
      </div>

      {/* Social crop preview */}
      <div className="mx-4 mb-4 flex items-center gap-4">
        <div>
          <p className="text-[10px] text-zinc-600 mb-1.5">Profile pic preview</p>
          <div className="h-14 w-14 rounded-full bg-[#080808] flex items-center justify-center border border-white/[0.06]">
            <MarkFrameAt size={32} mark={mark} />
          </div>
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 mb-1.5">Square (TikTok/IG)</p>
          <div className="h-14 w-14 rounded-xl bg-[#080808] flex items-center justify-center border border-white/[0.06]">
            <MarkFrameAt size={32} mark={mark} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkFrameAt({ size, mark }: { size: number; mark: React.ReactNode }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {mark}
    </div>
  );
}

function LightMark({ mark, size }: { mark: React.ReactNode; size: number }) {
  // Render mark on light bg (mark components need color inversion for light bg)
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {mark}
    </div>
  );
}

// ─── Color swatch ────────────────────────────────────────────────────────────

function Swatch({ name, hex, usage, textDark }: { name: string; hex: string; usage: string; textDark?: boolean }) {
  return (
    <div className="space-y-2">
      <div
        className="h-16 w-full rounded-lg border border-white/[0.06]"
        style={{ background: hex }}
      />
      <div>
        <p className={`text-xs font-semibold ${textDark ? "text-zinc-800" : "text-zinc-200"}`}>{name}</p>
        <p className="font-mono text-[11px] text-zinc-500">{hex}</p>
        <p className="text-[10px] text-zinc-600 mt-0.5">{usage}</p>
      </div>
    </div>
  );
}

// ─── Asset library ───────────────────────────────────────────────────────────

type Asset = { name: string; path: string; url: string; size: number; type: string };

function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function isImage(type: string) {
  return type.startsWith("image/");
}

export function BrandClient({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    const results: Asset[] = [];
    for (const file of arr) {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "uploads");
      const res = await fetch("/api/admin/brand", { method: "POST", body: form });
      const json = await res.json();
      if (res.ok) {
        results.push(json);
        toast.success(`Uploaded ${file.name}`);
      } else {
        toast.error(json.error ?? `Failed to upload ${file.name}`);
      }
    }
    setAssets((prev) => [...results, ...prev]);
    setUploading(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const deleteAsset = async (path: string) => {
    if (!confirm("Delete this asset?")) return;
    const res = await fetch(`/api/admin/brand?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.path !== path));
      toast.success("Deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="space-y-12 p-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Brand</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Cineflow brand system — logos, colors, type, assets</p>
      </div>

      {/* ── Logo Candidates ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-base font-bold text-white">Logo Candidates</h2>
          <p className="text-xs text-zinc-500 mt-1">Reset. Three filled shapes — no outlines. Each reads as a pure silhouette. The Apple approach.</p>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <LogoCard
            label="Route 1 — Heavy Lens"
            description="A bold solid ring and center dot. Barrel, glass, light — three things that read as one. Flip it to pure black: still perfect."
            mark={<MarkHeavyLens size={64} />}
          />
          <LogoCard
            label="Route 2 — Letterbox"
            description="Two solid bars. The exact proportions of cinemascope 2.39:1 — the bars every filmmaker knows. Made gold. The gap between them is the cinema screen."
            mark={<MarkLetterbox size={64} />}
          />
          <LogoCard
            label="Route 3 — C Mark"
            description="A bold filled geometric C. Not a typeface — a custom ring shape. The opening angle is the geometry of a camera iris at f/2.8. Letter at small size. Lens at large."
            mark={<MarkBoldC size={64} />}
          />
        </div>
      </section>

      {/* ── Colors ──────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-base font-bold text-white">Colors</h2>
        <div className="grid grid-cols-6 gap-4">
          <Swatch name="Gold" hex="#d4a853" usage="Primary brand, CTAs, highlights" />
          <Swatch name="Gold Light" hex="#f0c97a" usage="Hover states, gradients" />
          <Swatch name="Obsidian" hex="#080808" usage="App background, logo base" />
          <Swatch name="Surface" hex="#141414" usage="Cards, modals, panels" />
          <Swatch name="Border" hex="#1f1f1f" usage="Dividers, subtle borders" />
          <Swatch name="White" hex="#ffffff" usage="Primary text, light backgrounds" textDark />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4">
          <Swatch name="Zinc 300" hex="#d4d4d8" usage="Secondary text" />
          <Swatch name="Zinc 500" hex="#71717a" usage="Muted labels, metadata" />
          <Swatch name="Zinc 700" hex="#3f3f46" usage="Inactive borders" />
          <Swatch name="Zinc 900" hex="#18181b" usage="Deep surface" />
        </div>
      </section>

      {/* ── Typography ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-5 text-base font-bold text-white">Typography</h2>
        <div className="grid grid-cols-2 gap-5">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-4">Display — Syne</p>
            <p className="font-display text-5xl font-bold text-white leading-none" style={{ fontFamily: "var(--font-syne)" }}>
              Cineflow
            </p>
            <p className="font-display text-2xl font-bold text-[#d4a853] mt-2 tracking-widest" style={{ fontFamily: "var(--font-syne)" }}>
              CINEFLOW
            </p>
            <p className="font-display text-sm font-semibold text-zinc-400 mt-3" style={{ fontFamily: "var(--font-syne)" }}>
              The production platform built for filmmakers who move fast.
            </p>
            <div className="mt-4 space-y-1 text-zinc-600 text-xs">
              <p style={{ fontFamily: "var(--font-syne)", fontWeight: 800 }}>800 — ExtraBold</p>
              <p style={{ fontFamily: "var(--font-syne)", fontWeight: 700 }}>700 — Bold</p>
              <p style={{ fontFamily: "var(--font-syne)", fontWeight: 600 }}>600 — SemiBold</p>
              <p style={{ fontFamily: "var(--font-syne)", fontWeight: 500 }}>500 — Medium</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-4">Body — Inter</p>
            <p className="text-2xl font-semibold text-white">The right tool changes everything.</p>
            <p className="text-base text-zinc-300 mt-3 leading-relaxed">
              Plan shoots, manage edits, and deliver projects. Built for solo creators and film teams who need to move fast without losing control.
            </p>
            <p className="text-sm text-zinc-500 mt-3">
              Labels, metadata, captions, secondary copy.
            </p>
            <div className="mt-4 space-y-1 text-zinc-600 text-xs">
              <p style={{ fontWeight: 700 }}>700 — Bold (headings)</p>
              <p style={{ fontWeight: 500 }}>500 — Medium (UI labels)</p>
              <p style={{ fontWeight: 400 }}>400 — Regular (body)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Asset Library ────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Asset Library</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Upload logos, mockups, brand images — PNG, JPEG, SVG, WebP, PDF</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-bold text-black hover:bg-[#e0b55e] transition-all disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload files"}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); }}
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`mb-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-all ${
            dragging
              ? "border-[#d4a853]/60 bg-[#d4a853]/5"
              : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
          }`}
        >
          <Upload className={`h-6 w-6 ${dragging ? "text-[#d4a853]" : "text-zinc-600"}`} />
          <p className="text-sm text-zinc-500">
            {dragging ? "Drop to upload" : "Drag & drop files here, or click to browse"}
          </p>
          <p className="text-xs text-zinc-700">PNG, JPEG, SVG, WebP, PDF · max 20MB each</p>
        </div>

        {/* Grid */}
        {assets.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">No assets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {assets.map((a) => (
              <div key={a.path} className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                {/* Preview */}
                <div className="flex h-36 items-center justify-center bg-[#0d0d0d]">
                  {isImage(a.type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name}
                      className="max-h-full max-w-full object-contain p-3"
                    />
                  ) : (
                    <FileIcon className="h-10 w-10 text-zinc-600" />
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <a
                    href={a.url}
                    download={a.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAsset(a.path); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Meta */}
                <div className="p-3">
                  <p className="truncate text-xs font-medium text-zinc-300">{a.name}</p>
                  <p className="text-[10px] text-zinc-600">{formatBytes(a.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
