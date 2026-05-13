"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data ──────────────────────────────────────────────────────────────────────

type Category = "social" | "video" | "broadcast";

interface PlatformSpec {
  platform: string;
  category: Category;
  tag?: string;
  resolution: string;
  frameRates: string;
  codec: string;
  videoBitrate: string;
  audioCodec: string;
  audioBitrate: string;
  lufs: string;
  truePeak: string;
  aspectRatio: string;
  maxFileSize: string;
  maxDuration?: string;
  notes?: string;
}

const SPECS: PlatformSpec[] = [
  {
    platform: "YouTube",
    category: "video",
    resolution: "3840×2160 (4K) / 1920×1080 (HD)",
    frameRates: "23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60",
    codec: "H.264, H.265, ProRes, DNxHR",
    videoBitrate: "35–68 Mbps (4K) · 8–12 Mbps (1080p)",
    audioCodec: "AAC-LC",
    audioBitrate: "384 kbps stereo",
    lufs: "−14 LUFS (integrated)",
    truePeak: "−1 dBTP",
    aspectRatio: "16:9 (primary) · 9:16 · 1:1 supported",
    maxFileSize: "256 GB",
    maxDuration: "12 hours",
    notes: "YouTube normalises to −14 LUFS. Upload in the highest quality available.",
  },
  {
    platform: "Vimeo",
    category: "video",
    resolution: "3840×2160 (4K) / 1920×1080 (HD)",
    frameRates: "Any standard frame rate",
    codec: "H.264, H.265, ProRes (recommended for upload)",
    videoBitrate: "No hard limit — higher is better",
    audioCodec: "AAC",
    audioBitrate: "320 kbps",
    lufs: "−23 LUFS (EBU R128) / −14 LUFS",
    truePeak: "−1 dBTP",
    aspectRatio: "Any — 16:9, 4:3, 1:1, 9:16",
    maxFileSize: "No limit (Pro+)",
    notes: "Upload ProRes or high-bitrate H.264. Vimeo re-encodes; start quality matters.",
  },
  {
    platform: "Instagram Feed",
    category: "social",
    resolution: "1080×1080 (1:1) · 1080×1350 (4:5) · 1080×608 (16:9)",
    frameRates: "23–60 fps (29.97 or 30 recommended)",
    codec: "H.264",
    videoBitrate: "3.5 Mbps max",
    audioCodec: "AAC",
    audioBitrate: "128 kbps",
    lufs: "−14 LUFS",
    truePeak: "−1 dBTP",
    aspectRatio: "1:1 · 4:5 (best for feed) · 16:9",
    maxFileSize: "4 GB",
    maxDuration: "60 min (feed) · 60 sec (grid preview)",
    notes: "4:5 portrait maximises screen real estate in feed.",
  },
  {
    platform: "Instagram Reels",
    category: "social",
    resolution: "1080×1920 (9:16)",
    frameRates: "29.97 or 30 fps recommended",
    codec: "H.264",
    videoBitrate: "3.5 Mbps max",
    audioCodec: "AAC",
    audioBitrate: "128 kbps",
    lufs: "−14 LUFS",
    truePeak: "−1 dBTP",
    aspectRatio: "9:16 (full screen)",
    maxFileSize: "4 GB",
    maxDuration: "90 seconds",
    notes: "Keep key content between safe zones — top/bottom 14% may be cropped by UI.",
  },
  {
    platform: "TikTok",
    category: "social",
    resolution: "1080×1920 (9:16) preferred · 1080×1080 (1:1)",
    frameRates: "24–60 fps (30 or 60 recommended)",
    codec: "H.264 or H.265",
    videoBitrate: "2.5 Mbps+ (no hard cap)",
    audioCodec: "AAC",
    audioBitrate: "128 kbps",
    lufs: "−14 LUFS (normalised on playback)",
    truePeak: "−1 dBTP",
    aspectRatio: "9:16 (full screen vertical)",
    maxFileSize: "4 GB (desktop) · 287 MB (mobile)",
    maxDuration: "60 min",
    notes: "TikTok dynamically normalises audio. Upload at −14 LUFS to avoid pumping.",
  },
  {
    platform: "Facebook Feed",
    category: "social",
    resolution: "1280×720 minimum · 1920×1080 recommended",
    frameRates: "Up to 60 fps",
    codec: "H.264",
    videoBitrate: "4 Mbps max",
    audioCodec: "AAC",
    audioBitrate: "128 kbps stereo",
    lufs: "−14 LUFS",
    truePeak: "−1 dBTP",
    aspectRatio: "16:9 · 9:16 · 1:1 · 2:3 · 4:5",
    maxFileSize: "10 GB",
    maxDuration: "240 min",
  },
  {
    platform: "Twitter / X",
    category: "social",
    resolution: "1920×1080 (16:9) · 1200×1200 (1:1)",
    frameRates: "Up to 60 fps",
    codec: "H.264",
    videoBitrate: "25 Mbps max",
    audioCodec: "AAC",
    audioBitrate: "128 kbps",
    lufs: "−14 LUFS",
    truePeak: "−1 dBTP",
    aspectRatio: "16:9 · 1:1",
    maxFileSize: "512 MB",
    maxDuration: "2 min 20 sec",
    notes: "Twitter is stricter on file size. Compress well — 25 Mbps is the ceiling.",
  },
  {
    platform: "Broadcast HD",
    category: "broadcast",
    tag: "HD 1080i/p",
    resolution: "1920×1080i (50/59.94) · 1920×1080p (24/25/29.97)",
    frameRates: "23.976, 25, 29.97, 50i, 59.94i",
    codec: "XDCAM HD422, DNxHD, ProRes 422 HQ",
    videoBitrate: "50 Mbps (HD422) · 180 Mbps (ProRes HQ)",
    audioCodec: "PCM / AES3",
    audioBitrate: "24-bit 48 kHz",
    lufs: "−23 LUFS (EBU R128) · −24 LKFS (ATSC A/85)",
    truePeak: "−3 dBTP (EU) · −2 dBTP (US)",
    aspectRatio: "16:9",
    maxFileSize: "Delivery format dependent (MXF / MOV)",
    notes: "Always verify with broadcaster — specs vary by territory and network.",
  },
  {
    platform: "Broadcast 4K HDR",
    category: "broadcast",
    tag: "UHD / HDR",
    resolution: "3840×2160 (UHD-1) · 4096×2160 (DCI 4K)",
    frameRates: "23.976, 25, 29.97, 50, 59.94",
    codec: "XAVC, ProRes 4444 XQ, DNxHR HQX",
    videoBitrate: "200–600 Mbps depending on codec",
    audioCodec: "PCM 24-bit 48 kHz",
    audioBitrate: "24-bit 48 kHz",
    lufs: "−23 LUFS (EBU R128)",
    truePeak: "−3 dBTP",
    aspectRatio: "16:9 · 17:9 (DCI)",
    maxFileSize: "Delivery format dependent",
    notes: "Confirm HDR standard: HDR10, HLG, or Dolby Vision. Each has different mastering requirements.",
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  social: "Social",
  video: "Video Platforms",
  broadcast: "Broadcast",
};

const CATEGORY_COLORS: Record<Category, string> = {
  social: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  video: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  broadcast: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

// ── Spec row ──────────────────────────────────────────────────────────────────

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-foreground/80 leading-relaxed">{value}</span>
    </div>
  );
}

// ── Platform card ─────────────────────────────────────────────────────────────

function PlatformCard({ spec }: { spec: PlatformSpec }) {
  const [open, setOpen] = useState(false);
  const catClass = CATEGORY_COLORS[spec.category];

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden transition-all duration-200",
      open ? "border-border" : "border-border hover:border-border/80"
    )}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{spec.platform}</p>
            {spec.tag && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border border-border/40 rounded px-1.5 py-0.5">{spec.tag}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border", catClass)}>
              {CATEGORY_LABELS[spec.category]}
            </span>
            <span className="text-[10px] text-muted-foreground/50">{spec.resolution.split("(")[0].trim()}</span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[10px] font-mono text-[#d4a853]/70">{spec.lufs}</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/40">
          <div className="mt-3">
            <SpecRow label="Resolution"    value={spec.resolution} />
            <SpecRow label="Frame Rates"   value={spec.frameRates} />
            <SpecRow label="Codec"         value={spec.codec} />
            <SpecRow label="Video Bitrate" value={spec.videoBitrate} />
            <SpecRow label="Audio Codec"   value={spec.audioCodec} />
            <SpecRow label="Audio Bitrate" value={spec.audioBitrate} />
            <SpecRow label="Loudness"      value={spec.lufs} />
            <SpecRow label="True Peak"     value={spec.truePeak} />
            <SpecRow label="Aspect Ratio"  value={spec.aspectRatio} />
            <SpecRow label="Max File Size" value={spec.maxFileSize} />
            {spec.maxDuration && <SpecRow label="Max Duration" value={spec.maxDuration} />}
          </div>
          {spec.notes && (
            <p className="mt-3 text-[11px] text-amber-400/70 bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-2 leading-relaxed">
              {spec.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DeliverySpecs() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");

  const filtered = SPECS.filter((s) => {
    const matchesCat = cat === "all" || s.category === cat;
    const q = search.toLowerCase();
    const matchesSearch = !q || s.platform.toLowerCase().includes(q) ||
      s.resolution.toLowerCase().includes(q) || s.codec.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platform, codec, resolution…"
            className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 transition-colors"
          />
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-muted/30">
          {(["all", "social", "video", "broadcast"] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                cat === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c === "all" ? "All" : CATEGORY_LABELS[c as Category]}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground/50">No platforms match your search.</p>
          </div>
        ) : (
          filtered.map((s) => <PlatformCard key={s.platform} spec={s} />)
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/30 text-center">
        Specs are guidelines. Always verify with your broadcaster or client before final delivery.
      </p>
    </div>
  );
}
