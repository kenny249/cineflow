"use client";

import React, { useState, useCallback } from "react";
import {
  X,
  Download,
  Loader2,
  Sun,
  Moon,
  Columns2,
  Columns3,
  Square,
  Check,
  ChevronDown,
  ChevronUp,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StoryboardFrame } from "@/types";
import type {
  PdfFont,
  PdfLayout,
  PdfTheme,
  StoryboardPdfSettings,
} from "@/lib/storyboard-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  frames: StoryboardFrame[];
  projectTitle: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FONTS: { id: PdfFont; label: string; style: string }[] = [
  { id: "inter", label: "Inter", style: "font-sans" },
  { id: "montserrat", label: "Montserrat", style: "font-sans font-bold" },
  { id: "playfair", label: "Playfair Display", style: "font-serif" },
  { id: "bebas", label: "Bebas Neue", style: "font-sans tracking-widest uppercase" },
  { id: "oswald", label: "Oswald", style: "font-sans" },
  { id: "dm_sans", label: "DM Sans", style: "font-sans" },
];

const ACCENT_PRESETS = [
  "#d4a853",
  "#e05a4e",
  "#6c8ebf",
  "#5ba85e",
  "#b86fbf",
  "#e0974a",
  "#4ac0c0",
  "#ffffff",
];

const DEFAULT_SETTINGS: StoryboardPdfSettings = {
  theme: "dark",
  font: "inter",
  layout: "2up",
  sections: {
    coverPage: true,
    frameImages: true,
    shotDetails: true,
    directorNotes: true,
    mood: true,
    frameNumbers: true,
  },
  branding: {
    agencyName: "",
    tagline: "A CineFlow Production",
    accentColor: "#d4a853",
    showPoweredBy: true,
  },
};

// ─── Live Preview ─────────────────────────────────────────────────────────────

function LivePreview({
  frames,
  settings,
  projectTitle,
}: {
  frames: StoryboardFrame[];
  settings: StoryboardPdfSettings;
  projectTitle: string;
}) {
  const { theme, font, layout, sections, branding } = settings;
  const accent = branding.accentColor;
  const isDark = theme === "dark";

  const bg = isDark ? "#0a0a0a" : "#ffffff";
  const surface = isDark ? "#141414" : "#f8f8f8";
  const border = isDark ? "#2a2a2a" : "#e5e5e5";
  const text = isDark ? "#f5f5f5" : "#0a0a0a";
  const sub = isDark ? "#888888" : "#666666";
  const placeholder = isDark ? "#1c1c1c" : "#efefef";

  const fontClass =
    font === "playfair"
      ? "font-serif"
      : font === "bebas"
      ? "font-sans tracking-widest"
      : "font-sans";

  const cols = layout === "1up" ? 1 : layout === "2up" ? 2 : 3;
  const previewFrames = frames.slice(0, cols === 1 ? 3 : cols === 2 ? 4 : 6);

  function formatShotType(t?: string) {
    if (!t) return "";
    return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function totalRuntime(frames: StoryboardFrame[]) {
    let seconds = 0;
    for (const f of frames) {
      if (!f.shot_duration) continue;
      const parts = f.shot_duration.split(":").map(Number);
      if (parts.length === 3) seconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
      else if (parts.length === 2) seconds += parts[0] * 60 + parts[1];
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  return (
    <div
      className={cn("rounded-xl overflow-hidden border", fontClass)}
      style={{ backgroundColor: bg, borderColor: border, minHeight: 480 }}
    >
      {/* Cover page preview (condensed) */}
      {sections.coverPage && (
        <div
          className="flex flex-col items-center justify-center py-10 px-8 text-center border-b"
          style={{ borderColor: border }}
        >
          {branding.agencyName && (
            <p
              className="text-[10px] tracking-[0.25em] uppercase mb-3 font-bold"
              style={{ color: sub }}
            >
              {branding.agencyName}
            </p>
          )}
          <h1
            className="text-2xl font-bold mb-3"
            style={{ color: text }}
          >
            {projectTitle}
          </h1>
          <div
            className="w-10 h-0.5 rounded-full mb-3"
            style={{ backgroundColor: accent }}
          />
          {branding.tagline && (
            <p className="text-sm mb-6" style={{ color: sub }}>
              {branding.tagline}
            </p>
          )}
          <div className="flex gap-8">
            {[
              { v: frames.length, l: "Frames" },
              { v: frames.filter((f) => f.image_url).length, l: "Images" },
              { v: totalRuntime(frames), l: "Runtime" },
            ].map((s) => (
              <div key={s.l} className="flex flex-col items-center gap-1">
                <span className="text-xl font-bold" style={{ color: accent }}>
                  {s.v}
                </span>
                <span
                  className="text-[9px] tracking-widest uppercase"
                  style={{ color: sub }}
                >
                  {s.l}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3 border-b"
        style={{ borderColor: border }}
      >
        <div>
          <p className="text-xs font-bold" style={{ color: text }}>
            {projectTitle}
          </p>
          <p
            className="text-[9px] tracking-widest uppercase"
            style={{ color: sub }}
          >
            {branding.agencyName
              ? `${branding.agencyName} · Storyboard`
              : "Storyboard"}
          </p>
        </div>
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </div>

      {/* Frame grid */}
      <div className="p-4">
        {previewFrames.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-center gap-2"
            style={{ color: sub }}
          >
            <p className="text-sm">No frames to preview</p>
            <p className="text-xs opacity-60">Add frames to your storyboard first</p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {previewFrames.map((frame, i) => (
              <div
                key={frame.id}
                className="rounded-lg overflow-hidden border"
                style={{ backgroundColor: surface, borderColor: border }}
              >
                {/* Image */}
                {sections.frameImages && (
                  <div className="aspect-video w-full relative overflow-hidden">
                    {frame.image_url ? (
                      <img
                        src={frame.image_url}
                        alt={frame.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: placeholder }}
                      >
                        <span
                          className="text-[9px] tracking-widest uppercase"
                          style={{ color: sub }}
                        >
                          No image
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-2.5 space-y-1.5">
                  {/* Title + number */}
                  <div className="flex items-center justify-between gap-2">
                    {frame.title && (
                      <p
                        className="text-[11px] font-semibold truncate"
                        style={{ color: text }}
                      >
                        {frame.title}
                      </p>
                    )}
                    {sections.frameNumbers && (
                      <span
                        className="text-[9px] font-bold shrink-0"
                        style={{ color: accent }}
                      >
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </div>

                  {/* Shot badge */}
                  {sections.shotDetails && frame.shot_type && (
                    <span
                      className="inline-block text-[8px] font-bold tracking-wide uppercase rounded px-1.5 py-0.5"
                      style={{
                        color: accent,
                        backgroundColor: accent + "22",
                      }}
                    >
                      {formatShotType(frame.shot_type)}
                    </span>
                  )}

                  {/* Description */}
                  {frame.description && (
                    <p
                      className="text-[9px] leading-relaxed line-clamp-2"
                      style={{ color: sub }}
                    >
                      {frame.description}
                    </p>
                  )}

                  {/* Meta chips */}
                  {sections.shotDetails &&
                    (frame.shot_duration || frame.camera_angle) && (
                      <div className="flex flex-wrap gap-1">
                        {frame.shot_duration && (
                          <span
                            className="text-[8px] rounded px-1.5 py-0.5"
                            style={{ backgroundColor: placeholder, color: sub }}
                          >
                            {frame.shot_duration}
                          </span>
                        )}
                        {frame.camera_angle && (
                          <span
                            className="text-[8px] rounded px-1.5 py-0.5"
                            style={{ backgroundColor: placeholder, color: sub }}
                          >
                            {frame.camera_angle}
                          </span>
                        )}
                      </div>
                    )}

                  {/* Mood */}
                  {sections.mood && frame.mood && (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span
                        className="text-[8px] italic"
                        style={{ color: sub }}
                      >
                        {frame.mood}
                      </span>
                    </div>
                  )}

                  {/* Notes */}
                  {sections.directorNotes && frame.notes && (
                    <div
                      className="rounded p-1.5 mt-1"
                      style={{
                        backgroundColor: placeholder,
                        borderLeft: `2px solid ${accent}`,
                      }}
                    >
                      <p
                        className="text-[7px] font-bold tracking-widest uppercase mb-0.5"
                        style={{ color: accent }}
                      >
                        Director&apos;s Note
                      </p>
                      <p
                        className="text-[8px] leading-relaxed"
                        style={{ color: sub }}
                      >
                        {frame.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-5 py-3 border-t"
        style={{ borderColor: border }}
      >
        <span className="text-[8px]" style={{ color: sub }}>
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        {branding.showPoweredBy && (
          <span
            className="text-[8px]"
            style={{ color: isDark ? "#2a2a2a" : "#d0d0d0" }}
          >
            Made with CineFlow
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Settings Section ─────────────────────────────────────────────────────────

function SettingsSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        {title}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-200",
          value ? "bg-[#d4a853]" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            value ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function StoryboardExportModal({
  open,
  onClose,
  frames,
  projectTitle,
}: Props) {
  const [settings, setSettings] =
    useState<StoryboardPdfSettings>(DEFAULT_SETTINGS);
  const [exporting, setExporting] = useState(false);

  const update = useCallback(
    (path: string, value: unknown) => {
      setSettings((prev) => {
        const next = { ...prev };
        const keys = path.split(".");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let obj: any = next;
        for (let i = 0; i < keys.length - 1; i++) {
          obj[keys[i]] = { ...obj[keys[i]] };
          obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        return next;
      });
    },
    []
  );

  const handleExport = async () => {
    if (frames.length === 0) {
      toast.error("Add at least one frame before exporting");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/storyboard/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, settings, projectTitle }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Export failed" }));
        throw new Error(error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectTitle
        .toLowerCase()
        .replace(/\s+/g, "-")}-storyboard.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF exported!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex w-full max-w-7xl flex-col bg-background shadow-2xl md:flex-row">
        {/* ── Settings panel ───────────────────────────────────────── */}
        <div className="flex w-full shrink-0 flex-col overflow-y-auto border-r border-border bg-card/50 md:w-80 lg:w-96">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-foreground">Export PDF</h2>
              <p className="text-xs text-muted-foreground">
                {frames.length} frame{frames.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Settings */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
            {/* Appearance */}
            <SettingsSection title="Appearance">
              {/* Theme */}
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Theme</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["dark", "light"] as PdfTheme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => update("theme", t)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all",
                        settings.theme === t
                          ? "border-[#d4a853] bg-[#d4a853]/10 text-[#d4a853]"
                          : "border-border text-muted-foreground hover:border-[#d4a853]/40"
                      )}
                    >
                      {t === "dark" ? (
                        <Moon className="h-3.5 w-3.5" />
                      ) : (
                        <Sun className="h-3.5 w-3.5" />
                      )}
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color */}
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Accent Color
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      onClick={() => update("branding.accentColor", c)}
                      className="relative h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor:
                          settings.branding.accentColor === c
                            ? "#fff"
                            : "transparent",
                        boxShadow:
                          settings.branding.accentColor === c
                            ? `0 0 0 1px ${c}`
                            : "none",
                      }}
                    >
                      {settings.branding.accentColor === c && (
                        <Check
                          className="absolute inset-0 m-auto h-3.5 w-3.5"
                          style={{ color: c === "#ffffff" ? "#000" : "#000" }}
                        />
                      )}
                    </button>
                  ))}
                  {/* Custom color */}
                  <label className="relative h-7 w-7 cursor-pointer">
                    <div
                      className="h-7 w-7 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-[#d4a853]/60 transition-colors"
                    >
                      <Palette className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      value={settings.branding.accentColor}
                      onChange={(e) =>
                        update("branding.accentColor", e.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
            </SettingsSection>

            {/* Font */}
            <SettingsSection title="Font">
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => update("font", f.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-all",
                      settings.font === f.id
                        ? "border-[#d4a853] bg-[#d4a853]/10"
                        : "border-border hover:border-[#d4a853]/40"
                    )}
                  >
                    <p
                      className={cn(
                        "text-sm truncate",
                        f.style,
                        settings.font === f.id
                          ? "text-[#d4a853]"
                          : "text-foreground"
                      )}
                    >
                      {f.label}
                    </p>
                  </button>
                ))}
              </div>
            </SettingsSection>

            {/* Layout */}
            <SettingsSection title="Layout">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "1up", icon: Square, label: "1 per row" },
                    { id: "2up", icon: Columns2, label: "2 per row" },
                    { id: "3up", icon: Columns3, label: "3 per row" },
                  ] as { id: PdfLayout; icon: React.ComponentType<{ className?: string }>; label: string }[]
                ).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => update("layout", id)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border py-3 text-xs transition-all",
                      settings.layout === id
                        ? "border-[#d4a853] bg-[#d4a853]/10 text-[#d4a853]"
                        : "border-border text-muted-foreground hover:border-[#d4a853]/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </SettingsSection>

            {/* Sections */}
            <SettingsSection title="Include">
              <Toggle
                label="Cover Page"
                value={settings.sections.coverPage}
                onChange={(v) => update("sections.coverPage", v)}
              />
              <Toggle
                label="Frame Images"
                value={settings.sections.frameImages}
                onChange={(v) => update("sections.frameImages", v)}
              />
              <Toggle
                label="Shot Details"
                value={settings.sections.shotDetails}
                onChange={(v) => update("sections.shotDetails", v)}
              />
              <Toggle
                label="Director's Notes"
                value={settings.sections.directorNotes}
                onChange={(v) => update("sections.directorNotes", v)}
              />
              <Toggle
                label="Mood"
                value={settings.sections.mood}
                onChange={(v) => update("sections.mood", v)}
              />
              <Toggle
                label="Frame Numbers"
                value={settings.sections.frameNumbers}
                onChange={(v) => update("sections.frameNumbers", v)}
              />
            </SettingsSection>

            {/* Branding */}
            <SettingsSection title="Branding">
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  Agency / Studio Name
                </label>
                <input
                  value={settings.branding.agencyName}
                  onChange={(e) => update("branding.agencyName", e.target.value)}
                  placeholder="e.g. Apex Films"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-muted-foreground">
                  Tagline
                </label>
                <input
                  value={settings.branding.tagline}
                  onChange={(e) => update("branding.tagline", e.target.value)}
                  placeholder="e.g. Visually storytelling"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#d4a853]/50 focus:outline-none"
                />
              </div>
              <Toggle
                label={`"Made with CineFlow" badge`}
                value={settings.branding.showPoweredBy}
                onChange={(v) => update("branding.showPoweredBy", v)}
              />
            </SettingsSection>
          </div>

          {/* Export button */}
          <div className="shrink-0 border-t border-border p-4">
            <button
              onClick={handleExport}
              disabled={exporting || frames.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition-all hover:bg-[#e0b55e] disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export PDF
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              A4 Landscape · High resolution
            </p>
          </div>
        </div>

        {/* ── Live preview panel ───────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border px-5 py-3">
            <p className="text-xs font-bold text-foreground">Live Preview</p>
            <p className="text-[10px] text-muted-foreground">
              Approximate representation of your PDF
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            <LivePreview
              frames={frames}
              settings={settings}
              projectTitle={projectTitle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
