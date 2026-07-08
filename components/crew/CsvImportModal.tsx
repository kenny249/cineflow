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
  // ── Camera Department ─────────────────────────────────────────────────────
  [["director of photography", "dop", "cinematograph", "dp,", " dp ", "(dp)"], "Director of Photography (DP)"],
  [["1st ac", "first ac", "first assistant camera", "1st assistant camera", "focus puller"], "1st AC / Focus Puller"],
  [["2nd ac", "second ac", "second assistant camera", "2nd assistant camera", "clapper loader", "loader,"], "2nd AC"],
  [["3rd ac", "third ac", "camera trainee", "camera intern", "camera loader"], "3rd AC / Camera Trainee"],
  [["dit,", " dit ", "(dit)", "digital imaging tech", "data wrangler", "media wrangler"], "DIT / Data Wrangler"],
  [["steadicam", "steadi-cam", "steadi cam"], "Steadicam Operator"],
  [["drone operator", "drone pilot", "aerial operator", "uav pilot", "uas pilot", "fpv pilot", "fpv operator", "unmanned aerial", "remote pilot", "faa part 107"], "Drone / Aerial Operator"],
  [["camera operator", "camera op", "cam op", "b camera", "b-camera operator"], "Camera Operator"],
  [["dolly grip"], "Dolly Grip"],

  // ── Post Production ───────────────────────────────────────────────────────
  [["colorist", "colourist", "colour grading", "color grading", "davinci", "di operator", "conform editor", "online editor"], "Colorist"],
  [["vfx supervisor", "visual effects supervisor", "vfx lead"], "VFX Supervisor"],
  [["compositor", "compositing", "nuke artist", "comp artist"], "Compositor"],
  [["3d artist", "3d generalist", "cgi artist", "cgi generalist", "houdini artist", "maya artist", "cinema 4d artist"], "3D / CGI Artist"],
  [["character animator", "2d animator", "3d animator", "animation artist", "character animation"], "Animator"],
  [["motion graphics", "mograph", "motion designer", "motion artist"], "Motion Graphics Designer"],
  [["vfx", "visual effects", "fx artist"], "VFX Artist"],

  // ── Sound Department ──────────────────────────────────────────────────────
  [["re-recording mixer", "rerecording mixer", "dubbing mixer", "final mix", "dub mixer"], "Re-recording Mixer"],
  [["sound mixer", "sound recordist", "audio mixer", "production sound", "location sound"], "Sound Mixer / Recordist"],
  [["boom operator", "boom op,", " boom op ", "(boom op)", "boom person", "boom swinger"], "Boom Operator"],
  [["foley artist", "foley mixer", "foley,", " adr ", "adr voice", "adr director", "dialogue editor", "sound editor"], "Sound Editor / Foley"],
  [["sound designer", "audio designer", "audio director", "sound director"], "Sound Designer"],
  [["music supervisor", "music coordinator", "music placement", "sync licensing", "sync license", "music licens", "music clearance"], "Music Supervisor"],
  [["composer", "film score", "music composer", "original score", "film composer", "tv composer"], "Composer"],

  // ── Lighting & Grip ───────────────────────────────────────────────────────
  [["rigging gaffer", "rig gaffer", "rigging electric"], "Rigging Gaffer"],
  [["best boy electric", "best boy elec", "bbe,", " bbe ", "(bbe)"], "Best Boy Electric"],
  [["gaffer", "chief lighting", "chief electrician", "head electrician", "lighting director"], "Gaffer"],
  [["rigging grip", "rig grip"], "Rigging Grip"],
  [["best boy grip", "bbg,", " bbg ", "(bbg)"], "Best Boy Grip"],
  [["key grip"], "Key Grip"],

  // ── Art Department ────────────────────────────────────────────────────────
  [["production designer", "art department head", "head of art dept", "head of art department"], "Production Designer"],
  [["art director"], "Art Director"],
  [["set decorator", "set decoration", "lead set dresser", "set dresser", "lead dresser"], "Set Decorator"],
  [["prop master", "props master", "property master", "property dept", "props dept", "prop stylist", "set props"], "Prop Master"],
  [["scenic artist", "scenic painter", "scenic designer", "set builder", "construction coordinator"], "Scenic / Set Construction"],

  // ── Makeup / Hair / Wardrobe ──────────────────────────────────────────────
  [["sfx makeup", "prosthetic makeup", "prosthetics artist", "special effects makeup", "special makeup effects", "creature fx", "practical fx"], "SFX / Prosthetics Makeup"],
  [["makeup artist", "make-up artist", "mua,", " mua ", "(mua)", "hair and makeup", "hair & makeup", "hair/makeup", "muah,", " muah ", "key makeup", "head of makeup"], "Makeup / Hair"],
  [["costume designer", "wardrobe designer", "head of wardrobe", "wardrobe supervisor", "costume supervisor", "costumer,", " costumer "], "Costume Designer / Wardrobe"],
  [["wardrobe stylist", "fashion stylist", "clothing stylist", "on-set stylist", "stylist,", "(stylist)"], "Stylist"],

  // ── AD & Production ───────────────────────────────────────────────────────
  [["1st ad,", " 1st ad ", "(1ad)", "first assistant director", " first ad,", " first ad ", "1st a.d."], "1st AD"],
  [["2nd ad,", " 2nd ad ", "(2ad)", "second assistant director", " second ad,", " second ad ", "2nd a.d."], "2nd AD"],
  [["3rd ad,", " 3rd ad ", "third assistant director", "floor runner,", " floor runner ", "set pa,", " set pa "], "3rd AD / Set PA"],
  [["unit production manager", " upm,", " upm ", "(upm)"], "Unit Production Manager"],
  [["production coordinator", "prod coordinator", "prod coord,", " prod coord "], "Production Coordinator"],
  [["script supervisor", "continuity supervisor", "script continuity", "scripty,", " scripty "], "Script Supervisor"],
  [["location manager", "location scout", "locations manager", "locations dept", "locations supervisor"], "Location Manager / Scout"],
  [["line producer"], "Line Producer"],

  // ── Casting & Talent ──────────────────────────────────────────────────────
  [["casting director", "casting associate", "casting assistant", "casting coordinator", "casting dept"], "Casting Director"],
  [["talent agent", "talent manager", "talent agency", "talent management", "talent represent", "literary agent", "booking agent", "entertainment agent", "theatrical agent", "commercial agent"], "Talent Agent / Manager"],
  [["stunt coordinator", "stunt performer", "stunt double", "fight coordinator", "fight choreograph", "stuntman", "stuntwoman", "stunt rigger"], "Stunt Coordinator"],
  [["dialogue coach", "acting coach", "vocal coach", "dialect coach", "performance coach", "on-set coach"], "Acting / Dialogue Coach"],
  [["voice actor", "voice over actor", "voiceover actor", "vo actor", "voice talent", "voice over artist", "voiceover artist"], "Voice Actor"],
  [["actor,", " actor ", "(actor)", "actress", "sag-aftra", "sag aftra", "aftra actor", "film actor", "tv actor", "commercial actor", "character actor", "screen actor"], "Actor / Performer"],
  [["model/actor", "actor/model", "on-camera talent", "commercial talent", "fit model", "commercial model", "print model", "brand talent"], "Model / Talent"],

  // ── Writing ───────────────────────────────────────────────────────────────
  [["showrunner"], "Showrunner"],
  [["screenwriter", "screenplay writer", "script writer", "script doctor", "story editor", "staff writer", "tv writer", "head writer", "writer/director"], "Screenwriter"],

  // ── Distribution / PR ─────────────────────────────────────────────────────
  [["publicist", "entertainment pr", "film pr", "film publicist", "talent publicist"], "Publicist / PR"],
  [["film distributor", "distribution executive", "sales agent", "film sales", "foreign sales", "acquisitions exec"], "Film Distributor"],

  // ── Photography ───────────────────────────────────────────────────────────
  [["unit photographer", "set photographer", "still photographer", "bts photographer", "epk photographer", "behind the scenes photographer"], "Unit / Set Photographer"],
  [["photographer", "photography"], "Photographer"],

  // ── General Production (catch-alls — order matters) ───────────────────────
  [["production assistant", " pa,", " (pa)", "on-set pa", "onset pa", "office pa,"], "Production Assistant"],
  [["film editor", "video editor", "avid editor", "premiere editor", "final cut editor", "offline editor", "post production editor"], "Editor"],
  [["executive producer", "exec producer", "co-producer", "co producer", "associate producer", "supervising producer", "co-exec producer"], "Executive / Co-Producer"],
  [["producer"], "Producer"],
  [["editor", "editing,", " editing "], "Editor"],
  [["director"], "Director"], // catch-all — must be last
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
  // Core film & video
  "film", "films", "cinema", "cinematic", "movie", "movies",
  "motion picture", "feature film", "short film",
  "videograph", // videographer / videography
  "footage", "reel", "showreel", "demo reel",

  // Content types
  "documentary", "docuseries", "music video", "narrative",
  "commercial", "advertising",
  "broadcast", "broadcasting",
  "streaming",
  "content creat", "youtube", "youtuber", "podcast", "podcaster",
  "influencer", "vlogger",
  "bts", "epk", "behind the scenes",
  "on-set", "on set",

  // Production companies
  "production", "productions",
  "studio", "studios",
  "entertainment", "pictures", "media", "creative media",

  // Camera & DP
  "cinemat", "camera",
  "dp ", "dp,", "(dp)", " dop",
  "director of photography",
  "steadicam", "drone",

  // Camera dept
  "focus puller", "1st ac", "2nd ac", "clapper",
  " dit ", "dit,", "(dit)", "digital imaging tech", "data wrangler",

  // Post production
  "post prod", "post-prod",
  "edit", // editor / editing
  "colorist", "colourist", "colour grad", "color grad", "davinci",
  "vfx", "visual effects", "composit", "compositor",
  "animation", "animator",
  "motion graphic", "mograph",
  "3d artist", "cgi",

  // Sound
  "sound", "audio",
  "boom", "foley", "adr", "dubbing",
  "sound design", "sound mix", "re-recording",

  // Music
  "composer", "film score", "music supervisor",

  // Lighting & grip
  "gaffer", "grip",
  "best boy", "dolly", "rigging electric", "rigging grip",

  // Art dept
  "production designer", "art director",
  "set decor", "set dress", "prop master", "props dept",
  "wardrobe", "costume",
  "prosthetic", "sfx makeup",

  // Makeup & hair
  "makeup", "make-up", " mua", "(mua)",

  // AD & production
  "director", // art director, assistant director, director
  "assistant director", " 1st ad", " 2nd ad", " 3rd ad",
  "script supervis", "script coord", "continuity",
  "location manager", "location scout",
  "production coord", "unit production manager", " upm",
  "producer", "showrunner",

  // Casting & talent
  "actor", "actress", "sag-aftra", "sag aftra", " sag ", "aftra",
  "stunt", "casting",
  "talent agency", "talent management", "talent represent",
  "on-camera", "voice actor", "voice over",
  "performer",

  // Writing
  "screenwriter", "screenplay", "script writer",

  // Photography
  "photographer", "photography", "photo",

  // Distribution / PR
  "distributor", "distribution", "publicist", "film festival",
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingEmails]); // processFile reads existingEmails from its own render scope

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
