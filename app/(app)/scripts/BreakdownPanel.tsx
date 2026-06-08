"use client";

import { useState, useCallback } from "react";
import {
  X, Sparkles, Loader2, Film, Users, MapPin, Package,
  Wrench, Zap, AlertTriangle, Copy, Check, ChevronDown,
  ChevronRight, Calendar, Clock, Star, Clapperboard,
  Download, CheckSquare, Square, ArrowRight, FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ProjectFile } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SceneBreakdown {
  number: number;
  heading: string;
  interior: boolean;
  location: string;
  timeOfDay: string;
  characters: string[];
  action: string;
  props: string[];
  specialNotes?: string | null;
}

interface CharacterBreakdown {
  name: string;
  description: string;
  sceneCount: number;
  scenes: number[];
  isLead: boolean;
  estimatedScreenTime: string;
}

interface LocationBreakdown {
  name: string;
  interior: boolean | null;
  sceneCount: number;
  scenes: number[];
  notes?: string | null;
}

interface VFXItem { scene: number; description: string; }
interface StuntItem { scene: number; description: string; }

interface BreakdownResult {
  title: string;
  logline: string;
  genre: string;
  format: string;
  totalPages?: number | null;
  estimatedShootDays: number;
  productionComplexity: string;
  synopsis: string;
  scenes: SceneBreakdown[];
  characters: CharacterBreakdown[];
  locations: LocationBreakdown[];
  props: string[];
  wardrobe: string[];
  specialEquipment: string[];
  vfx: VFXItem[];
  stunts: StuntItem[];
  productionNotes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPLEXITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low:       { label: "Low",       color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  medium:    { label: "Medium",    color: "text-[#d4a853]",   bg: "bg-[#d4a853]/10 border-[#d4a853]/20" },
  high:      { label: "High",      color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/20" },
  very_high: { label: "Very High", color: "text-red-400",     bg: "bg-red-400/10 border-red-400/20" },
};

const SCREEN_TIME_CONFIG: Record<string, { label: string; color: string }> = {
  lead:        { label: "Lead",        color: "text-[#d4a853]" },
  supporting:  { label: "Supporting",  color: "text-blue-400" },
  "day player":{ label: "Day Player",  color: "text-zinc-400" },
  background:  { label: "Background",  color: "text-zinc-600" },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function Section({ icon, title, count, children, defaultOpen = true }: {
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="text-[#d4a853]">{icon}</span>
        <span className="font-semibold text-zinc-200">{title}</span>
        {count !== undefined && (
          <span className="ml-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">{count}</span>
        )}
        <span className="ml-auto text-zinc-600">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "scenes" | "characters" | "locations" | "production" | "import";

const TABS: { id: Tab; label: string; icon: React.ReactNode; projectOnly?: boolean }[] = [
  { id: "overview",    label: "Overview",    icon: <Film className="h-3.5 w-3.5" /> },
  { id: "scenes",      label: "Scenes",      icon: <Clapperboard className="h-3.5 w-3.5" /> },
  { id: "characters",  label: "Characters",  icon: <Users className="h-3.5 w-3.5" /> },
  { id: "locations",   label: "Locations",   icon: <MapPin className="h-3.5 w-3.5" /> },
  { id: "production",  label: "Production",  icon: <Package className="h-3.5 w-3.5" /> },
  { id: "import",      label: "Import",      icon: <Download className="h-3.5 w-3.5" />, projectOnly: true },
];

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({
  result,
  projectId,
  projectTitle,
  scriptTitle,
}: {
  result: BreakdownResult;
  projectId: string;
  projectTitle?: string;
  scriptTitle: string;
}) {
  const supabase = createClient();

  // Locations
  const [selectedLocations, setSelectedLocations] = useState<Set<number>>(
    new Set(result.locations.map((_, i) => i))
  );
  const [importingLocations, setImportingLocations] = useState(false);
  const [locationsImported, setLocationsImported] = useState(false);

  // Shot list
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(
    new Set(result.scenes.map((_, i) => i))
  );
  const [importingShots, setImportingShots] = useState(false);
  const [shotsImported, setShotsImported] = useState(false);

  // Tasks
  const suggestedTasks = [
    ...result.locations.map((l) => ({ title: `Scout location: ${l.name}`, type: "pre_production" as const })),
    ...result.locations.filter((l) => !l.interior).map((l) => ({ title: `Secure permits: ${l.name}`, type: "pre_production" as const })),
    ...result.characters.filter((c) => c.isLead).map((c) => ({ title: `Casting: ${c.name}`, type: "pre_production" as const })),
    ...(result.vfx.length > 0 ? [{ title: `VFX pre-vis: ${result.vfx.length} shots`, type: "production" as const }] : []),
    ...(result.stunts.length > 0 ? [{ title: `Stunt coordinator review`, type: "pre_production" as const }] : []),
    ...(result.specialEquipment.length > 0 ? [{ title: `Equipment rental: ${result.specialEquipment.slice(0, 2).join(", ")}`, type: "pre_production" as const }] : []),
    { title: `Production schedule: ${result.estimatedShootDays} shoot days`, type: "pre_production" as const },
  ];
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(
    new Set(suggestedTasks.map((_, i) => i))
  );
  const [importingTasks, setImportingTasks] = useState(false);
  const [tasksImported, setTasksImported] = useState(false);

  function toggleAll(set: Set<number>, length: number, setter: (s: Set<number>) => void) {
    if (set.size === length) {
      setter(new Set());
    } else {
      setter(new Set(Array.from({ length }, (_, i) => i)));
    }
  }

  async function importLocations() {
    setImportingLocations(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const rows = result.locations
        .filter((_, i) => selectedLocations.has(i))
        .map((loc, i) => ({
          project_id: projectId,
          name: loc.name,
          notes: [
            loc.interior === null ? "INT & EXT" : loc.interior ? "Interior" : "Exterior",
            `${loc.sceneCount} scene${loc.sceneCount !== 1 ? "s" : ""}`,
            loc.notes ?? null,
          ].filter(Boolean).join(" · "),
          sort_order: i,
          created_by: user.id,
        }));
      const { error } = await supabase.from("project_locations").insert(rows);
      if (error) throw error;
      setLocationsImported(true);
      toast.success(`${rows.length} location${rows.length !== 1 ? "s" : ""} added to project`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import locations");
    } finally {
      setImportingLocations(false);
    }
  }

  async function importShotList() {
    setImportingShots(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the shot list
      const { data: list, error: listErr } = await supabase
        .from("shot_lists")
        .insert({
          project_id: projectId,
          title: `${scriptTitle} — Scene Breakdown`,
          description: `Auto-generated from AI script breakdown · ${result.scenes.length} scenes`,
          created_by: user.id,
        })
        .select()
        .single();
      if (listErr || !list) throw listErr ?? new Error("Failed to create shot list");

      const scenes = result.scenes.filter((_, i) => selectedScenes.has(i));
      const items = scenes.map((scene, i) => ({
        shot_list_id: list.id,
        shot_number: i + 1,
        scene: String(scene.number),
        location: scene.location,
        description: scene.action,
        shot_type: "wide" as const,
        camera_movement: "static" as const,
        notes: [
          scene.characters.length > 0 ? `Cast: ${scene.characters.join(", ")}` : null,
          scene.props.length > 0 ? `Props: ${scene.props.join(", ")}` : null,
          scene.specialNotes ?? null,
        ].filter(Boolean).join(" | ") || null,
        props: scene.props.length > 0 ? scene.props : null,
        actors: scene.characters.length > 0 ? scene.characters : null,
        is_complete: false,
        created_by: user.id,
      }));

      const { error: itemsErr } = await supabase.from("shot_list_items").insert(items);
      if (itemsErr) throw itemsErr;

      setShotsImported(true);
      toast.success(`Shot list created with ${scenes.length} scenes`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create shot list");
    } finally {
      setImportingShots(false);
    }
  }

  async function importTasks() {
    setImportingTasks(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const rows = suggestedTasks
        .filter((_, i) => selectedTasks.has(i))
        .map((t) => ({
          project_id: projectId,
          title: t.title,
          type: t.type,
          priority: "medium" as const,
          status: "todo" as const,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        }));
      const { error } = await supabase.from("project_tasks").insert(rows);
      if (error) throw error;
      setTasksImported(true);
      toast.success(`${rows.length} task${rows.length !== 1 ? "s" : ""} added to project`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import tasks");
    } finally {
      setImportingTasks(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Import to project</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Push breakdown data directly into{" "}
              <span className="font-medium text-zinc-300">{projectTitle ?? "your project"}</span>.
              Select what you want to import, then click the import button for each section.
            </p>
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <MapPin className="h-4 w-4 text-[#d4a853]" />
          <span className="font-semibold text-zinc-200 text-sm">Locations</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">{result.locations.length}</span>
          <button
            onClick={() => toggleAll(selectedLocations, result.locations.length, setSelectedLocations)}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {selectedLocations.size === result.locations.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="px-5 py-3 space-y-2">
          {result.locations.map((loc, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
              <button
                onClick={() => {
                  const next = new Set(selectedLocations);
                  next.has(i) ? next.delete(i) : next.add(i);
                  setSelectedLocations(next);
                }}
                className="shrink-0 text-[#d4a853]"
              >
                {selectedLocations.has(i)
                  ? <CheckSquare className="h-4 w-4" />
                  : <Square className="h-4 w-4 text-zinc-600" />
                }
              </button>
              <div className="min-w-0 flex-1">
                <span className="text-sm text-zinc-300">{loc.name}</span>
                <span className="ml-2 text-xs text-zinc-600">
                  {loc.interior === null ? "INT & EXT" : loc.interior ? "INT" : "EXT"} · {loc.sceneCount} scenes
                </span>
              </div>
            </label>
          ))}
        </div>
        <div className="border-t border-white/[0.06] px-5 py-3">
          <button
            onClick={importLocations}
            disabled={importingLocations || locationsImported || selectedLocations.size === 0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              locationsImported
                ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                : selectedLocations.size === 0
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-[#d4a853] text-black hover:bg-[#c49843]"
            )}
          >
            {locationsImported ? (
              <><Check className="h-4 w-4" /> Imported</>
            ) : importingLocations ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
            ) : (
              <><ArrowRight className="h-4 w-4" /> Add {selectedLocations.size} location{selectedLocations.size !== 1 ? "s" : ""} to project</>
            )}
          </button>
        </div>
      </div>

      {/* Shot List from Scenes */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <Clapperboard className="h-4 w-4 text-[#d4a853]" />
          <span className="font-semibold text-zinc-200 text-sm">Create Shot List from Scenes</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">{result.scenes.length} scenes</span>
          <button
            onClick={() => toggleAll(selectedScenes, result.scenes.length, setSelectedScenes)}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {selectedScenes.size === result.scenes.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="px-5 py-3 space-y-1 max-h-48 overflow-y-auto">
          {result.scenes.map((scene, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
              <button
                onClick={() => {
                  const next = new Set(selectedScenes);
                  next.has(i) ? next.delete(i) : next.add(i);
                  setSelectedScenes(next);
                }}
                className="shrink-0 text-[#d4a853]"
              >
                {selectedScenes.has(i)
                  ? <CheckSquare className="h-4 w-4" />
                  : <Square className="h-4 w-4 text-zinc-600" />
                }
              </button>
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-zinc-400">Sc.{scene.number}</span>
                <span className="ml-2 text-sm text-zinc-300 truncate">{scene.heading}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="border-t border-white/[0.06] px-5 py-3">
          <p className="mb-2 text-xs text-zinc-600">Creates a new shot list with each scene as a shot entry, pre-filled with location, cast, and props.</p>
          <button
            onClick={importShotList}
            disabled={importingShots || shotsImported || selectedScenes.size === 0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              shotsImported
                ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                : selectedScenes.size === 0
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-[#d4a853] text-black hover:bg-[#c49843]"
            )}
          >
            {shotsImported ? (
              <><Check className="h-4 w-4" /> Shot list created</>
            ) : importingShots ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <><ArrowRight className="h-4 w-4" /> Create shot list ({selectedScenes.size} scenes)</>
            )}
          </button>
        </div>
      </div>

      {/* Pre-production Tasks */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <CheckSquare className="h-4 w-4 text-[#d4a853]" />
          <span className="font-semibold text-zinc-200 text-sm">Pre-production Tasks</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">{suggestedTasks.length}</span>
          <button
            onClick={() => toggleAll(selectedTasks, suggestedTasks.length, setSelectedTasks)}
            className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {selectedTasks.size === suggestedTasks.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <div className="px-5 py-3 space-y-1">
          {suggestedTasks.map((task, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
              <button
                onClick={() => {
                  const next = new Set(selectedTasks);
                  next.has(i) ? next.delete(i) : next.add(i);
                  setSelectedTasks(next);
                }}
                className="shrink-0 text-[#d4a853]"
              >
                {selectedTasks.has(i)
                  ? <CheckSquare className="h-4 w-4" />
                  : <Square className="h-4 w-4 text-zinc-600" />
                }
              </button>
              <div className="min-w-0 flex-1">
                <span className="text-sm text-zinc-300">{task.title}</span>
                <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-600">{task.type.replace("_", " ")}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="border-t border-white/[0.06] px-5 py-3">
          <button
            onClick={importTasks}
            disabled={importingTasks || tasksImported || selectedTasks.size === 0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all",
              tasksImported
                ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                : selectedTasks.size === 0
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-[#d4a853] text-black hover:bg-[#c49843]"
            )}
          >
            {tasksImported ? (
              <><Check className="h-4 w-4" /> Tasks added</>
            ) : importingTasks ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
            ) : (
              <><ArrowRight className="h-4 w-4" /> Add {selectedTasks.size} task{selectedTasks.size !== 1 ? "s" : ""} to project</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function BreakdownPanel({
  file,
  onClose,
  initialContent,
}: {
  file: ProjectFile & { projectTitle?: string; projectId?: string };
  onClose: () => void;
  initialContent?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BreakdownResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  async function runBreakdown() {
    setLoading(true);
    setError(null);
    try {
      // Use initialContent if provided (e.g. from in-memory editor), otherwise fetch from URL
      let content: string;
      if (initialContent) {
        content = initialContent;
      } else {
        if (!file.public_url) throw new Error("No file URL available");
        const fileRes = await fetch(file.public_url, { cache: "no-store" });
        if (!fileRes.ok) throw new Error("Could not load script file");
        content = await fileRes.text();
      }

      const res = await fetch("/api/scripts/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, filename: file.name }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Breakdown failed");
      }
      const data = await res.json();
      setResult(data);
      setTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function buildCopyText(): string {
    if (!result) return "";
    const lines: string[] = [
      `SCRIPT BREAKDOWN: ${result.title}`,
      `${"=".repeat(50)}`,
      ``,
      `OVERVIEW`,
      `Genre: ${result.genre}`,
      `Format: ${result.format}`,
      `Estimated Shoot Days: ${result.estimatedShootDays}`,
      `Production Complexity: ${result.productionComplexity.replace("_", " ").toUpperCase()}`,
      ``,
      `LOGLINE`,
      result.logline,
      ``,
      `SYNOPSIS`,
      result.synopsis,
      ``,
      `SCENES (${result.scenes.length} total)`,
      ...result.scenes.map((s) =>
        `  ${s.number}. ${s.heading} — ${s.characters.join(", ") || "No characters"}`
      ),
      ``,
      `CHARACTERS (${result.characters.length})`,
      ...result.characters.map((c) =>
        `  ${c.name} — ${c.estimatedScreenTime} (${c.sceneCount} scenes)`
      ),
      ``,
      `LOCATIONS (${result.locations.length})`,
      ...result.locations.map((l) =>
        `  ${l.interior === null ? "INT/EXT" : l.interior ? "INT" : "EXT"} ${l.name} — ${l.sceneCount} scenes`
      ),
      ``,
      `PROPS`,
      ...(result.props.length ? result.props.map((p) => `  • ${p}`) : ["  None noted"]),
      ``,
      `SPECIAL EQUIPMENT`,
      ...(result.specialEquipment.length ? result.specialEquipment.map((e) => `  • ${e}`) : ["  None noted"]),
      ``,
      `VFX SHOTS (${result.vfx.length})`,
      ...(result.vfx.length ? result.vfx.map((v) => `  Scene ${v.scene}: ${v.description}`) : ["  None"]),
      ``,
      `PRODUCTION NOTES`,
      result.productionNotes,
    ];
    return lines.join("\n");
  }

  const complexity = result ? (COMPLEXITY_CONFIG[result.productionComplexity] ?? COMPLEXITY_CONFIG.medium) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto flex h-full w-full max-w-3xl flex-col bg-[#0b0b0b] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-4 border-b border-white/[0.06] px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4a853]/10">
            <Sparkles className="h-4.5 w-4.5 text-[#d4a853]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{file.name}</p>
            {file.projectTitle && (
              <p className="text-xs text-zinc-500">{file.projectTitle}</p>
            )}
          </div>
          {result && <CopyButton text={buildCopyText()} />}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!result && !loading && !error && (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/5">
                <Sparkles className="h-9 w-9 text-[#d4a853]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">AI Script Breakdown</h2>
                <p className="mt-2 max-w-sm text-sm text-zinc-400 leading-relaxed">
                  Claude will analyze your script and extract every scene, character, location, prop, and production requirement — the full breakdown a line producer would create by hand.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-xs text-zinc-600">
                <p>Works best with Fountain (.fountain) and plain text (.txt) files</p>
                <p>Final Draft (.fdx) and PDF files may not extract correctly</p>
              </div>
              <button
                onClick={runBreakdown}
                className="flex items-center gap-2.5 rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#d4a853]/20 transition-all hover:bg-[#c49843] hover:shadow-[#d4a853]/30 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                Generate Breakdown
              </button>
            </div>
          )}

          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-5 p-8">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/5">
                  <Sparkles className="h-9 w-9 text-[#d4a853]" />
                </div>
                <Loader2 className="absolute -right-2 -top-2 h-6 w-6 animate-spin text-[#d4a853]" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white">Analyzing script…</p>
                <p className="mt-1 text-sm text-zinc-500">Reading scenes, characters, locations, and production elements</p>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-zinc-700">
                {["Parsing scene headings", "Extracting characters", "Identifying locations", "Cataloging props & equipment", "Estimating shoot days"].map((s, i) => (
                  <p key={i} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-[#d4a853]/40" />
                    {s}
                  </p>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-red-400" />
              <div>
                <p className="font-semibold text-white">Breakdown failed</p>
                <p className="mt-1 text-sm text-zinc-400">{error}</p>
              </div>
              <button
                onClick={runBreakdown}
                className="rounded-lg bg-white/[0.06] px-5 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.1]"
              >
                Try again
              </button>
            </div>
          )}

          {result && (
            <div className="flex flex-col">
              {/* Tabs */}
              <div className="sticky top-0 z-10 flex gap-1 border-b border-white/[0.06] bg-[#0b0b0b] px-6 py-2 overflow-x-auto">
                {TABS.filter((t) => !t.projectOnly || file.projectId).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                      tab === t.id
                        ? "bg-[#d4a853]/10 text-[#d4a853]"
                        : t.id === "import"
                        ? "text-emerald-400 hover:text-emerald-300 bg-emerald-400/5"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {t.icon}
                    {t.label}
                    {t.id === "import" && (
                      <span className="ml-0.5 flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4">

                {/* OVERVIEW TAB */}
                {tab === "overview" && (
                  <>
                    {/* Hero stats */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Scenes", value: result.scenes.length, icon: <Clapperboard className="h-4 w-4" /> },
                        { label: "Characters", value: result.characters.length, icon: <Users className="h-4 w-4" /> },
                        { label: "Locations", value: result.locations.length, icon: <MapPin className="h-4 w-4" /> },
                        { label: "Shoot Days", value: result.estimatedShootDays, icon: <Calendar className="h-4 w-4" /> },
                      ].map(({ label, value, icon }) => (
                        <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                          <div className="mb-1 flex justify-center text-[#d4a853]/60">{icon}</div>
                          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                          <p className="text-xs text-zinc-500">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Title + meta */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                      <h2 className="text-lg font-bold text-white">{result.title}</h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill className="border-zinc-700 text-zinc-400">{result.genre}</Pill>
                        <Pill className="border-zinc-700 text-zinc-400">{result.format}</Pill>
                        {result.totalPages && (
                          <Pill className="border-zinc-700 text-zinc-400">{result.totalPages} pages</Pill>
                        )}
                        {complexity && (
                          <Pill className={complexity.bg}>
                            <span className={complexity.color}>{complexity.label} complexity</span>
                          </Pill>
                        )}
                      </div>
                      <p className="mt-4 text-sm font-medium italic text-zinc-300 leading-relaxed">
                        &ldquo;{result.logline}&rdquo;
                      </p>
                      <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{result.synopsis}</p>
                    </div>

                    {/* Production notes */}
                    {result.productionNotes && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <p className="text-sm font-semibold text-amber-300">Production Notes</p>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{result.productionNotes}</p>
                      </div>
                    )}

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Int vs Ext</p>
                        {(() => {
                          const intCount = result.scenes.filter((s) => s.interior).length;
                          const extCount = result.scenes.length - intCount;
                          return (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Interior</span>
                                <span className="font-bold text-white">{intCount}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Exterior</span>
                                <span className="font-bold text-white">{extCount}</span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Day vs Night</p>
                        {(() => {
                          const dayCount = result.scenes.filter((s) => ["DAY","DAWN","DUSK"].includes(s.timeOfDay?.toUpperCase())).length;
                          const nightCount = result.scenes.filter((s) => s.timeOfDay?.toUpperCase() === "NIGHT").length;
                          const other = result.scenes.length - dayCount - nightCount;
                          return (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Day</span>
                                <span className="font-bold text-white">{dayCount}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-sm">
                                <span className="text-zinc-400">Night</span>
                                <span className="font-bold text-white">{nightCount}</span>
                              </div>
                              {other > 0 && (
                                <div className="mt-1 flex items-center justify-between text-sm">
                                  <span className="text-zinc-400">Other</span>
                                  <span className="font-bold text-white">{other}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                )}

                {/* SCENES TAB */}
                {tab === "scenes" && (
                  <div className="space-y-2">
                    {result.scenes.map((scene) => (
                      <div key={scene.number} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-zinc-400 tabular-nums">
                            {scene.number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-xs font-semibold text-[#d4a853]">{scene.heading}</p>
                            <p className="mt-1 text-sm text-zinc-300 leading-relaxed">{scene.action}</p>
                            {scene.characters.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {scene.characters.map((c) => (
                                  <span key={c} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase tracking-wide">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                            {scene.props.length > 0 && (
                              <p className="mt-1.5 text-[11px] text-zinc-600">
                                Props: {scene.props.join(", ")}
                              </p>
                            )}
                            {scene.specialNotes && (
                              <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                                <p className="text-[11px] text-amber-300">{scene.specialNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* CHARACTERS TAB */}
                {tab === "characters" && (
                  <div className="space-y-3">
                    {result.characters
                      .sort((a, b) => b.sceneCount - a.sceneCount)
                      .map((char) => {
                        const st = SCREEN_TIME_CONFIG[char.estimatedScreenTime] ?? SCREEN_TIME_CONFIG.background;
                        return (
                          <div key={char.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
                                  {char.name.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-white uppercase tracking-wide text-sm">{char.name}</p>
                                    {char.isLead && <Star className="h-3.5 w-3.5 text-[#d4a853] fill-[#d4a853]" />}
                                  </div>
                                  <p className="text-xs text-zinc-500 mt-0.5">{char.description}</p>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className={cn("text-xs font-semibold", st.color)}>{st.label}</p>
                                <p className="text-xs text-zinc-500 tabular-nums">{char.sceneCount} scenes</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {char.scenes.map((n) => (
                                <span key={n} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 tabular-nums">
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* LOCATIONS TAB */}
                {tab === "locations" && (
                  <div className="space-y-3">
                    {result.locations
                      .sort((a, b) => b.sceneCount - a.sceneCount)
                      .map((loc) => (
                        <div key={loc.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800">
                                <MapPin className="h-4 w-4 text-zinc-400" />
                              </div>
                              <div>
                                <p className="font-semibold text-white">{loc.name}</p>
                                <p className="text-xs text-zinc-500">
                                  {loc.interior === null ? "INT & EXT" : loc.interior ? "Interior" : "Exterior"}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-bold text-white tabular-nums">{loc.sceneCount}</p>
                              <p className="text-xs text-zinc-500">scenes</p>
                            </div>
                          </div>
                          {loc.notes && (
                            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">{loc.notes}</p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-1">
                            {loc.scenes.map((n) => (
                              <span key={n} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400 tabular-nums">
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* PRODUCTION TAB */}
                {tab === "production" && (
                  <div className="space-y-4">
                    <Section icon={<Package className="h-4 w-4" />} title="Props" count={result.props.length}>
                      {result.props.length === 0 ? (
                        <p className="text-sm text-zinc-600">None noted in script.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {result.props.map((p) => (
                            <span key={p} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </Section>

                    <Section icon={<Wrench className="h-4 w-4" />} title="Special Equipment" count={result.specialEquipment.length} defaultOpen={false}>
                      {result.specialEquipment.length === 0 ? (
                        <p className="text-sm text-zinc-600">No special equipment required.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {result.specialEquipment.map((e) => (
                            <span key={e} className="rounded-lg border border-blue-500/20 bg-blue-500/8 px-3 py-1.5 text-xs text-blue-300">
                              {e}
                            </span>
                          ))}
                        </div>
                      )}
                    </Section>

                    {result.wardrobe.length > 0 && (
                      <Section icon={<Star className="h-4 w-4" />} title="Key Wardrobe" count={result.wardrobe.length} defaultOpen={false}>
                        <div className="flex flex-wrap gap-2">
                          {result.wardrobe.map((w) => (
                            <span key={w} className="rounded-lg border border-purple-500/20 bg-purple-500/8 px-3 py-1.5 text-xs text-purple-300">
                              {w}
                            </span>
                          ))}
                        </div>
                      </Section>
                    )}

                    {result.vfx.length > 0 && (
                      <Section icon={<Zap className="h-4 w-4" />} title="VFX Shots" count={result.vfx.length} defaultOpen={false}>
                        <div className="space-y-2">
                          {result.vfx.map((v, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                Sc. {v.scene}
                              </span>
                              <p className="text-sm text-zinc-300">{v.description}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {result.stunts.length > 0 && (
                      <Section icon={<AlertTriangle className="h-4 w-4" />} title="Stunts" count={result.stunts.length} defaultOpen={false}>
                        <div className="space-y-2">
                          {result.stunts.map((s, i) => (
                            <div key={i} className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                              <span className="shrink-0 rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-mono text-amber-400">
                                Sc. {s.scene}
                              </span>
                              <p className="text-sm text-amber-200">{s.description}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}
                  </div>
                )}

                {/* IMPORT TAB */}
                {tab === "import" && file.projectId && (
                  <ImportTab
                    result={result}
                    projectId={file.projectId}
                    projectTitle={file.projectTitle}
                    scriptTitle={result.title}
                  />
                )}

              </div>
            </div>
          )}
        </div>

        {/* Re-run footer */}
        {result && (
          <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-3">
            <p className="text-xs text-zinc-600">Generated by Claude · results may vary</p>
            <button
              onClick={runBreakdown}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Re-run
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
