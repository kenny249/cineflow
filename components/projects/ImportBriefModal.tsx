"use client";

import { useEffect, useRef, useState } from "react";
import { X, FileUp, FileText, Loader2, CheckCircle2, Circle, AlertCircle, Camera, Users, ListChecks, MapPin, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCrewContact, createProjectEquipment, createShotList, createShotListItem } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { EquipmentCategory } from "@/types";

// ─── Types returned by the API ────────────────────────────────────────────────

interface BriefCrew {
  name: string;
  role: string;
  department: string;
  notes?: string | null;
}

interface BriefLens {
  focal_length: string;
  aperture?: string | null;
  type?: "prime" | "zoom";
}

interface BriefEquipment {
  category: EquipmentCategory;
  name: string;
  brand?: string | null;
  assigned_to?: string | null;
  role?: string | null;
  lenses?: BriefLens[];
  notes?: string | null;
}

interface BriefShot {
  title: string;
  description: string;
  phase?: string | null;
  shot_type?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
}

interface BriefLocation {
  name: string;
  notes?: string | null;
}

interface BriefResult {
  description?: string | null;
  project_type?: string | null;
  client_name?: string | null;
  venue?: string | null;
  shoot_date?: string | null;
  crew?: BriefCrew[];
  equipment?: BriefEquipment[];
  shots?: BriefShot[];
  locations?: BriefLocation[];
}

// ─── Selection state ──────────────────────────────────────────────────────────

interface Selection {
  description: boolean;
  crew: boolean[];
  equipment: boolean[];
  shots: boolean[];
  locations: boolean[];
}

function buildSelection(result: BriefResult): Selection {
  return {
    description: !!(result.description),
    crew: (result.crew ?? []).map(() => true),
    equipment: (result.equipment ?? []).map(() => true),
    shots: (result.shots ?? []).map(() => true),
    locations: (result.locations ?? []).map(() => true),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genLensId() {
  return Math.random().toString(36).slice(2, 10);
}

const SHOT_TYPE_MAP: Record<string, string> = {
  wide: "wide", medium: "medium", close_up: "close_up",
  extreme_close_up: "extreme_close_up", overhead: "overhead",
  drone: "drone", pov: "pov", other: "medium",
};

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function CheckRow({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/20 transition-colors">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${checked ? "border-[#d4a853] bg-[#d4a853]" : "border-border bg-muted/30"}`}
      >
        {checked && <CheckCircle2 className="h-3 w-3 text-black" />}
      </button>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground leading-snug">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </label>
  );
}

function SectionHeader({ icon: Icon, label, count, color }: { icon: React.ElementType; label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-1">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span>
    </div>
  );
}

// ─── Loading message cycles ───────────────────────────────────────────────────

const PARSE_MESSAGES: Record<string, string[]> = {
  live_event: [
    "Reading the brief…",
    "Mapping the show schedule…",
    "Extracting crew assignments…",
    "Scanning the artist lineup…",
    "Planning coverage positions…",
    "Identifying key moments…",
    "Building your run-of-show…",
    "Locking in the venue details…",
    "Organizing production roles…",
    "Almost there…",
  ],
  music_video: [
    "Reading the brief…",
    "Extracting crew roles…",
    "Building the shot list…",
    "Scanning performance setups…",
    "Mapping locations…",
    "Identifying equipment needs…",
    "Organizing scene breakdowns…",
    "Almost there…",
  ],
  wedding: [
    "Reading the brief…",
    "Mapping the day-of timeline…",
    "Extracting crew assignments…",
    "Identifying key moments…",
    "Scanning venue details…",
    "Organizing coverage plan…",
    "Almost there…",
  ],
  podcast: [
    "Reading the brief…",
    "Extracting guest lineup…",
    "Scanning episode details…",
    "Identifying equipment setup…",
    "Organizing recording plan…",
    "Almost there…",
  ],
  default: [
    "Reading the brief…",
    "Extracting crew members…",
    "Building the shot list…",
    "Scanning equipment needs…",
    "Mapping locations…",
    "Organizing scene breakdowns…",
    "Identifying key assets…",
    "Reviewing production details…",
    "Pulling it all together…",
    "Almost there…",
  ],
};

const IMPORT_MESSAGES = [
  "Adding crew to project…",
  "Logging equipment…",
  "Creating shot list…",
  "Saving locations…",
  "Updating project details…",
  "Writing to project…",
];

function useRotatingMessage(messages: string[], active: boolean, intervalMs = 1800) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) { setIdx(0); return; }
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(id);
  }, [active, messages, intervalMs]);
  return messages[idx];
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface ImportBriefModalProps {
  projectId: string;
  projectType?: string;
  onClose: () => void;
  onImported: (summary: string) => void;
}

type Step = "upload" | "parsing" | "preview" | "importing" | "done";

export function ImportBriefModal({ projectId, projectType, onClose, onImported }: ImportBriefModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const parseMessages = PARSE_MESSAGES[projectType ?? ""] ?? PARSE_MESSAGES.default;
  const parseMsg = useRotatingMessage(parseMessages, step === "parsing");
  const importMsg = useRotatingMessage(IMPORT_MESSAGES, step === "importing");
  const [pastedText, setPastedText] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<BriefResult | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function parseFile(file: File) {
    setFileName(file.name);
    setStep("parsing");
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ai/import-brief", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      const parsed = json.result as BriefResult;
      setResult(parsed);
      setSelection(buildSelection(parsed));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse brief");
      setStep("upload");
    }
  }

  async function parseText() {
    if (!pastedText.trim()) return;
    setStep("parsing");
    setError(null);
    setFileName("Pasted text");

    try {
      const res = await fetch("/api/ai/import-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      const parsed = json.result as BriefResult;
      setResult(parsed);
      setSelection(buildSelection(parsed));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse brief");
      setStep("upload");
    }
  }

  async function handleImport() {
    if (!result || !selection) return;
    setStep("importing");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setStep("preview"); return; }

    const counts = { crew: 0, equipment: 0, shots: 0, locations: 0, description: false };

    try {
      // Description — update project
      if (selection.description && result.description) {
        await supabase.from("projects").update({ description: result.description }).eq("id", projectId);
        counts.description = true;
      }

      // Crew
      const crewToImport = (result.crew ?? []).filter((_, i) => selection.crew[i]);
      for (const c of crewToImport) {
        await createCrewContact({
          project_id: projectId,
          name: c.name,
          role: c.role,
          department: c.department,
          notes: c.notes ?? undefined,
          sort_order: counts.crew,
        });
        counts.crew++;
      }

      // Equipment
      const gearToImport = (result.equipment ?? []).filter((_, i) => selection.equipment[i]);
      for (const g of gearToImport) {
        await createProjectEquipment({
          project_id: projectId,
          category: g.category,
          name: g.name,
          brand: g.brand ?? null,
          assigned_to: g.assigned_to ?? null,
          role: g.role ?? null,
          lenses: (g.lenses ?? []).map((l) => ({
            id: genLensId(),
            focal_length: l.focal_length,
            aperture: l.aperture ?? undefined,
            type: l.type ?? "prime",
          })),
          notes: g.notes ?? null,
          is_rental: false,
          sort_order: counts.equipment,
        });
        counts.equipment++;
      }

      // Shots — create shot list if needed, then items
      const shotsToImport = (result.shots ?? []).filter((_, i) => selection.shots[i]);
      if (shotsToImport.length > 0) {
        // Get or create default shot list
        const { data: existingLists } = await supabase
          .from("shot_lists")
          .select("id")
          .eq("project_id", projectId)
          .limit(1);

        let shotListId: string;
        if (existingLists && existingLists.length > 0) {
          shotListId = existingLists[0].id;
        } else {
          const newList = await createShotList({ project_id: projectId, title: "Shot List" });
          shotListId = newList.id;
        }

        for (const s of shotsToImport) {
          const notesParts = [
            s.phase ? `Phase: ${s.phase.replace(/_/g, " ")}` : null,
            s.assigned_to ? `Assigned: ${s.assigned_to}` : null,
            s.notes ?? null,
          ].filter((x): x is string => !!x);
          await createShotListItem({
            shot_list_id: shotListId,
            shot_number: counts.shots + 1,
            description: [s.title, s.description].filter(Boolean).join(" — "),
            shot_type: (SHOT_TYPE_MAP[s.shot_type ?? ""] ?? "medium") as any,
            is_complete: false,
            notes: notesParts.length ? notesParts.join(" · ") : undefined,
            camera_movement: "static",
          });
          counts.shots++;
        }
      }

      // Locations
      const locsToImport = (result.locations ?? []).filter((_, i) => selection.locations[i]);
      for (const loc of locsToImport) {
        await supabase.from("project_locations").insert({
          project_id: projectId,
          name: loc.name,
          notes: loc.notes ?? null,
          sort_order: counts.locations,
        });
        counts.locations++;
      }

      const parts = [
        counts.description && "description",
        counts.crew && `${counts.crew} crew`,
        counts.equipment && `${counts.equipment} equipment`,
        counts.shots && `${counts.shots} shots`,
        counts.locations && `${counts.locations} locations`,
      ].filter(Boolean);

      const summary = `Imported: ${parts.join(", ")}`;
      setStep("done");
      onImported(summary);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setStep("preview");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function toggleAll(section: keyof Omit<Selection, "description">, value: boolean) {
    setSelection((prev) => {
      if (!prev) return prev;
      return { ...prev, [section]: prev[section].map(() => value) };
    });
  }

  const totalSelected = !selection ? 0 : [
    selection.description ? 1 : 0,
    selection.crew.filter(Boolean).length,
    selection.equipment.filter(Boolean).length,
    selection.shots.filter(Boolean).length,
    selection.locations.filter(Boolean).length,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
              <FileUp className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold">Import Brief</h2>
              <p className="text-[11px] text-muted-foreground">
                {step === "upload" && "Upload a PDF or paste your brief — AI fills in the project."}
                {step === "parsing" && `Reading ${fileName}…`}
                {step === "preview" && `Found from ${fileName} — review and confirm.`}
                {step === "importing" && "Writing to project…"}
                {step === "done" && "Import complete."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload step ── */}
          {step === "upload" && (
            <div className="space-y-4 p-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-all ${dragOver ? "border-[#d4a853]/60 bg-[#d4a853]/5" : "border-border hover:border-[#d4a853]/40 hover:bg-muted/10"}`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/30">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Drop your brief here</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PDF supported · or click to browse</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileChange} />

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or paste text</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Text paste */}
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your production brief here…"
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50 resize-none"
              />

              <Button
                variant="gold"
                className="w-full"
                disabled={!pastedText.trim()}
                onClick={parseText}
              >
                Analyze Brief
              </Button>
            </div>
          )}

          {/* ── Parsing step ── */}
          {step === "parsing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#d4a853]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground transition-all duration-300">{parseMsg}</p>
                <p className="mt-1 text-xs text-muted-foreground">Claude is reading your brief…</p>
              </div>
            </div>
          )}

          {/* ── Preview step ── */}
          {step === "preview" && result && selection && (
            <div className="divide-y divide-border">

              {/* Description */}
              {result.description && (
                <div className="px-5 py-4">
                  <CheckRow
                    label="Project description"
                    sub={result.description}
                    checked={selection.description}
                    onChange={(v) => setSelection((s) => s ? { ...s, description: v } : s)}
                  />
                </div>
              )}

              {/* Crew */}
              {(result.crew ?? []).length > 0 && (
                <div className="px-5 py-4 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader icon={Users} label="Crew" count={(result.crew ?? []).length} color="text-green-400" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleAll("crew", true)} className="text-[10px] text-muted-foreground hover:text-foreground">All</button>
                      <button type="button" onClick={() => toggleAll("crew", false)} className="text-[10px] text-muted-foreground hover:text-foreground">None</button>
                    </div>
                  </div>
                  {(result.crew ?? []).map((c, i) => (
                    <CheckRow
                      key={i}
                      label={`${c.name} — ${c.role}`}
                      sub={[c.department, c.notes].filter(Boolean).join(" · ")}
                      checked={selection.crew[i]}
                      onChange={(v) => setSelection((s) => { if (!s) return s; const crew = [...s.crew]; crew[i] = v; return { ...s, crew }; })}
                    />
                  ))}
                </div>
              )}

              {/* Equipment */}
              {(result.equipment ?? []).length > 0 && (
                <div className="px-5 py-4 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader icon={Camera} label="Equipment" count={(result.equipment ?? []).length} color="text-blue-400" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleAll("equipment", true)} className="text-[10px] text-muted-foreground hover:text-foreground">All</button>
                      <button type="button" onClick={() => toggleAll("equipment", false)} className="text-[10px] text-muted-foreground hover:text-foreground">None</button>
                    </div>
                  </div>
                  {(result.equipment ?? []).map((g, i) => (
                    <CheckRow
                      key={i}
                      label={`${g.name}${g.assigned_to ? ` — ${g.assigned_to}` : ""}`}
                      sub={[g.role, g.category, (g.lenses ?? []).length ? `${(g.lenses ?? []).length} lens${(g.lenses ?? []).length !== 1 ? "es" : ""}` : null].filter(Boolean).join(" · ")}
                      checked={selection.equipment[i]}
                      onChange={(v) => setSelection((s) => { if (!s) return s; const equipment = [...s.equipment]; equipment[i] = v; return { ...s, equipment }; })}
                    />
                  ))}
                </div>
              )}

              {/* Shots */}
              {(result.shots ?? []).length > 0 && (
                <div className="px-5 py-4 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader icon={ListChecks} label="Shot List" count={(result.shots ?? []).length} color="text-[#d4a853]" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleAll("shots", true)} className="text-[10px] text-muted-foreground hover:text-foreground">All</button>
                      <button type="button" onClick={() => toggleAll("shots", false)} className="text-[10px] text-muted-foreground hover:text-foreground">None</button>
                    </div>
                  </div>
                  {(result.shots ?? []).map((s, i) => (
                    <CheckRow
                      key={i}
                      label={s.title}
                      sub={[s.phase?.replace(/_/g, " "), s.assigned_to, s.description].filter(Boolean).join(" · ")}
                      checked={selection.shots[i]}
                      onChange={(v) => setSelection((s2) => { if (!s2) return s2; const shots = [...s2.shots]; shots[i] = v; return { ...s2, shots }; })}
                    />
                  ))}
                </div>
              )}

              {/* Locations */}
              {(result.locations ?? []).length > 0 && (
                <div className="px-5 py-4 space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <SectionHeader icon={MapPin} label="Locations" count={(result.locations ?? []).length} color="text-orange-400" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => toggleAll("locations", true)} className="text-[10px] text-muted-foreground hover:text-foreground">All</button>
                      <button type="button" onClick={() => toggleAll("locations", false)} className="text-[10px] text-muted-foreground hover:text-foreground">None</button>
                    </div>
                  </div>
                  {(result.locations ?? []).map((l, i) => (
                    <CheckRow
                      key={i}
                      label={l.name}
                      sub={l.notes ?? undefined}
                      checked={selection.locations[i]}
                      onChange={(v) => setSelection((s) => { if (!s) return s; const locations = [...s.locations]; locations[i] = v; return { ...s, locations }; })}
                    />
                  ))}
                </div>
              )}

              {/* Nothing found */}
              {!result.description && !(result.crew?.length) && !(result.equipment?.length) && !(result.shots?.length) && (
                <div className="flex flex-col items-center gap-3 py-12 text-center px-5">
                  <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Couldn't extract structured data from this brief.</p>
                  <p className="text-xs text-muted-foreground/60">Try pasting the text directly instead of uploading a file.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Importing step ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="h-10 w-10 animate-spin text-[#d4a853]" />
              <p className="text-sm font-semibold text-foreground transition-all duration-300">{importMsg}</p>
            </div>
          )}

          {/* ── Done step ── */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="h-7 w-7 text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Import complete</p>
                <p className="mt-1 text-xs text-muted-foreground">Your project has been populated from the brief.</p>
              </div>
              <Button variant="gold" size="sm" onClick={onClose}>Done</Button>
            </div>
          )}
        </div>

        {/* Footer — only on preview */}
        {step === "preview" && selection && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 shrink-0">
            <span className="text-xs text-muted-foreground">{totalSelected} item{totalSelected !== 1 ? "s" : ""} selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>Back</Button>
              <Button variant="gold" size="sm" disabled={totalSelected === 0} onClick={handleImport}>
                Import Selected
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
