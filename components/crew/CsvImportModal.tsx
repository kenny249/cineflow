"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Upload, X, FileText, AlertCircle, Check, ChevronRight, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CrewProfile } from "@/types";
import { CREW_ROLES } from "@/types";

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = (values[i] ?? "").trim(); });
    return row;
  });
}

// Case-insensitive field lookup supporting multiple possible header names
function getField(row: Record<string, string>, ...keys: string[]): string {
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const v = lower[key.toLowerCase()];
    if (v) return v;
  }
  return "";
}

// ── Role detection ────────────────────────────────────────────────────────────

const ROLE_MAP: [string[], string][] = [
  [["director of photography", "dop", "cinematograph", "dp,", " dp ", "(dp)"], "Director of Photography (DP)"],
  [["1st ac", "focus puller", "first ac"], "1st AC / Focus Puller"],
  [["2nd ac", "second ac"], "2nd AC"],
  [["steadicam"], "Steadicam Operator"],
  [["drone", "aerial operator", "uav pilot", "fpv"], "Drone / Aerial Operator"],
  [["camera operator", "camera op", "cam op"], "Camera Operator"],
  [["colorist", "colour grading", "color grading", "davinci"], "Colorist"],
  [["sound mixer", "sound recordist", "audio mixer", "production sound", "boom"], "Sound Mixer / Recordist"],
  [["sound designer", "audio designer"], "Sound Designer"],
  [["composer", "film score", "music composer"], "Composer"],
  [["gaffer", "chief lighting", "lighting tech"], "Gaffer"],
  [["key grip", "best boy grip"], "Key Grip"],
  [["production designer", "art department head"], "Production Designer"],
  [["art director"], "Art Director"],
  [["makeup", "make-up", "mua", "hair and makeup"], "Makeup / Hair"],
  [["line producer"], "Line Producer"],
  [["script supervisor", "continuity"], "Script Supervisor"],
  [["motion graphics", "mograph", "motion designer"], "Motion Graphics Designer"],
  [["vfx", "visual effects", "cgi artist"], "VFX Artist"],
  [["photographer", "photography"], "Photographer"],
  [["production assistant", " pa,", "(pa)"], "Production Assistant"],
  [["editor", "editing", "post production"], "Editor"],
  [["producer", "executive producer"], "Producer"],
  [["director"], "Director"], // must come last — catches anything with "director" not already matched
];

function detectRole(title: string, company: string): string | null {
  const haystack = (title + " " + company).toLowerCase();
  for (const [keywords, role] of ROLE_MAP) {
    if (keywords.some((kw) => haystack.includes(kw))) return role;
  }
  return null;
}

// ── Film keyword detection ────────────────────────────────────────────────────

const FILM_KEYWORDS = [
  "film", "video", "cinema", "production", "studio", "creative media",
  "motion", "post prod", "edit", "sound", "audio", "broadcast",
  "documentary", "commercial", "advertising", "content creat",
  "dp ", "(dp)", "director", "editor", "colorist", "gaffer", "grip",
  "camera", "cinemat", "vfx", "animation", "reel", "footage",
  "photographer", "photo", "visual effects", "composit",
];

function isFilmRelated(title: string, company: string): boolean {
  const haystack = (title + " " + company).toLowerCase();
  return FILM_KEYWORDS.some((kw) => haystack.includes(kw));
}

// ── Row normalisation ─────────────────────────────────────────────────────────

export interface ImportRow {
  key: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  detectedRole: string | null;
  company: string;
  rawTitle: string;
  isFilm: boolean;
  selected: boolean;
  duplicate: boolean; // email already in crew network
}

function normaliseRows(rows: Record<string, string>[], existingEmails: Set<string>): ImportRow[] {
  return rows
    .map((row, i) => {
      // Name — try full name first, then first+last
      const fullName = getField(row, "Name", "Full Name", "Display Name", "Contact Name");
      const firstName = getField(row, "First Name", "Given Name", "Firstname");
      const lastName = getField(row, "Last Name", "Family Name", "Surname", "Lastname");
      const name = fullName || [firstName, lastName].filter(Boolean).join(" ").trim();
      if (!name) return null;

      const email = getField(
        row,
        "E-mail 1 - Value", "Email 1 - Value", "Email", "E-mail Address",
        "Primary Email", "Email Address", "email"
      ).toLowerCase();
      const phone = getField(
        row,
        "Phone 1 - Value", "Mobile Phone", "Primary Phone", "Phone", "Mobile",
        "Cell Phone", "Main Phone"
      );
      const city = getField(row, "City", "Home City", "Work City", "Location");
      const rawTitle = getField(row, "Job Title", "Title", "Occupation", "Organization 1 - Title", "Position");
      const company = getField(row, "Company", "Organization", "Organization 1 - Name", "Employer");

      const detectedRole = detectRole(rawTitle, company);
      const isFilm = isFilmRelated(rawTitle, company);
      const duplicate = !!email && existingEmails.has(email);

      return {
        key: `row-${i}`,
        name, email, phone, city, detectedRole, company, rawTitle,
        isFilm, selected: isFilm && !duplicate, duplicate,
      } satisfies ImportRow;
    })
    .filter((r): r is ImportRow => r !== null);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onImport: (rows: ImportRow[]) => Promise<void>;
  existingEmails: Set<string>;
}

export function CsvImportModal({ onClose, onImport, existingEmails }: Props) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [search, setSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filmCount = useMemo(() => rows.filter((r) => r.isFilm && !r.duplicate).length, [rows]);
  const selectedCount = useMemo(() => rows.filter((r) => r.selected).length, [rows]);
  const dupCount = useMemo(() => rows.filter((r) => r.duplicate).length, [rows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.rawTitle.toLowerCase().includes(q)
    );
  }, [rows, search]);

  function processFile(file: File) {
    setParseError(null);
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setParseError("Please upload a .csv file. Export your contacts as CSV from Google Contacts or your phone.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setParseError("No rows found. Make sure your CSV has a header row and at least one contact.");
          return;
        }
        const normalised = normaliseRows(parsed, existingEmails);
        if (normalised.length === 0) {
          setParseError("Couldn't find any valid contacts. Make sure your CSV has a Name column.");
          return;
        }
        setRows(normalised);
        setStep("review");
      } catch {
        setParseError("Failed to parse the file. Make sure it's a valid CSV.");
      }
    };
    reader.readAsText(file);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [existingEmails]);

  function toggle(key: string) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, selected: !r.selected } : r));
  }

  function selectFilm() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: r.isFilm && !r.duplicate })));
  }

  function selectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: !r.duplicate })));
  }

  function deselectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) { toast.error("Select at least one contact"); return; }
    setImporting(true);
    try {
      await onImport(selected);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            {step === "review" && (
              <button onClick={() => { setStep("upload"); setRows([]); setSearch(""); }}
                className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                {step === "upload" ? "Import contacts from CSV" : "Review & select contacts"}
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {step === "upload"
                  ? "Export from Google Contacts or iPhone and drop it here."
                  : `${rows.length} contacts found · ${filmCount} look film-related${dupCount > 0 ? ` · ${dupCount} already in your network` : ""}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1 — Upload */}
        {step === "upload" && (
          <div className="p-6 space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 cursor-pointer transition-all",
                isDragging
                  ? "border-[#d4a853]/60 bg-[#d4a853]/5"
                  : "border-border hover:border-[#d4a853]/40 hover:bg-muted/20"
              )}
            >
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl border transition-colors",
                isDragging ? "border-[#d4a853]/40 bg-[#d4a853]/10" : "border-border bg-muted/30"
              )}>
                <Upload className={cn("h-5 w-5", isDragging ? "text-[#d4a853]" : "text-muted-foreground")} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Drop your CSV file here</p>
                <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
            </div>

            {parseError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">{parseError}</p>
              </div>
            )}

            {/* Format tips */}
            <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">How to export your contacts</p>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p><span className="font-medium text-foreground">Google Contacts:</span> contacts.google.com → Export → Google CSV</p>
                <p><span className="font-medium text-foreground">iPhone:</span> Sync to Google Contacts, then export — or use a contacts export app from the App Store</p>
                <p><span className="font-medium text-foreground">Any spreadsheet:</span> Save as .csv with columns: Name, Email, Phone, Job Title, Company</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Review */}
        {step === "review" && (
          <>
            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-2 border-b border-border px-4 py-2.5 flex-wrap">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="flex-1 min-w-[160px] rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/40 focus:outline-none"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {filmCount > 0 && (
                  <button onClick={selectFilm}
                    className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors">
                    <Film className="h-3 w-3" />
                    Film only ({filmCount})
                  </button>
                )}
                <button onClick={selectAll}
                  className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  All
                </button>
                <button onClick={deselectAll}
                  className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  None
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card border-b border-border">
                  <tr>
                    <th className="w-8 px-3 py-2 text-left" />
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Detected role</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((row) => (
                    <tr
                      key={row.key}
                      onClick={() => !row.duplicate && toggle(row.key)}
                      className={cn(
                        "transition-colors",
                        row.duplicate
                          ? "opacity-40 cursor-not-allowed"
                          : row.selected
                            ? "bg-[#d4a853]/[0.04] cursor-pointer hover:bg-[#d4a853]/[0.07]"
                            : "cursor-pointer hover:bg-muted/20"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                          row.duplicate
                            ? "border-border bg-muted/20"
                            : row.selected
                              ? "border-[#d4a853] bg-[#d4a853]"
                              : "border-border hover:border-[#d4a853]/50"
                        )}>
                          {row.selected && <Check className="h-2.5 w-2.5 text-black" />}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{row.name}</span>
                          {row.isFilm && !row.duplicate && (
                            <span className="hidden sm:inline-flex items-center gap-0.5 rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#d4a853] uppercase tracking-wide">
                              film
                            </span>
                          )}
                          {row.duplicate && (
                            <span className="text-[10px] text-muted-foreground">already added</span>
                          )}
                        </div>
                        {row.company && <p className="text-muted-foreground/60 text-[10px] mt-0.5">{row.company}</p>}
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        {row.detectedRole
                          ? <span className="text-foreground/80">{row.detectedRole}</span>
                          : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground/70">{row.email || "—"}</td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground/70">{row.phone || "—"}</td>
                      <td className="px-3 py-2.5">
                        {row.isFilm && (
                          <Film className="h-3 w-3 text-[#d4a853]/40" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">No contacts match your search.</p>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {selectedCount > 0
                  ? <><span className="font-semibold text-foreground">{selectedCount}</span> selected</>
                  : "Select contacts to import"}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={handleImport}
                  disabled={selectedCount === 0 || importing}
                >
                  {importing
                    ? `Importing…`
                    : `Import ${selectedCount > 0 ? selectedCount : ""} contact${selectedCount !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
