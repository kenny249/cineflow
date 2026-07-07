"use client";

import { useState, useRef, useCallback, useId } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Download, FileIcon } from "lucide-react";

// ─── CineFlow Mark SVG ───────────────────────────────────────────────────────
// Gold metallic diagonal slash on deep obsidian rounded square.
// The parallelogram references motion, the editorial cut, and forward momentum.

function CineFlowIcon({ size = 64 }: { size?: number }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <radialGradient id={`cfbg${u}`} cx="44%" cy="36%" r="62%">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        {/* Metallic gold — warm bright gold at top face, deep amber at bottom face */}
        <linearGradient id={`cfg${u}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#f8e060" />
          <stop offset="12%"  stopColor="#f0cc40" />
          <stop offset="32%"  stopColor="#e0a828" />
          <stop offset="58%"  stopColor="#b88020" />
          <stop offset="80%"  stopColor="#7a5010" />
          <stop offset="100%" stopColor="#3c2406" />
        </linearGradient>
        {/* Specular sheen — subtle warm highlight, not white-plastic */}
        <linearGradient id={`cfs${u}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fff8c0" stopOpacity="0.35" />
          <stop offset="18%"  stopColor="#fff0a0" stopOpacity="0.10" />
          <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Obsidian background */}
      <rect width="100" height="100" rx="22" fill={`url(#cfbg${u})`} />
      {/* Gold diagonal slash — 35° tilt, rx=4 for flat-plate corners not pill ends */}
      <g transform="rotate(-35, 50, 50)">
        <rect x="11" y="36" width="78" height="28" rx="4" fill={`url(#cfg${u})`} />
        <rect x="11" y="36" width="78" height="28" rx="4" fill={`url(#cfs${u})`} />
      </g>
    </svg>
  );
}

// Standalone slash mark — for use directly on dark surfaces (no background)
function CineFlowMark({ size = 64 }: { size?: number }) {
  const u = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`cmg${u}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#f8e060" />
          <stop offset="12%"  stopColor="#f0cc40" />
          <stop offset="32%"  stopColor="#e0a828" />
          <stop offset="58%"  stopColor="#b88020" />
          <stop offset="80%"  stopColor="#7a5010" />
          <stop offset="100%" stopColor="#3c2406" />
        </linearGradient>
        <linearGradient id={`cms${u}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#fff8c0" stopOpacity="0.35" />
          <stop offset="18%"  stopColor="#fff0a0" stopOpacity="0.10" />
          <stop offset="45%"  stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="rotate(-35, 50, 50)">
        <rect x="11" y="36" width="78" height="28" rx="4" fill={`url(#cmg${u})`} />
        <rect x="11" y="36" width="78" height="28" rx="4" fill={`url(#cms${u})`} />
      </g>
    </svg>
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
    <div className="space-y-12 p-4 md:p-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Brand</h1>
        <p className="text-sm text-zinc-500 mt-0.5">CineFlow brand system — logos, colors, type, assets</p>
      </div>

      {/* ── CineFlow Mark ──────────────────────────────────────────────────── */}
      <section>
        <div className="mb-5">
          <h2 className="text-base font-bold text-white">CineFlow Mark — Concept Preview</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Gold metallic diagonal slash on deep obsidian. The parallelogram references the editorial cut, forward motion, and the cinematic frame.
            This is an SVG concept — not yet applied to the live app.
          </p>
        </div>

        {/* App icon sizes */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-4">
          <div className="px-5 pt-5 pb-3">
            <p className="text-xs font-semibold text-zinc-300">App Icon</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Deep obsidian rounded square · primary export for App Store, web favicon, and social</p>
          </div>
          <div className="mx-5 mb-5 bg-[#080808] rounded-xl border border-white/[0.04] py-10 flex items-end justify-center gap-8 flex-wrap">
            {[192, 96, 64, 48, 32, 24, 16].map((sz) => (
              <div key={sz} className="flex flex-col items-center gap-2">
                <CineFlowIcon size={sz} />
                <span className="text-[9px] text-zinc-700">{sz}px</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wordmark + Social previews */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Horizontal wordmark lockup */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold text-zinc-300">Wordmark Lockup</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Icon + logotype horizontal — three size variants</p>
            </div>
            <div className="mx-5 mb-5 bg-[#080808] rounded-xl border border-white/[0.04] py-8 px-8 flex flex-col items-start gap-6">
              {[
                { iconSz: 44, textClass: "text-xl tracking-[0.12em]" },
                { iconSz: 30, textClass: "text-sm tracking-[0.12em]" },
                { iconSz: 20, textClass: "text-xs tracking-[0.12em]" },
              ].map(({ iconSz, textClass }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CineFlowIcon size={iconSz} />
                  <span className={`font-bold text-white ${textClass}`} style={{ fontFamily: "var(--font-syne)" }}>
                    CINEFLOW
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Social & profile previews */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold text-zinc-300">Social &amp; Profile</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Profile picture, square post, iOS home screen, favicon</p>
            </div>
            <div className="mx-5 mb-5 flex items-end gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 rounded-full bg-[#080808] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                  <CineFlowIcon size={60} />
                </div>
                <span className="text-[9px] text-zinc-700">Profile pic</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 rounded-xl bg-[#080808] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                  <CineFlowIcon size={64} />
                </div>
                <span className="text-[9px] text-zinc-700">IG / TikTok</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-2xl bg-[#080808] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                  <CineFlowIcon size={48} />
                </div>
                <span className="text-[9px] text-zinc-700">iOS Home</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded bg-[#080808] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                  <CineFlowIcon size={32} />
                </div>
                <span className="text-[9px] text-zinc-700">Favicon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mark standalone on dark + light backgrounds */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold text-zinc-300">Mark on Dark Surface</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Slash only — for in-app use on dark UI surfaces</p>
            </div>
            <div className="mx-5 mb-5 bg-[#0d0d0d] rounded-xl border border-white/[0.04] py-8 flex items-end justify-center gap-6">
              {[80, 56, 40, 28].map((sz) => (
                <div key={sz} className="flex flex-col items-center gap-2">
                  <CineFlowMark size={sz} />
                  <span className="text-[9px] text-zinc-700">{sz}px</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <p className="text-xs font-semibold text-zinc-300">Icon on Light Background</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">Always use the enclosed icon on white — never the bare slash</p>
            </div>
            <div className="mx-5 mb-5 bg-white rounded-xl py-8 flex items-end justify-center gap-6">
              {[96, 64, 48, 32].map((sz) => (
                <div key={sz} className="flex flex-col items-center gap-2">
                  <CineFlowIcon size={sz} />
                  <span className="text-[9px] text-zinc-500">{sz}px</span>
                </div>
              ))}
            </div>
          </div>
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
              CineFlow
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
