"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronRight, ChevronLeft, Loader2, Printer, Download, Share2,
  MapPin, Users, Clock, Calendar, AlertTriangle, FileText, Check,
  Edit3, Film, Radio, Mic2, CheckCircle2, Minimize2, Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getCrewContacts, getProjectLocations, getShotLists, getProfile, updateCrewContact } from "@/lib/supabase/queries";
import type { Project, CrewContact, ProjectLocation, ShotListItem } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallSheetFormat = "scripted" | "live_event" | "interview";

interface CrewWithCall extends CrewContact { callTime: string }
interface LocationWithParking extends ProjectLocation { parkingNotes: string }

interface ScheduleItem {
  time: string;
  label: string;
  location: string | null;
  type: "logistics" | "setup" | "shoot" | "break" | "move" | "wrap";
}

interface CoverageAssignment {
  person: string;
  role: string;
  equipment: string;
  responsibilities: string[];
  callTime?: string;
}

interface StaticCamera {
  name: string;
  role: string;
}

interface KeyMoment {
  label: string;
  description: string;
  type: "pre" | "during" | "post" | "logistics";
}

interface RunOfShowItem {
  setTime: string;
  endTime?: string;
  artist: string;
  duration: string;
  stage: string;
  notes: string;
}

interface ScriptedSheet   { format: "scripted";   schedule: ScheduleItem[];     warning: string | null }
interface LiveEventSheet  { format: "live_event"; coverage: CoverageAssignment[]; staticCameras: StaticCamera[]; keyMoments: KeyMoment[]; runOfShow: RunOfShowItem[]; warning: string | null }
interface InterviewSheet  { format: "interview";  schedule: ScheduleItem[];     warning: string | null }

type GeneratedSheet = ScriptedSheet | LiveEventSheet | InterviewSheet;

interface SavedCallSheet {
  id: string;
  title: string;
  shoot_date: string | null;
  updated_at: string;
}

interface FormData {
  format: CallSheetFormat;
  shootDate: string;
  callTime: string;
  wrapTime: string;
  hospital: string;
  weather: string;
  confidential: boolean;
  directorNote: string;
  // All formats
  emergencyContact: string;
  walkieChannels: string;
  // Live event
  doorsTime: string;
  soundCheckTime: string;
  showTime: string;
  loadInTime: string;
  // Scripted / Interview
  shootDay: string;
  scriptRevision: string;
  // Interview
  interviewSubjects: string;
  // All formats
  dresscode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanTimeValue(v: string) {
  if (!v) return v;
  const parts = v.split(":");
  return parts.length >= 2 ? `${parts[0]}:${parts[1]}` : v;
}

// Cinematic date + time inputs — replaces native browser pickers
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const CINEMA_SELECT = "bg-transparent text-[#d4a853] font-mono text-sm focus:outline-none cursor-pointer appearance-none text-center";
const CINEMA_DIVIDER = <span className="self-stretch w-px bg-[#d4a853]/10 shrink-0" />;
const CINEMA_WRAP = "flex items-stretch overflow-hidden rounded-xl border border-[#d4a853]/20 bg-[#0a0a0a] focus-within:border-[#d4a853]/50 transition-colors w-full";

function CinematicDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value ? value.split("-") : [];
  const year = parseInt(parts[0]) || 0;
  const month = parseInt(parts[1]) || 0;
  const day = parseInt(parts[2]) || 0;
  const daysInMonth = month && year ? new Date(year, month, 0).getDate() : 31;
  const curYear = new Date().getFullYear();

  function emit(y: number, m: number, d: number) {
    if (y && m && d) onChange(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }

  return (
    <div className={CINEMA_WRAP}>
      <select value={month || ""} onChange={(e) => emit(year, parseInt(e.target.value) || 0, day)}
        className={`${CINEMA_SELECT} px-3 py-2.5 flex-1`}>
        <option value="">MON</option>
        {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
      </select>
      {CINEMA_DIVIDER}
      <select value={day || ""} onChange={(e) => emit(year, month, parseInt(e.target.value) || 0)}
        className={`${CINEMA_SELECT} px-2 py-2.5 w-14`}>
        <option value="">DD</option>
        {Array.from({ length: daysInMonth }, (_, i) => (
          <option key={i+1} value={i+1}>{String(i+1).padStart(2,"0")}</option>
        ))}
      </select>
      {CINEMA_DIVIDER}
      <select value={year || ""} onChange={(e) => emit(parseInt(e.target.value) || 0, month, day)}
        className={`${CINEMA_SELECT} px-3 py-2.5 flex-1`}>
        <option value="">YYYY</option>
        {Array.from({ length: 5 }, (_, i) => curYear + i).map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

function TimeInput({ value, onChange, className: _className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [h24Str, minStr] = value ? value.split(":") : ["", ""];
  const h24 = parseInt(h24Str);
  const min = parseInt(minStr) || 0;
  const hasValue = !isNaN(h24);
  const isPM = hasValue ? h24 >= 12 : false;
  const h12 = !hasValue ? 0 : h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  function emit(newH12: number, newMin: number, newPM: boolean) {
    const h = newPM ? (newH12 === 12 ? 12 : newH12 + 12) : (newH12 === 12 ? 0 : newH12);
    onChange(`${String(h).padStart(2,"0")}:${String(newMin).padStart(2,"0")}`);
  }

  return (
    <div className={CINEMA_WRAP}>
      <select value={hasValue ? h12 : ""} onChange={(e) => emit(parseInt(e.target.value) || 12, min, isPM)}
        className={`${CINEMA_SELECT} px-3 py-2.5 w-14`}>
        {!hasValue && <option value="">HH</option>}
        {[12,1,2,3,4,5,6,7,8,9,10,11].map(h => (
          <option key={h} value={h}>{String(h).padStart(2,"0")}</option>
        ))}
      </select>
      <span className="self-center text-[#d4a853]/30 font-mono text-base px-0.5">:</span>
      <select value={hasValue ? min : 0} onChange={(e) => emit(h12 || 12, parseInt(e.target.value) || 0, isPM)}
        className={`${CINEMA_SELECT} px-2 py-2.5 w-14`}>
        {Array.from({ length: 60 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2,"0")}</option>
        ))}
      </select>
      {CINEMA_DIVIDER}
      <button type="button" onClick={() => hasValue ? emit(h12 || 12, min, !isPM) : emit(12, 0, false)}
        className="px-3 font-mono text-xs font-bold text-[#d4a853]/50 hover:text-[#d4a853] hover:bg-[#d4a853]/5 transition-colors shrink-0">
        {hasValue ? (isPM ? "PM" : "AM") : "AM"}
      </button>
    </div>
  );
}

function to12h(t: string): string {
  if (!t || !t.includes(":")) return t || "TBD";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function parseRosTime(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let h = NaN, m = 0, isPM: boolean | null = null;
  if (s.endsWith("am") || (s.endsWith("a") && /\d/.test(s.slice(-2, -1)))) {
    isPM = false;
    const rest = s.replace(/a(m)?$/, "").trim();
    const [hStr, mStr] = rest.split(":");
    h = parseInt(hStr); m = parseInt(mStr || "0") || 0;
  } else if (s.endsWith("pm") || (s.endsWith("p") && /\d/.test(s.slice(-2, -1)))) {
    isPM = true;
    const rest = s.replace(/p(m)?$/, "").trim();
    const [hStr, mStr] = rest.split(":");
    h = parseInt(hStr); m = parseInt(mStr || "0") || 0;
  } else if (s.includes(":")) {
    const [hStr, mStr] = s.split(":");
    h = parseInt(hStr); m = parseInt(mStr || "0") || 0;
  } else if (/^\d{3,4}$/.test(s)) {
    h = parseInt(s.slice(0, -2)); m = parseInt(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = parseInt(s); m = 0;
  }
  if (isNaN(h) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  if (isPM === true && h < 12) h += 12;
  if (isPM === false && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatRosTime(hhmm: string, use24h: boolean): string {
  if (!hhmm || !hhmm.includes(":")) return hhmm;
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr), m = parseInt(mStr);
  if (isNaN(h) || isNaN(m)) return hhmm;
  if (use24h) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

function RosTimeInput({ value, onChange, use24h }: { value: string; onChange: (v: string) => void; use24h: boolean }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const display = value ? formatRosTime(value, use24h) : "";
  return (
    <input
      type="text"
      value={focused ? text : display}
      placeholder={use24h ? "22:00" : "10:00 PM"}
      onFocus={() => { setText(display); setFocused(true); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setFocused(false); const p = parseRosTime(text); onChange(p ?? text); }}
      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
    />
  );
}

const DEPT_ORDER = ["Production", "Direction", "Camera", "Lighting", "Grip", "Sound", "Art", "Wardrobe", "Hair & Makeup", "Talent", "Other"];

function CrewEditorRow({ m, idx, crew, onCrewChange, defaultCallTime, onNameChange, onCallTimeChange }: {
  m: CrewWithCall; idx: number; crew: CrewWithCall[];
  onCrewChange: (c: CrewWithCall[]) => void; defaultCallTime: string;
  onNameChange?: (oldName: string, newName: string) => void;
  onCallTimeChange?: (personName: string, callTime: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(m.name);
  const [phoneVal, setPhoneVal] = useState(m.phone ?? "");

  async function saveName() {
    const trimmed = nameVal.trim();
    setEditingName(false);
    if (!trimmed || trimmed === m.name) { setNameVal(m.name); return; }
    try {
      await updateCrewContact(m.id, { name: trimmed });
      const oldName = m.name;
      const u = [...crew]; u[idx] = { ...u[idx], name: trimmed }; onCrewChange(u);
      onNameChange?.(oldName, trimmed);
    } catch { setNameVal(m.name); toast.error("Failed to update name"); }
  }

  async function savePhone() {
    const trimmed = phoneVal.trim();
    if (trimmed === (m.phone ?? "")) return;
    try {
      await updateCrewContact(m.id, { phone: trimmed });
      const u = [...crew]; u[idx] = { ...u[idx], phone: trimmed }; onCrewChange(u);
      toast.success("Phone updated");
    } catch { setPhoneVal(m.phone ?? ""); toast.error("Failed to update phone"); }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10 text-[10px] font-bold text-[#d4a853]">
        {nameVal.charAt(0).toUpperCase() || "?"}
      </div>
      <div className="min-w-0 flex-1">
        {editingName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setNameVal(m.name); setEditingName(false); } }}
            className="w-full rounded border border-[#d4a853]/50 bg-background px-1.5 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
          />
        ) : (
          <button onClick={() => { setNameVal(m.name); setEditingName(true); }} className="group flex items-center gap-1 text-left">
            <span className="text-xs font-medium text-foreground leading-none">{nameVal}</span>
            <Edit3 className="h-2.5 w-2.5 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
          </button>
        )}
        <p className="text-[10px] text-muted-foreground mt-0.5">{m.role}</p>
        <input
          value={phoneVal}
          onChange={(e) => setPhoneVal(e.target.value)}
          onBlur={savePhone}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          placeholder="Add phone"
          className="mt-0.5 w-full bg-transparent text-[10px] text-muted-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:text-foreground transition-colors"
        />
      </div>
      <div className="shrink-0">
        <TimeInput
          value={m.callTime || defaultCallTime}
          onChange={(v) => {
            const u = [...crew]; u[idx] = { ...u[idx], callTime: v }; onCrewChange(u);
            onCallTimeChange?.(m.name, v);
          }}
        />
      </div>
    </div>
  );
}

function groupByDept(crew: CrewWithCall[]) {
  const map = new Map<string, CrewWithCall[]>();
  for (const m of crew) {
    const dept = m.department || "Other";
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept)!.push(m);
  }
  const sorted = new Map<string, CrewWithCall[]>();
  for (const d of DEPT_ORDER) if (map.has(d)) sorted.set(d, map.get(d)!);
  for (const [d, v] of map) if (!sorted.has(d)) sorted.set(d, v);
  return sorted;
}

const ROW_BG: Record<ScheduleItem["type"], string> = {
  logistics: "#fffbeb", setup: "#eff6ff", shoot: "#ffffff",
  break: "#f5f3ff", move: "#fff7ed", wrap: "#f9fafb",
};
const ROW_DOT: Record<ScheduleItem["type"], string> = {
  logistics: "#d4a853", setup: "#60a5fa", shoot: "#34d399",
  break: "#a78bfa", move: "#fb923c", wrap: "#9ca3af",
};
const TYPE_LABEL: Record<ScheduleItem["type"], string> = {
  logistics: "LOGISTICS", setup: "SETUP", shoot: "SHOOT",
  break: "BREAK", move: "MOVE", wrap: "WRAP",
};

const MOMENT_DOT: Record<KeyMoment["type"], string> = {
  pre: "#60a5fa", during: "#34d399", post: "#a78bfa", logistics: "#d4a853",
};

// ─── Shared print header / footer ─────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <div style={{ width: 3, height: 14, background: "#000", borderRadius: 2, flexShrink: 0 }} />
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: "#111", margin: 0 }}>
        {children}
      </p>
      <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
    </div>
  );
}

function PrintHeader({ project, profile, formData, clientLogoUrl }: {
  project: Project; profile: any; formData: FormData; clientLogoUrl?: string;
}) {
  const producerName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : "";
  const shootDateStr = formData.shootDate
    ? new Date(formData.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "Date TBD";
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: 12, marginBottom: 14, borderBottom: "2.5px solid #111" }}>
        <div style={{ minWidth: 120 }}>
          {profile?.logo_url && <img src={profile.logo_url} alt="" style={{ height: 36, objectFit: "contain", display: "block", marginBottom: 4 }} />}
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111", margin: 0 }}>{profile?.business_name || "Production Company"}</p>
          {producerName && <p style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{producerName}</p>}
        </div>
        <div style={{ textAlign: "center", flex: 1, padding: "0 20px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", margin: "0 0 3px" }}>{project.title}</h1>
          {project.client_name && <p style={{ fontSize: 9, color: "#6b7280", margin: "0 0 2px" }}>Client: {project.client_name}</p>}
          <p style={{ fontSize: 10, fontWeight: 700, color: "#111", margin: 0 }}>CALL SHEET — {shootDateStr}</p>
        </div>
        <div style={{ textAlign: "right", minWidth: 120 }}>
          {clientLogoUrl && <img src={clientLogoUrl} alt="" style={{ height: 36, maxWidth: 120, objectFit: "contain", display: "block", marginLeft: "auto", marginBottom: 6 }} />}
          {formData.confidential && <span style={{ display: "inline-block", border: "1.5px solid #111", padding: "2px 6px", fontSize: 8, fontWeight: 800, letterSpacing: "0.15em" }}>CONFIDENTIAL</span>}
          <p style={{ fontSize: 9, color: "#9ca3af", marginTop: formData.confidential ? 4 : 0 }}>Generated by Cineflow</p>
        </div>
      </div>

      {/* Call time bar — crew call large left, all other times compact right */}
      <div style={{ display: "flex", alignItems: "stretch", background: "#111", color: "#fff", borderRadius: 6, padding: "10px 16px", marginBottom: 6, gap: 16 }}>
        <div style={{ paddingRight: 16, borderRight: "1px solid #333", flexShrink: 0 }}>
          <p style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>General Crew Call</p>
          <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", margin: 0, letterSpacing: "0.05em" }}>{to12h(formData.callTime)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
          {formData.format === "live_event" ? (<>
            {formData.loadInTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Load-In</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.loadInTime)}</p>
            </div>}
            {formData.soundCheckTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Sound Check</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.soundCheckTime)}</p>
            </div>}
            {formData.doorsTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Doors Open</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.doorsTime)}</p>
            </div>}
            {formData.showTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Show Start</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.showTime)}</p>
            </div>}
            {formData.wrapTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Wrap</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.wrapTime)}</p>
            </div>}
          </>) : (<>
            {(formData.shootDay || formData.scriptRevision) && <div>
              {formData.shootDay && <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>{formData.shootDay}</p>}
              {formData.scriptRevision && <p style={{ fontSize: 9, color: "#9ca3af", margin: "2px 0 0" }}>{formData.scriptRevision}</p>}
            </div>}
            {formData.wrapTime && <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9ca3af", margin: "0 0 2px" }}>Wrap</p>
              <p style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", margin: 0 }}>{to12h(formData.wrapTime)}</p>
            </div>}
          </>)}
        </div>
      </div>

      {/* Supplemental strip — key contact, weather, hospital, walkie, dresscode */}
      {(formData.emergencyContact || formData.weather || formData.hospital || formData.walkieChannels || formData.interviewSubjects || formData.dresscode) && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: "5px 12px", marginBottom: 10, fontSize: 9 }}>
          {formData.emergencyContact && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Key Contact: </span><span style={{ color: "#111", fontWeight: 600 }}>{formData.emergencyContact}</span></span>
          )}
          {formData.weather && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Weather: </span><span style={{ color: "#111", fontWeight: 600 }}>{formData.weather}</span></span>
          )}
          {formData.hospital && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Hospital: </span><span style={{ color: "#111" }}>{formData.hospital}</span></span>
          )}
          {formData.walkieChannels && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Walkie: </span><span style={{ color: "#111" }}>{formData.walkieChannels}</span></span>
          )}
          {formData.dresscode && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Attire: </span><span style={{ color: "#111", fontWeight: 600 }}>{formData.dresscode}</span></span>
          )}
          {formData.interviewSubjects && (
            <span><span style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280" }}>Subject(s): </span><span style={{ color: "#111" }}>{formData.interviewSubjects}</span></span>
          )}
        </div>
      )}
    </>
  );
}

function PrintFooter({ formData }: { formData: FormData }) {
  return (
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6, fontSize: 8, color: "#9ca3af", textAlign: "center" }}>
      Generated with Cineflow · {new Date().toLocaleDateString()}
      {formData.confidential && " · CONFIDENTIAL — Do not distribute"}
    </div>
  );
}

// ─── Scripted Print Sheet ─────────────────────────────────────────────────────

function ScriptedPrintSheet({ project, profile, formData, crew, locations, sheet, clientLogoUrl }: {
  project: Project; profile: any; formData: FormData; crew: CrewWithCall[];
  locations: LocationWithParking[]; sheet: ScriptedSheet | InterviewSheet; clientLogoUrl?: string;
}) {
  const deptMap = groupByDept(crew);
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#111", fontSize: 11, lineHeight: 1.4, background: "#fff" }}>
      <PrintHeader project={project} profile={profile} formData={formData} clientLogoUrl={clientLogoUrl} />

      {sheet.warning && (
        <div style={{ border: "1px solid #fbbf24", background: "#fffbeb", borderRadius: 4, padding: "6px 10px", marginBottom: 10, fontSize: 10, color: "#92400e", display: "flex", gap: 6 }}>
          <span style={{ fontWeight: 800 }}>⚠ NOTE:</span> {sheet.warning}
        </div>
      )}

      {/* Crew call times */}
      {crew.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Crew Call Times</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {Array.from(deptMap.entries()).map(([dept, members]) => (
              <div key={dept} style={{ border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "4px 10px" }}>
                  <p style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "#374151", margin: 0 }}>{dept}</p>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "4px 10px", fontWeight: 700 }}>{m.name}</td>
                        <td style={{ padding: "4px 10px", color: "#6b7280" }}>{m.role}</td>
                        {m.phone && <td style={{ padding: "4px 10px", color: "#9ca3af", fontSize: 9, whiteSpace: "nowrap" }}>{m.phone}</td>}
                        <td style={{ padding: "4px 10px", fontFamily: "monospace", fontWeight: 900, textAlign: "right", whiteSpace: "nowrap", color: "#111" }}>
                          {to12h(m.callTime || formData.callTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {locations.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Locations</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(locations.length, 2)}, 1fr)`, gap: 6 }}>
            {locations.map((loc, i) => (
              <div key={loc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px" }}>
                <p style={{ fontSize: 11, fontWeight: 800, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex", width: 18, height: 18, background: "#111", color: "#fff", borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  {loc.name}
                </p>
                {loc.address && <p style={{ fontSize: 9, color: "#374151", margin: "2px 0 2px 24px" }}>{loc.address}</p>}
                {loc.parkingNotes && <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 2px 24px" }}>Parking: {loc.parkingNotes}</p>}
                {loc.contact_name && <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 2px 24px" }}>Location Contact: {loc.contact_name}{loc.contact_phone ? ` · ${loc.contact_phone}` : ""}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div style={{ marginBottom: 14 }}>
        <SectionHeader>Shooting Schedule</SectionHeader>
        <div style={{ display: "flex", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          {(Object.entries(ROW_DOT) as [ScheduleItem["type"], string][]).map(([type, color]) => (
            <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 8, color: "#6b7280" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {TYPE_LABEL[type]}
            </span>
          ))}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#111", color: "#fff" }}>
              <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 700, width: 75, whiteSpace: "nowrap" }}>Time</th>
              <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 700 }}>Description</th>
              <th style={{ padding: "5px 10px", textAlign: "left", fontWeight: 700, width: 120 }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {sheet.schedule.map((item, i) => (
              <tr key={i} style={{ background: ROW_BG[item.type] ?? "#fff", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "5px 10px", fontFamily: "monospace", fontWeight: 800, whiteSpace: "nowrap", verticalAlign: "top" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROW_DOT[item.type] ?? "#9ca3af", display: "inline-block", flexShrink: 0 }} />
                    {to12h(item.time)}
                  </span>
                </td>
                <td style={{ padding: "5px 10px", verticalAlign: "top" }}>{item.label}</td>
                <td style={{ padding: "5px 10px", color: "#6b7280", fontSize: 9, verticalAlign: "top" }}>{item.location || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formData.directorNote && (
        <div style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #111", borderRadius: 4, padding: "8px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#9ca3af", margin: "0 0 4px" }}>Director's Note</p>
          <p style={{ fontSize: 10, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{formData.directorNote}</p>
        </div>
      )}

      <PrintFooter formData={formData} />
    </div>
  );
}

// ─── Live Event Print Sheet ───────────────────────────────────────────────────

function LiveEventPrintSheet({ project, profile, formData, crew, locations, sheet, clientLogoUrl }: {
  project: Project; profile: any; formData: FormData; crew: CrewWithCall[];
  locations: LocationWithParking[]; sheet: LiveEventSheet; clientLogoUrl?: string;
}) {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#111", fontSize: 11, lineHeight: 1.4, background: "#fff" }}>
      <PrintHeader project={project} profile={profile} formData={formData} clientLogoUrl={clientLogoUrl} />

      {sheet.warning && (
        <div style={{ border: "1px solid #fbbf24", background: "#fffbeb", borderRadius: 4, padding: "6px 10px", marginBottom: 10, fontSize: 10, color: "#92400e", display: "flex", gap: 6 }}>
          <span style={{ fontWeight: 800 }}>⚠ NOTE:</span> {sheet.warning}
        </div>
      )}

      {/* Venue / locations */}
      {locations.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Venue</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(locations.length, 2)}, 1fr)`, gap: 6 }}>
            {locations.map((loc, i) => (
              <div key={loc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "8px 10px" }}>
                <p style={{ fontSize: 11, fontWeight: 800, margin: "0 0 3px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-flex", width: 18, height: 18, background: "#111", color: "#fff", borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                  {loc.name}
                </p>
                {loc.address && <p style={{ fontSize: 9, color: "#374151", margin: "2px 0 2px 24px" }}>{loc.address}</p>}
                {loc.parkingNotes && <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 2px 24px" }}>Parking: {loc.parkingNotes}</p>}
                {loc.contact_name && <p style={{ fontSize: 9, color: "#6b7280", margin: "2px 0 2px 24px" }}>Contact: {loc.contact_name}{loc.contact_phone ? ` · ${loc.contact_phone}` : ""}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew call times — always near top so crew finds their time immediately */}
      {crew.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Crew Call Times</SectionHeader>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#374151", width: "22%" }}>Name</th>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#374151" }}>Role</th>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#374151", width: "22%" }}>Phone</th>
                <th style={{ padding: "5px 10px", textAlign: "right", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#374151", whiteSpace: "nowrap" }}>Call Time</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "5px 10px", fontWeight: 700 }}>{m.name}</td>
                  <td style={{ padding: "5px 10px", color: "#6b7280" }}>{m.role}</td>
                  <td style={{ padding: "5px 10px", color: "#9ca3af", fontSize: 9 }}>{m.phone || "—"}</td>
                  <td style={{ padding: "5px 10px", fontFamily: "monospace", fontWeight: 900, textAlign: "right", color: "#111", whiteSpace: "nowrap" }}>
                    {to12h(m.callTime || formData.callTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run of Show */}
      {(sheet.runOfShow ?? []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Run of Show</SectionHeader>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#111", color: "#fff" }}>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", whiteSpace: "nowrap", width: 140 }}>Time</th>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Artist / Act</th>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", width: 90 }}>Stage</th>
                <th style={{ padding: "5px 10px", textAlign: "left", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(sheet.runOfShow ?? []).map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "5px 10px", fontFamily: "monospace", fontWeight: 900, whiteSpace: "nowrap", color: "#111" }}>
                    {to12h(item.setTime)}{item.endTime ? ` – ${to12h(item.endTime)}` : ""}
                  </td>
                  <td style={{ padding: "5px 10px", fontWeight: 700 }}>{item.artist}</td>
                  <td style={{ padding: "5px 10px", color: "#6b7280" }}>{item.stage || "—"}</td>
                  <td style={{ padding: "5px 10px", color: "#9ca3af", fontSize: 9 }}>{item.notes || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coverage assignments — call time also shown in each card header */}
      {sheet.coverage.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Coverage Assignments</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: sheet.coverage.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 8 }}>
            {sheet.coverage.map((c, i) => {
              const member = crew.find((m) => m.name.toLowerCase() === c.person.toLowerCase());
              const callTime = to12h(c.callTime || member?.callTime || formData.callTime);
              return (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ background: "#111", color: "#fff", padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 800, margin: 0 }}>{c.person}</p>
                      <p style={{ fontSize: 9, color: "#9ca3af", margin: "2px 0 0" }}>{c.role}</p>
                      {c.equipment && <p style={{ fontSize: 9, color: "#d4a853", margin: "2px 0 0" }}>{c.equipment}</p>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                      <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6b7280", margin: "0 0 2px" }}>CALL</p>
                      <p style={{ fontSize: 13, fontWeight: 900, fontFamily: "monospace", color: "#fff", margin: 0 }}>{callTime}</p>
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    {c.responsibilities.map((r, j) => (
                      <div key={j} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                        <span style={{ color: "#6b7280", flexShrink: 0, marginTop: 1 }}>•</span>
                        <p style={{ fontSize: 10, color: "#374151", margin: 0, lineHeight: 1.5 }}>{r}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Static cameras */}
      {sheet.staticCameras.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Static / Mounted Cameras</SectionHeader>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <tbody>
              {sheet.staticCameras.map((cam, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#f9fafb" : "#fff" }}>
                  <td style={{ padding: "5px 10px", fontWeight: 700, whiteSpace: "nowrap", width: "28%" }}>{cam.name}</td>
                  <td style={{ padding: "5px 10px", color: "#6b7280" }}>{cam.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Key moments */}
      {sheet.keyMoments.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionHeader>Key Moments</SectionHeader>
          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginBottom: 6, fontSize: 8, color: "#6b7280" }}>
            {([ ["pre", "Pre-Show"], ["during", "During"], ["post", "Post-Show"], ["logistics", "Logistics"] ] as const).map(([type, label]) => (
              <span key={type} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: MOMENT_DOT[type], display: "inline-block", flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <tbody>
              {sheet.keyMoments.map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6", background: "#fff" }}>
                  <td style={{ padding: "5px 10px", verticalAlign: "top", width: "28%" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: MOMENT_DOT[m.type] ?? "#9ca3af", display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontWeight: 800 }}>{m.label}</span>
                    </span>
                  </td>
                  <td style={{ padding: "5px 10px", color: "#374151", verticalAlign: "top" }}>{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formData.directorNote && (
        <div style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #111", borderRadius: 4, padding: "8px 12px", marginBottom: 12 }}>
          <p style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#9ca3af", margin: "0 0 4px" }}>Director's Note</p>
          <p style={{ fontSize: 10, lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>{formData.directorNote}</p>
        </div>
      )}

      <PrintFooter formData={formData} />
    </div>
  );
}

// ─── Universal PrintSheet dispatcher ─────────────────────────────────────────

function PrintSheet(props: {
  project: Project; profile: any; formData: FormData; crew: CrewWithCall[];
  locations: LocationWithParking[]; sheet: GeneratedSheet; clientLogoUrl?: string;
}) {
  if (props.sheet.format === "live_event") {
    return <LiveEventPrintSheet {...props} sheet={props.sheet} />;
  }
  return <ScriptedPrintSheet {...props} sheet={props.sheet as ScriptedSheet} />;
}

// ─── Inline editor for scripted schedule ─────────────────────────────────────

function ScriptedEditor({ sheet, onChange, formData, onFormDataChange, locations, onLocationsChange, crew, onCrewChange }: {
  sheet: ScriptedSheet | InterviewSheet; onChange: (s: GeneratedSheet) => void;
  formData: FormData; onFormDataChange: (f: FormData) => void;
  locations: LocationWithParking[]; onLocationsChange: (l: LocationWithParking[]) => void;
  crew: CrewWithCall[]; onCrewChange: (c: CrewWithCall[]) => void;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<ScheduleItem | null>(null);

  function startEdit(i: number) { setEditIdx(i); setDraft({ ...sheet.schedule[i] }); }
  function cancelEdit() { setEditIdx(null); setDraft(null); }
  function saveEdit() {
    if (editIdx === null || !draft) return;
    const updated = [...sheet.schedule];
    updated[editIdx] = draft;
    onChange({ ...sheet, schedule: updated });
    setEditIdx(null); setDraft(null);
  }
  function deleteRow(i: number) {
    const updated = sheet.schedule.filter((_, idx) => idx !== i);
    onChange({ ...sheet, schedule: updated });
  }

  const set = (k: keyof FormData, v: any) => onFormDataChange({ ...formData, [k]: v });

  return (
    <div className="space-y-6">
      {/* Sheet details */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Sheet Details</p>
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
              <CinematicDateInput value={formData.shootDate} onChange={(v) => set("shootDate", v)} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Crew Call</label>
              <TimeInput value={formData.callTime} onChange={(v) => set("callTime", v)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Wrap</label>
                <button onClick={() => set("wrapTime", "")} className="text-muted-foreground/30 hover:text-red-400 transition-colors" title="Remove Wrap">
                  <X className="h-3 w-3" />
                </button>
              </div>
              <TimeInput value={formData.wrapTime} onChange={(v) => set("wrapTime", v)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
            </div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Weather</label>
              <input value={formData.weather} onChange={(e) => set("weather", e.target.value)} placeholder="e.g. 72°F Sunny" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            {sheet.format === "scripted" && <>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Shoot Day</label>
                <input value={formData.shootDay} onChange={(e) => set("shootDay", e.target.value)} placeholder="e.g. Day 1 of 3" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
              <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Script Revision</label>
                <input value={formData.scriptRevision} onChange={(e) => set("scriptRevision", e.target.value)} placeholder="e.g. Blue Rev." className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            </>}
            {sheet.format === "interview" && <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Interview Subjects</label>
              <input value={formData.interviewSubjects} onChange={(e) => set("interviewSubjects", e.target.value)} placeholder="Subject names" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
            </div>}
          </div>
          <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nearest Hospital</label>
            <input value={formData.hospital} onChange={(e) => set("hospital", e.target.value)} placeholder="Hospital name — address" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Key Contact</label>
              <input value={formData.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name — Phone" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Walkie Channels</label>
              <input value={formData.walkieChannels} onChange={(e) => set("walkieChannels", e.target.value)} placeholder="e.g. CH1: Production" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
          </div>
        </div>
      </div>

      {/* Venue */}
      {locations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Locations</p>
          <div className="space-y-2">
            {locations.map((loc, idx) => (
              <div key={loc.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <input value={loc.name} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], name: e.target.value }; onLocationsChange(u); }}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                <input value={loc.address || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], address: e.target.value }; onLocationsChange(u); }}
                  placeholder="Address" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={loc.contact_name || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], contact_name: e.target.value }; onLocationsChange(u); }}
                    placeholder="Contact name" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                  <input value={loc.contact_phone || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], contact_phone: e.target.value }; onLocationsChange(u); }}
                    placeholder="Contact phone" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew call times */}
      {crew.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Crew Call Times</p>
          <div className="space-y-1.5">
            {crew.map((m, idx) => (
              <CrewEditorRow key={m.id} m={m} idx={idx} crew={crew} onCrewChange={onCrewChange} defaultCallTime={formData.callTime} />
            ))}
          </div>
        </div>
      )}

      {/* Schedule rows */}
      <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Schedule</p>
      <div className="space-y-1">
      {sheet.schedule.map((item, i) => (
        <div key={i}>
          {editIdx === i && draft ? (
            <div className="rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/5 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Time</label>
                  <TimeInput value={draft.time} onChange={(v) => setDraft({ ...draft, time: v })}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-mono [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Type</label>
                  <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as any })}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50">
                    {(["logistics","setup","shoot","break","move","wrap"] as ScheduleItem["type"][]).map((t) => (
                      <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Location</label>
                  <input value={draft.location ?? ""} onChange={(e) => setDraft({ ...draft, location: e.target.value || null })}
                    placeholder="Location or blank"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={cancelEdit} className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
                <button onClick={saveEdit} className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-bold text-black hover:bg-[#d4a853]/90 transition-colors">Save</button>
              </div>
            </div>
          ) : (
            <div className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/20 transition-colors">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ROW_DOT[item.type] ?? "#9ca3af", display: "inline-block", flexShrink: 0 }} />
              <span className="w-16 shrink-0 font-mono text-xs font-bold text-foreground">{to12h(item.time)}</span>
              <span className="min-w-0 flex-1 text-xs text-foreground">{item.label}</span>
              {item.location && <span className="text-[10px] text-muted-foreground shrink-0">{item.location}</span>}
              <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(i)} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Edit3 className="h-3 w-3" /></button>
                <button onClick={() => deleteRow(i)} className="rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><X className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
      </div>
    </div>
  );
}

// ─── Inline editor for live event ────────────────────────────────────────────

function LiveEventEditor({ sheet, onChange, crew, onCrewChange, defaultCallTime, formData, onFormDataChange, locations, onLocationsChange, projectTitle }: {
  sheet: LiveEventSheet; onChange: (s: GeneratedSheet) => void;
  crew: CrewWithCall[]; onCrewChange: (c: CrewWithCall[]) => void; defaultCallTime: string;
  formData: FormData; onFormDataChange: (f: FormData) => void;
  locations: LocationWithParking[]; onLocationsChange: (l: LocationWithParking[]) => void;
  projectTitle?: string;
}) {
  const [editCovIdx, setEditCovIdx] = useState<number | null>(null);
  const [editMomIdx, setEditMomIdx] = useState<number | null>(null);
  const [editCamIdx, setEditCamIdx] = useState<number | null>(null);
  const [covDraft, setCovDraft] = useState<CoverageAssignment | null>(null);
  const [momDraft, setMomDraft] = useState<KeyMoment | null>(null);
  const [camDraft, setCamDraft] = useState<StaticCamera | null>(null);
  const [refining, setRefining] = useState<Record<number, "tighten" | "expand" | null>>({});
  const [use24h, setUse24h] = useState(() => {
    try { return localStorage.getItem("ros_time_format") === "24"; } catch { return false; }
  });
  function toggleTimeFormat() {
    setUse24h(p => { const n = !p; try { localStorage.setItem("ros_time_format", n ? "24" : "12"); } catch {} return n; });
  }

  async function handleRefine(idx: number, mode: "tighten" | "expand", projectTitle?: string) {
    const c = sheet.coverage[idx];
    setRefining((prev) => ({ ...prev, [idx]: mode }));
    try {
      const res = await fetch("/api/call-sheet/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: c.person, role: c.role, equipment: c.equipment, responsibilities: c.responsibilities, mode, projectTitle }),
      });
      if (!res.ok) throw new Error("Refine failed");
      const { responsibilities } = await res.json();
      const updated = [...sheet.coverage];
      updated[idx] = { ...c, responsibilities };
      onChange({ ...sheet, coverage: updated });
    } catch {
      toast.error("AI refine failed — try again");
    } finally {
      setRefining((prev) => ({ ...prev, [idx]: null }));
    }
  }

  function saveCamera() {
    if (editCamIdx === null || !camDraft) return;
    const updated = [...sheet.staticCameras]; updated[editCamIdx] = camDraft;
    onChange({ ...sheet, staticCameras: updated });
    setEditCamIdx(null); setCamDraft(null);
  }

  const set = (k: keyof FormData, v: any) => onFormDataChange({ ...formData, [k]: v });

  function saveCoverage() {
    if (editCovIdx === null || !covDraft) return;
    const updated = [...sheet.coverage]; updated[editCovIdx] = covDraft;
    onChange({ ...sheet, coverage: updated });
    setEditCovIdx(null); setCovDraft(null);
  }
  function saveMoment() {
    if (editMomIdx === null || !momDraft) return;
    const updated = [...sheet.keyMoments]; updated[editMomIdx] = momDraft;
    onChange({ ...sheet, keyMoments: updated });
    setEditMomIdx(null); setMomDraft(null);
  }

  return (
    <div className="space-y-6">
      {/* Sheet details */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Sheet Details</p>
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Date</label>
              <CinematicDateInput value={formData.shootDate} onChange={(v) => set("shootDate", v)} /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">General Crew Call</label>
              <TimeInput value={formData.callTime} onChange={(v) => set("callTime", v)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            {(["doorsTime","soundCheckTime","loadInTime","showTime","wrapTime"] as const).map((field) => {
              const labels: Record<string, string> = { doorsTime: "Doors Open", soundCheckTime: "Sound Check", loadInTime: "Load-In", showTime: "Show Start", wrapTime: "Wrap" };
              return (
                <div key={field}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{labels[field]}</label>
                    <button onClick={() => set(field, "")} className="text-muted-foreground/30 hover:text-red-400 transition-colors" title={`Remove ${labels[field]}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <TimeInput value={formData[field]} onChange={(v) => set(field, v)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-mono [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                </div>
              );
            })}
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Weather</label>
              <input value={formData.weather} onChange={(e) => set("weather", e.target.value)} placeholder="e.g. 72°F Sunny" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
          </div>
          <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Nearest Hospital</label>
            <input value={formData.hospital} onChange={(e) => set("hospital", e.target.value)} placeholder="Hospital name — address" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Key Contact</label>
              <input value={formData.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} placeholder="Name — Phone" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
            <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Walkie Channels</label>
              <input value={formData.walkieChannels} onChange={(e) => set("walkieChannels", e.target.value)} placeholder="e.g. CH1: Production" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
          </div>
          <div><label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Dress Code / Credentials</label>
            <input value={formData.dresscode} onChange={(e) => set("dresscode", e.target.value)} placeholder="e.g. All black, media credentials required" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" /></div>
        </div>
      </div>

      {/* Run of Show */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Run of Show</p>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTimeFormat}
              className="flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-mono font-bold transition-colors hover:border-[#d4a853]/30"
            >
              <span className={!use24h ? "text-[#d4a853]" : "text-muted-foreground/30"}>12H</span>
              <span className="mx-1 text-muted-foreground/20">/</span>
              <span className={use24h ? "text-[#d4a853]" : "text-muted-foreground/30"}>24H</span>
            </button>
            <button
              onClick={() => onChange({ ...sheet, runOfShow: [...(sheet.runOfShow ?? []), { setTime: "", endTime: "", artist: "", duration: "", stage: "", notes: "" }] })}
              className="flex items-center gap-1 text-[11px] text-[#d4a853]/70 hover:text-[#d4a853] transition-colors"
            >
              <span className="text-base leading-none">+</span> Add Act
            </button>
          </div>
        </div>
        {(sheet.runOfShow ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-5 text-center">
            <p className="text-xs text-muted-foreground/40">No acts yet — click "+ Add Act" to build your lineup</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_90px_28px] gap-2 px-3 mb-1">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider col-span-1">Start → End</p>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Artist / Act</p>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Stage</p>
              <span />
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {(sheet.runOfShow ?? []).map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_90px_28px] gap-2 items-center px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <RosTimeInput
                      value={item.setTime}
                      use24h={use24h}
                      onChange={(v) => { const u = [...sheet.runOfShow]; u[i] = { ...u[i], setTime: v }; onChange({ ...sheet, runOfShow: u }); }}
                    />
                    <span className="text-muted-foreground/30 text-[10px] shrink-0">–</span>
                    <RosTimeInput
                      value={item.endTime ?? ""}
                      use24h={use24h}
                      onChange={(v) => { const u = [...sheet.runOfShow]; u[i] = { ...u[i], endTime: v }; onChange({ ...sheet, runOfShow: u }); }}
                    />
                  </div>
                  <input
                    value={item.artist}
                    onChange={(e) => { const u = [...sheet.runOfShow]; u[i] = { ...u[i], artist: e.target.value }; onChange({ ...sheet, runOfShow: u }); }}
                    placeholder="Artist / Act name"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
                  />
                  <input
                    value={item.stage}
                    onChange={(e) => { const u = [...sheet.runOfShow]; u[i] = { ...u[i], stage: e.target.value }; onChange({ ...sheet, runOfShow: u }); }}
                    placeholder="Stage"
                    className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50"
                  />
                  <button
                    onClick={() => { const u = [...sheet.runOfShow]; u.splice(i, 1); onChange({ ...sheet, runOfShow: u }); }}
                    className="text-muted-foreground/30 hover:text-red-400 transition-colors p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Venue */}
      {locations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Venue</p>
          <div className="space-y-2">
            {locations.map((loc, idx) => (
              <div key={loc.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <input value={loc.name} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], name: e.target.value }; onLocationsChange(u); }}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                <input value={loc.address || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], address: e.target.value }; onLocationsChange(u); }}
                  placeholder="Address" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                <div className="grid grid-cols-2 gap-1.5">
                  <input value={loc.contact_name || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], contact_name: e.target.value }; onLocationsChange(u); }}
                    placeholder="Contact name" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                  <input value={loc.contact_phone || ""} onChange={(e) => { const u = [...locations]; u[idx] = { ...u[idx], contact_phone: e.target.value }; onLocationsChange(u); }}
                    placeholder="Contact phone" className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crew call times — editable inline */}
      {crew.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Crew Call Times</p>
          <div className="space-y-1.5">
            {crew.map((m, idx) => (
              <CrewEditorRow
                key={m.id} m={m} idx={idx} crew={crew} onCrewChange={onCrewChange} defaultCallTime={defaultCallTime}
                onNameChange={(oldName, newName) => {
                  const updatedCoverage = sheet.coverage.map((c) =>
                    c.person.toLowerCase() === oldName.toLowerCase() ? { ...c, person: newName } : c
                  );
                  onChange({ ...sheet, coverage: updatedCoverage });
                }}
                onCallTimeChange={(personName, callTime) => {
                  const updatedCoverage = sheet.coverage.map((c) =>
                    c.person.toLowerCase() === personName.toLowerCase() ? { ...c, callTime } : c
                  );
                  onChange({ ...sheet, coverage: updatedCoverage });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Coverage */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Coverage Assignments</p>
        <div className="space-y-2">
          {sheet.coverage.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-start justify-between bg-muted/30 px-4 py-2.5">
                <div>
                  <p className="text-sm font-bold text-foreground">{c.person}</p>
                  <p className="text-xs text-muted-foreground">{c.role}</p>
                  {c.equipment && <p className="text-xs text-[#d4a853]">{c.equipment}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => handleRefine(i, "tighten", projectTitle)}
                    disabled={!!refining[i]}
                    title="Make concise"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition-colors"
                  >
                    {refining[i] === "tighten" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Minimize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => handleRefine(i, "expand", projectTitle)}
                    disabled={!!refining[i]}
                    title="Make detailed"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 transition-colors"
                  >
                    {refining[i] === "expand" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => { setEditCovIdx(i); setCovDraft({ ...c, responsibilities: [...c.responsibilities] }); }}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {editCovIdx === i && covDraft ? (
                <div className="px-4 py-3 space-y-2 border-t border-border bg-[#d4a853]/5">
                  <div className="grid grid-cols-2 gap-2">
                    {["person","role","equipment"].map((f) => (
                      <input key={f} value={(covDraft as any)[f]} onChange={(e) => setCovDraft({ ...covDraft, [f]: e.target.value })}
                        placeholder={f} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50 col-span-1" />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {covDraft.responsibilities.map((r, j) => (
                      <div key={j} className="flex gap-2">
                        <input value={r} onChange={(e) => { const rs = [...covDraft.responsibilities]; rs[j] = e.target.value; setCovDraft({ ...covDraft, responsibilities: rs }); }}
                          className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                        <button onClick={() => { const rs = covDraft.responsibilities.filter((_, k) => k !== j); setCovDraft({ ...covDraft, responsibilities: rs }); }}
                          className="text-muted-foreground hover:text-red-400 transition-colors"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <button onClick={() => setCovDraft({ ...covDraft, responsibilities: [...covDraft.responsibilities, ""] })}
                      className="text-xs text-[#d4a853] hover:underline">+ Add responsibility</button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditCovIdx(null); setCovDraft(null); }} className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">Cancel</button>
                    <button onClick={saveCoverage} className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-bold text-black">Save</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2.5 space-y-1">
                  {c.responsibilities.map((r, j) => (
                    <div key={j} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">•</span><span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Static cameras */}
      {sheet.staticCameras.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Static / Mounted Cameras</p>
          <div className="space-y-1.5">
            {sheet.staticCameras.map((cam, i) => (
              <div key={i}>
                {editCamIdx === i && camDraft ? (
                  <div className="rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/5 p-3 space-y-2">
                    <input value={camDraft.name} onChange={(e) => setCamDraft({ ...camDraft, name: e.target.value })} placeholder="Camera name"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                    <input value={camDraft.role} onChange={(e) => setCamDraft({ ...camDraft, role: e.target.value })} placeholder="Position and purpose"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditCamIdx(null); setCamDraft(null); }} className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">Cancel</button>
                      <button onClick={saveCamera} className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-bold text-black">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-2.5 hover:border-border/80 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{cam.name}</p>
                      <p className="text-xs text-muted-foreground">{cam.role}</p>
                    </div>
                    <button onClick={() => { setEditCamIdx(i); setCamDraft({ ...cam }); }}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-all">
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key moments */}
      {sheet.keyMoments.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Key Moments</p>
          <div className="space-y-1">
            {sheet.keyMoments.map((m, i) => (
              <div key={i}>
                {editMomIdx === i && momDraft ? (
                  <div className="rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/5 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={momDraft.label} onChange={(e) => setMomDraft({ ...momDraft, label: e.target.value })} placeholder="Label"
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                      <select value={momDraft.type} onChange={(e) => setMomDraft({ ...momDraft, type: e.target.value as any })}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50">
                        {(["pre","during","post","logistics"] as KeyMoment["type"][]).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <input value={momDraft.description} onChange={(e) => setMomDraft({ ...momDraft, description: e.target.value })} placeholder="Description"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setEditMomIdx(null); setMomDraft(null); }} className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent">Cancel</button>
                      <button onClick={saveMoment} className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-bold text-black">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/20 transition-colors">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: MOMENT_DOT[m.type] ?? "#9ca3af", marginTop: 4, display: "inline-block", flexShrink: 0 }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.description}</p>
                    </div>
                    <button onClick={() => { setEditMomIdx(i); setMomDraft({ ...m }); }}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-accent transition-all">
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ n, current, total }: { n: number; current: number; total: number }) {
  const done = current > n;
  const active = current === n;
  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all
      ${done ? "bg-emerald-500 text-white" : active ? "bg-[#d4a853] text-black" : "bg-muted text-muted-foreground"}`}>
      {done ? <Check className="h-3 w-3" /> : n}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CallSheetGenerator({ project, onClose, initialSheetId }: { project: Project; onClose: () => void; initialSheetId?: string }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(initialSheetId ? 1 : 1);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sheet, setSheet] = useState<GeneratedSheet | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [crew, setCrew] = useState<CrewWithCall[]>([]);
  const [locations, setLocations] = useState<LocationWithParking[]>([]);
  const [shotItems, setShotItems] = useState<ShotListItem[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [savedSheetId, setSavedSheetId] = useState<string | null>(initialSheetId ?? null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingSheets, setExistingSheets] = useState<SavedCallSheet[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<FormData>({
    format: (project.type === "live_event" ? "live_event" : project.type === "documentary" || project.type === "podcast" ? "interview" : "scripted") as CallSheetFormat,
    shootDate: "",
    callTime: "18:00",
    wrapTime: "02:00",
    hospital: "",
    weather: "",
    confidential: false,
    directorNote: "",
    emergencyContact: "",
    walkieChannels: "",
    doorsTime: "",
    soundCheckTime: "",
    showTime: "",
    loadInTime: "",
    shootDay: "",
    scriptRevision: "",
    interviewSubjects: "",
    dresscode: "",
  });

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    async function load() {
      try {
        const [crewData, locData, shotListData, profileData, sheetsRes] = await Promise.all([
          getCrewContacts(project.id),
          getProjectLocations(project.id),
          getShotLists(project.id),
          getProfile(),
          fetch(`/api/call-sheets?project_id=${project.id}`).then((r) => r.json()),
        ]);
        const freshCrew = crewData.map((c) => ({ ...c, callTime: "" }));
        const freshLocs = locData.map((l) => ({ ...l, parkingNotes: "" }));
        setCrew(freshCrew);
        setLocations(freshLocs);
        const items = (shotListData[0] as any)?.shot_list_items ?? (shotListData[0] as any)?.items ?? [];
        setShotItems(items);
        setProfile(profileData);

        const sheets: SavedCallSheet[] = Array.isArray(sheetsRes) ? sheetsRes : [];
        setExistingSheets(sheets);

        if (initialSheetId) {
          // Load specific sheet passed in (e.g. from ProductionDocsTab card)
          const res = await fetch(`/api/call-sheets/${initialSheetId}`);
          if (res.ok) {
            const saved = await res.json();
            restoreFromSaved(saved, freshCrew, freshLocs);
          }
        } else if (sheets.length > 0 && !initialSheetId) {
          // Show selection screen
          setStep(0);
        }
      } catch { toast.error("Failed to load project data"); }
      finally { setLoading(false); }
    }
    load();
  }, [project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function restoreFromSaved(saved: any, freshCrew?: CrewWithCall[], freshLocs?: LocationWithParking[]) {
    const d = saved.data ?? {};
    if (d.sheet) setSheet(d.sheet);
    if (d.crew) setCrew(d.crew);
    else if (freshCrew) setCrew(freshCrew);
    if (d.locations) setLocations(d.locations);
    else if (freshLocs) setLocations(freshLocs);
    if (d.formData) setFormData(d.formData);
    setSavedSheetId(saved.id);
    setSavedAt(new Date(saved.updated_at));
    setStep(5);
  }

  // Auto-save while editing step 5
  useEffect(() => {
    if (step !== 5 || !sheet) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { autoSave(false); }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [sheet, crew, locations, formData, step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function autoSave(immediate: boolean, overrideSheet?: GeneratedSheet) {
    const currentSheet = overrideSheet ?? sheet;
    if (!currentSheet) return;
    if (saveTimerRef.current && !immediate) clearTimeout(saveTimerRef.current);
    setSaving(true);
    const shootDate = formData.shootDate || null;
    const dateLabel = shootDate
      ? new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null;
    const title = dateLabel ? `Call Sheet — ${dateLabel}` : "Call Sheet";
    const payload = { title, shoot_date: shootDate, data: { sheet: currentSheet, crew, locations, formData } };
    try {
      if (savedSheetId) {
        await fetch(`/api/call-sheets/${savedSheetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/call-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: project.id, ...payload }),
        });
        const created = await res.json();
        if (created.id) setSavedSheetId(created.id);
      }
      setSavedAt(new Date());
    } catch { /* silent — PDF still works */ }
    finally { setSaving(false); }
  }

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/call-sheet/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, shotItems, crew, locations, formData }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setSheet(data);
      setStep(5);
      // Save immediately on first generate
      await autoSave(true, data);
    } catch { toast.error("Failed to generate call sheet — try again"); }
    finally { setGenerating(false); }
  };

  const handleSavePDF = async () => {
    if (!sheet) return;
    setPdfLoading(true);
    try {
      // Strip to only the fields CSProject/CSProfile need — project.thumbnail_url can be a
      // multi-MB base64 string that causes a 413 if the full object is sent
      const pdfProject = { id: project.id, title: project.title, client_name: project.client_name ?? null, client_logo_url: project.client_logo_url ?? null };
      const pdfProfile = profile ? { first_name: profile.first_name, last_name: profile.last_name, business_name: profile.business_name, logo_url: profile.logo_url } : null;
      const res = await fetch("/api/call-sheet/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: pdfProject, profile: pdfProfile, formData, crew, locations, sheet }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({ error: `Server error ${res.status}` })); throw new Error(err.error || `PDF generation failed (${res.status})`); }
      const blob = await res.blob();
      const filename = `call-sheet-${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;

      // Web Share API (iOS 15+ / Android Chrome 89+): native share sheet lets users
      // save to Files app on iOS or trigger a download on Android
      const file = new File([blob], filename, { type: "application/pdf" });
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          toast.success("PDF shared — tap 'Save to Files' to keep it on your device");
          return;
        } catch (shareErr: any) {
          // User cancelled share — not an error
          if (shareErr?.name === "AbortError") return;
          // Share failed (shouldn't happen), fall through to download
        }
      }

      // Desktop / older iOS fallback: anchor download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      toast.success("Call sheet downloaded");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) { toast.error(err.message ?? "Failed to generate PDF"); }
    finally { setPdfLoading(false); }
  };

  const handleDone = async () => {
    await autoSave(true);
    onClose();
    toast.success("Call sheet saved — find it in Production → Call Sheets");
  };

  const handlePrint = () => {
    const portalEl = document.getElementById("call-sheet-print-portal");
    if (!portalEl) { toast.error("No call sheet to print"); return; }
    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) { toast.error("Allow popups to print"); return; }
    printWin.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Call Sheet — ${project.title}</title>
      <style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 28px; color: #111; background: #fff; } @media print { body { padding: 20px; } @page { margin: 12mm; } } img { max-width: 100%; } table { border-collapse: collapse; }</style>
    </head><body>${portalEl.innerHTML}<script>setTimeout(()=>{window.print();},350);<\/script></body></html>`);
    printWin.document.close();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-[#d4a853]" /><p className="text-sm text-muted-foreground">Loading project data…</p></div>
      </div>
    );
  }

  return (
    <>
      <div className="csg-modal fixed inset-0 z-50 flex flex-col bg-background">
        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
              <FileText className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Call Sheet Generator</h2>
              <p className="text-[11px] text-muted-foreground">{project.title}</p>
            </div>
            {step < 5 && (
              <div className="ml-4 hidden items-center gap-2 sm:flex">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <StepDot n={n} current={step} total={4} />
                    {n < 4 && <div className={`h-px w-6 ${step > n ? "bg-emerald-500" : "bg-border"}`} />}
                  </div>
                ))}
              </div>
            )}
            {step === 5 && sheet && (
              <span className={`ml-3 hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold sm:inline-block ${
                sheet.format === "live_event" ? "border-blue-400/30 bg-blue-400/10 text-blue-400" :
                sheet.format === "interview" ? "border-purple-400/30 bg-purple-400/10 text-purple-400" :
                "border-[#d4a853]/30 bg-[#d4a853]/10 text-[#d4a853]"
              }`}>
                {sheet.format === "live_event" ? "Live Event" : sheet.format === "interview" ? "Interview" : "Scripted"} Format
              </span>
            )}
            {step === 5 && (
              <span className="ml-2 hidden sm:block text-[10px] text-muted-foreground/60">
                {saving ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          {step === 0 && (
            <div className="mx-auto max-w-lg px-6 py-8 space-y-4">
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">Call Sheets</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Pick an existing sheet to edit, or create a new one.</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[#d4a853]/30 bg-[#d4a853]/5 px-4 py-3 text-left hover:border-[#d4a853]/60 hover:bg-[#d4a853]/10 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d4a853]/15">
                  <FileText className="h-4 w-4 text-[#d4a853]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">New Call Sheet</p>
                  <p className="text-[11px] text-muted-foreground">Start the wizard for a new shoot day</p>
                </div>
              </button>
              <div className="space-y-2">
                {existingSheets.map((s) => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch(`/api/call-sheets/${s.id}`);
                        if (res.ok) { const saved = await res.json(); restoreFromSaved(saved); }
                      } finally { setLoading(false); }
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-accent transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Last edited {new Date(s.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 1 && <Step1 formData={formData} onChange={setFormData} />}
          {step === 2 && <Step2 locations={locations} onChange={setLocations} onHospitalFound={(h) => setFormData((f) => ({ ...f, hospital: f.hospital || h }))} />}
          {step === 3 && <Step3 crew={crew} formData={formData} onChange={setCrew} />}
          {step === 4 && <Step4 formData={formData} onChange={setFormData} shotCount={shotItems.length} crewCount={crew.length} />}
          {step === 5 && sheet && (
            <div className="flex flex-col md:flex-row h-full">
              {/* Mobile toggle */}
              <div className="flex md:hidden shrink-0 border-b border-border">
                <button
                  onClick={() => setMobileView("edit")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${mobileView === "edit" ? "border-b-2 border-[#d4a853] text-foreground" : "text-muted-foreground"}`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setMobileView("preview")}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${mobileView === "preview" ? "border-b-2 border-[#d4a853] text-foreground" : "text-muted-foreground"}`}
                >
                  Preview
                </button>
              </div>
              {/* Left: editable source */}
              <div className={`md:w-1/2 md:border-r border-border overflow-y-auto p-5 ${mobileView === "edit" ? "flex-1 md:flex-none" : "hidden md:block"}`}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Edit</p>
                    <p className="text-[11px] text-muted-foreground">Click any row to edit before printing.</p>
                  </div>
                  <button onClick={() => setStep(4)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Regenerate</button>
                </div>
                {sheet.warning && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{sheet.warning}
                  </div>
                )}
                {sheet.format === "live_event"
                  ? <LiveEventEditor sheet={sheet} onChange={setSheet} crew={crew} onCrewChange={setCrew} defaultCallTime={formData.callTime} formData={formData} onFormDataChange={setFormData} locations={locations} onLocationsChange={setLocations} projectTitle={project.title} />
                  : <ScriptedEditor sheet={sheet as ScriptedSheet} onChange={setSheet} formData={formData} onFormDataChange={setFormData} locations={locations} onLocationsChange={setLocations} crew={crew} onCrewChange={setCrew} />
                }
              </div>
              {/* Right: live preview */}
              <div className={`md:w-1/2 overflow-y-auto bg-zinc-100 p-5 ${mobileView === "preview" ? "flex-1 md:flex-none" : "hidden md:block"}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Preview</p>
                  <button
                    onClick={handleSavePDF}
                    disabled={pdfLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-bold text-black hover:bg-[#d4a853]/90 disabled:opacity-50 transition-colors"
                  >
                    {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3 sm:hidden" />}
                    {!pdfLoading && <Download className="h-3 w-3 hidden sm:block" />}
                    {pdfLoading ? "Generating…" : "Save PDF"}
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-white shadow-lg p-6">
                  <PrintSheet
                    project={project} profile={profile} formData={formData}
                    crew={crew} locations={locations} sheet={sheet}
                    clientLogoUrl={project.client_logo_url}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="no-print shrink-0 flex items-center justify-between border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          <button
            onClick={step === 0 || step === 1 ? onClose : step === 5 && existingSheets.length > 0 ? () => setStep(0) : () => setStep((s) => (s > 1 ? (s - 1) as any : 1))}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 || step === 1 ? "Cancel" : step === 5 && existingSheets.length > 0 ? "All Sheets" : "Back"}
          </button>
          {step > 0 && step < 4 && (
            <button onClick={() => setStep((s) => (s > 0 && s < 4 ? (s + 1) as any : 4))}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-5 py-2 text-sm font-bold text-black hover:bg-[#d4a853]/90 transition-colors">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          )}
          {step === 4 && (
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-5 py-2 text-sm font-bold text-black hover:bg-[#d4a853]/90 disabled:opacity-50 transition-colors">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : "Generate Call Sheet"}
            </button>
          )}
          {step === 5 && (
            <div className="flex items-center gap-2">
              {/* Print — desktop only, not useful on mobile */}
              <button onClick={handlePrint}
                className="hidden sm:flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors">
                <Printer className="h-4 w-4" /> Print
              </button>
              <button onClick={handleSavePDF} disabled={pdfLoading}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border px-3 sm:px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors">
                {pdfLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Generating…</span></>
                  : <><Share2 className="h-4 w-4 sm:hidden" /><FileText className="h-4 w-4 hidden sm:block" /><span>Save PDF</span></>}
              </button>
              <button onClick={handleDone}
                className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 sm:px-5 py-2 text-sm font-bold text-black hover:bg-[#d4a853]/90 transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {isMounted && sheet && createPortal(
        <div id="call-sheet-print-portal">
          <PrintSheet project={project} profile={profile} formData={formData} crew={crew} locations={locations} sheet={sheet} clientLogoUrl={project.client_logo_url} />
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Step 1: Format + Shoot Basics ───────────────────────────────────────────

const FORMAT_OPTIONS: { value: CallSheetFormat; label: string; icon: React.ElementType; desc: string }[] = [
  { value: "scripted",   label: "Scripted",    icon: Film,   desc: "Sequential time-blocked schedule — commercials, narrative, music video" },
  { value: "live_event", label: "Live Event",  icon: Radio,  desc: "Coverage-based by person — concerts, shows, simultaneous multi-cam" },
  { value: "interview",  label: "Interview",   icon: Mic2,   desc: "Subject-based schedule — documentaries, podcasts, sit-downs" },
];

function Step1({ formData, onChange }: { formData: FormData; onChange: (f: FormData) => void }) {
  const set = (k: keyof FormData, v: any) => onChange({ ...formData, [k]: v });
  return (
    <div className="mx-auto max-w-xl px-6 py-8 space-y-6">
      {/* Format selector */}
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Call Sheet Format</h3>
        <p className="mt-0.5 mb-4 text-xs text-muted-foreground">Choose the format that matches your production — it determines how the schedule is structured.</p>
        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = formData.format === opt.value;
            return (
              <button key={opt.value} type="button" onClick={() => set("format", opt.value)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${active ? "border-[#d4a853]/60 bg-[#d4a853]/5" : "border-border bg-card hover:border-[#d4a853]/30"}`}>
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all ${active ? "border-[#d4a853]/40 bg-[#d4a853]/15 text-[#d4a853]" : "border-border bg-muted/30 text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${active ? "text-[#d4a853]" : "text-foreground"}`}>{opt.label}</p>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 text-[#d4a853]" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shoot Details */}
      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold text-foreground">Shoot Details</h3>
        <Field label="Shoot Date" required>
          <CinematicDateInput value={formData.shootDate} onChange={(v) => set("shootDate", v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="General Crew Call" required>
            <TimeInput value={formData.callTime} onChange={(v) => set("callTime", v)} className="input-style [color-scheme:dark]" />
          </Field>
          <Field label="Wrap Time" required>
            <TimeInput value={formData.wrapTime} onChange={(v) => set("wrapTime", v)} className="input-style [color-scheme:dark]" />
          </Field>
        </div>

        {/* Live event: sound check + doors + show time (chronological order) */}
        {formData.format === "live_event" && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Sound Check">
              <TimeInput value={formData.soundCheckTime} onChange={(v) => set("soundCheckTime", v)} className="input-style [color-scheme:dark]" />
            </Field>
            <Field label="Doors Open">
              <TimeInput value={formData.doorsTime} onChange={(v) => set("doorsTime", v)} className="input-style [color-scheme:dark]" />
            </Field>
            <Field label="Show Start">
              <TimeInput value={formData.showTime} onChange={(v) => set("showTime", v)} className="input-style [color-scheme:dark]" />
            </Field>
          </div>
        )}

        {/* Scripted / Interview: shoot day + revision */}
        {(formData.format === "scripted" || formData.format === "interview") && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shoot Day" hint="e.g. Day 3 of 15">
              <input placeholder="Day 1 of 5" value={formData.shootDay} onChange={(e) => set("shootDay", e.target.value)} className="input-style" />
            </Field>
            {formData.format === "scripted" && (
              <Field label="Script Revision">
                <select value={formData.scriptRevision} onChange={(e) => set("scriptRevision", e.target.value)} className="input-style">
                  <option value="">— None —</option>
                  <option value="White">White</option>
                  <option value="Blue Rev.">Blue Rev.</option>
                  <option value="Pink Rev.">Pink Rev.</option>
                  <option value="Yellow Rev.">Yellow Rev.</option>
                  <option value="Green Rev.">Green Rev.</option>
                  <option value="Goldenrod Rev.">Goldenrod Rev.</option>
                  <option value="Buff Rev.">Buff Rev.</option>
                  <option value="Salmon Rev.">Salmon Rev.</option>
                  <option value="Cherry Rev.">Cherry Rev.</option>
                  <option value="Double White">Double White</option>
                </select>
              </Field>
            )}
          </div>
        )}

        {/* Interview: subjects */}
        {formData.format === "interview" && (
          <Field label="Interview Subject(s)" hint="Who is being interviewed">
            <input placeholder="e.g. Jane Smith, John Doe" value={formData.interviewSubjects} onChange={(e) => set("interviewSubjects", e.target.value)} className="input-style" />
          </Field>
        )}

        <Field label="Weather" hint="Brief forecast for crew">
          <input placeholder="e.g. Sunny, 78°F — light breeze expected" value={formData.weather} onChange={(e) => set("weather", e.target.value)} className="input-style" />
        </Field>
        <Field label="Nearest Hospital" hint="Always verify before distributing">
          <input placeholder="e.g. Cedars-Sinai Medical Center, 8700 Beverly Blvd" value={formData.hospital} onChange={(e) => set("hospital", e.target.value)} className="input-style" />
        </Field>
        <Field label="Key Contact" hint="1st AD, producer, or main point of contact">
          <input placeholder="e.g. Jane Smith (1st AD) — 310-555-0100" value={formData.emergencyContact} onChange={(e) => set("emergencyContact", e.target.value)} className="input-style" />
        </Field>
        <Field label="Walkie Channels" hint="Radio channel assignments for departments">
          <input placeholder="e.g. Ch.1 — AD / Ch.2 — Camera / Ch.3 — Sound" value={formData.walkieChannels} onChange={(e) => set("walkieChannels", e.target.value)} className="input-style" />
        </Field>
        <Field label="Dress Code / Credentials" hint="Attire requirements or access badge instructions">
          <input placeholder="e.g. All black attire, media credentials required" value={formData.dresscode} onChange={(e) => set("dresscode", e.target.value)} className="input-style" />
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4">
          <input type="checkbox" checked={formData.confidential} onChange={(e) => set("confidential", e.target.checked)} className="h-4 w-4 rounded accent-[#d4a853]" />
          <div>
            <p className="text-sm font-medium text-foreground">Mark as Confidential</p>
            <p className="text-xs text-muted-foreground">Adds a CONFIDENTIAL watermark — for NDAs and unreleased work</p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ─── Step 2: Locations ────────────────────────────────────────────────────────

function Step2({ locations, onChange, onHospitalFound }: {
  locations: LocationWithParking[];
  onChange: (l: LocationWithParking[]) => void;
  onHospitalFound: (hospital: string) => void;
}) {
  const [lookingUp, setLookingUp] = useState<string | null>(null);

  async function handleLookup(loc: LocationWithParking, i: number) {
    setLookingUp(loc.id);
    try {
      const res = await fetch("/api/call-sheet/venue-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueName: loc.name }),
      });
      const data = await res.json();
      if (data.address) {
        const u = [...locations];
        u[i] = { ...u[i], address: data.address } as LocationWithParking;
        onChange(u);
        toast.success(`Address found for ${loc.name}`);
      } else {
        toast.error("Couldn't find address — enter it manually");
      }
      if (data.nearestHospital) {
        onHospitalFound(data.nearestHospital);
        toast.success("Nearest hospital auto-filled");
      }
    } catch {
      toast.error("Lookup failed — check your connection");
    } finally {
      setLookingUp(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8 space-y-5">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Locations</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Pre-filled from your project. Use "Find Address" to auto-fill the address and nearest hospital.</p>
      </div>
      {locations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No locations saved on this project — add them in the Locations tab.</div>
      )}
      {locations.map((loc, i) => (
        <div key={loc.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d4a853]" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{loc.name}</p>
                {loc.address && <p className="text-xs text-muted-foreground">{loc.address}</p>}
                {loc.contact_name && <p className="text-xs text-muted-foreground">Contact: {loc.contact_name}{loc.contact_phone ? ` · ${loc.contact_phone}` : ""}</p>}
              </div>
            </div>
            <button
              onClick={() => handleLookup(loc, i)}
              disabled={lookingUp === loc.id}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {lookingUp === loc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
              {lookingUp === loc.id ? "Looking up…" : "Find Address"}
            </button>
          </div>
          <Field label="Parking / Load-In Notes">
            <input placeholder="e.g. Artist Parking — 2 spots under Telykast name" value={loc.parkingNotes}
              onChange={(e) => { const u = [...locations]; u[i] = { ...u[i], parkingNotes: e.target.value }; onChange(u); }}
              className="input-style" />
          </Field>
        </div>
      ))}
    </div>
  );
}

// ─── Step 3: Crew Call Times ──────────────────────────────────────────────────

function Step3({ crew, formData, onChange }: { crew: CrewWithCall[]; formData: FormData; onChange: (c: CrewWithCall[]) => void }) {
  const deptMap = groupByDept(crew);
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Crew Call Times</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Default is general call ({to12h(formData.callTime)}). Adjust per person as needed.</p>
      </div>
      {crew.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No crew saved — add them in the Crew tab.</div>
      )}
      {Array.from(deptMap.entries()).map(([dept, members]) => (
        <div key={dept}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{dept}</p>
          <div className="space-y-2">
            {members.map((m) => {
              const idx = crew.findIndex((c) => c.id === m.id);
              return (
                <div key={m.id} className="rounded-xl border border-border bg-card px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d4a853]/10 text-[10px] font-bold text-[#d4a853]">{m.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <div className="shrink-0">
                      <TimeInput value={m.callTime || formData.callTime}
                        onChange={(v) => { const u = [...crew]; u[idx] = { ...u[idx], callTime: v }; onChange(u); }} />
                    </div>
                  </div>
                  <input
                    value={m.phone ?? ""}
                    onChange={(e) => { const u = [...crew]; u[idx] = { ...u[idx], phone: e.target.value }; onChange(u); }}
                    placeholder="Phone number"
                    className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground placeholder:text-muted-foreground/40 focus:border-[#d4a853]/50 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step 4: Notes + Confirm ──────────────────────────────────────────────────

function Step4({ formData, onChange, shotCount, crewCount }: { formData: FormData; onChange: (f: FormData) => void; shotCount: number; crewCount: number }) {
  const formatLabel = FORMAT_OPTIONS.find((f) => f.value === formData.format)?.label ?? formData.format;
  return (
    <div className="mx-auto max-w-xl px-6 py-8 space-y-5">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">Director's Note</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Optional message to the crew — printed on the call sheet.</p>
      </div>
      <textarea rows={4} placeholder="e.g. Tonight is all about authentic moments. Let the energy of the crowd guide you — no over-directing."
        value={formData.directorNote} onChange={(e) => onChange({ ...formData, directorNote: e.target.value })}
        className="input-style w-full resize-none" />
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ready to generate</p>
        {[
          { icon: Film, label: `${formatLabel} format call sheet` },
          { icon: Calendar, label: `${formData.shootDate || "No date set"} · ${to12h(formData.callTime)} → ${to12h(formData.wrapTime)}` },
          { icon: MapPin, label: "Locations pulled from project" },
          { icon: Users, label: `${crewCount} crew member${crewCount !== 1 ? "s" : ""}` },
          { icon: Clock, label: `${shotCount} shot${shotCount !== 1 ? "s" : ""} in shot list` },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-foreground">
            <Icon className="h-4 w-4 shrink-0 text-[#d4a853]" />{label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Field ─────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium text-foreground">
        {label}{required && <span className="text-[#d4a853]">*</span>}
        {hint && <span className="ml-1 font-normal text-muted-foreground">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
