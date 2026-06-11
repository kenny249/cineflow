"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, CalendarDays, Clock, MapPin, Trash2, ChevronDown,
  Printer, X, Film, Users, ListChecks, Loader2, Pencil, Check, AlarmClock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ShotListItem, ProjectCollaborator, CrewCall, DroneEquipment } from "@/types";
import { DroneIcon } from "@/components/icons/DroneIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShootDay {
  id: string;
  project_id: string;
  day_number: number;
  date?: string;
  general_call?: string;
  location?: string;
  notes?: string;
  created_at: string;
}

interface CrewMember {
  id: string;
  name: string;
  role: string;
  department?: string;
  phone?: string;
  email?: string;
}

interface ShootDaysPanelProps {
  projectId: string;
  projectTitle: string;
  clientLogoUrl?: string | null;
  shots: ShotListItem[];
  onShotsUpdated: (shots: ShotListItem[]) => void;
  canEdit: boolean;
}

// ─── Call Sheet Modal ─────────────────────────────────────────────────────────

function CallSheetModal({
  day,
  projectTitle,
  clientLogoUrl,
  shots,
  crew,
  crewCalls,
  onClose,
}: {
  day: ShootDay;
  projectTitle: string;
  clientLogoUrl?: string | null;
  shots: ShotListItem[];
  crew: CrewMember[];
  crewCalls: CrewCall[];
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Call Sheet — ${projectTitle} Day ${day.day_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #18181b; background: #fff; padding: 24px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
          .subtitle { font-size: 13px; font-weight: 600; color: #71717a; margin-top: 2px; }
          .badge { background: #18181b; color: #d4a853; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px; }
          .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
          .meta-card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; }
          .meta-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; margin-bottom: 3px; }
          .meta-value { font-size: 13px; font-weight: 600; color: #18181b; }
          h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; margin: 16px 0 8px; border-bottom: 1px solid #f4f4f5; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #a1a1aa; padding: 6px 8px; border-bottom: 1px solid #e4e4e7; }
          td { padding: 7px 8px; border-bottom: 1px solid #f4f4f5; font-size: 11px; color: #18181b; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .shot-num { font-weight: 700; font-family: monospace; }
          .tag { display: inline-block; background: #f4f4f5; border-radius: 4px; padding: 1px 6px; font-size: 9px; font-weight: 600; margin-right: 3px; }
          .notes-box { border: 1px solid #e4e4e7; border-radius: 8px; padding: 10px 12px; margin-top: 12px; min-height: 60px; }
          .footer { margin-top: 24px; border-top: 1px solid #e4e4e7; padding-top: 10px; text-align: center; font-size: 9px; color: #a1a1aa; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const dateStr = day.date ? new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "TBD";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="relative flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#18181b]">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Call Sheet — Day {day.day_number}</p>
              <p className="text-[11px] text-muted-foreground">{projectTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div ref={printRef}>
            {/* Header */}
            <div className="header">
              <div>
                <div className="title">{projectTitle}</div>
                <div className="subtitle">Call Sheet · Day {day.day_number}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                {clientLogoUrl && (
                  <img src={clientLogoUrl} alt="client logo" style={{ height: 32, maxWidth: 100, objectFit: "contain" }} />
                )}
                <div className="badge">DAY {day.day_number}</div>
              </div>
            </div>

            {/* Meta grid */}
            <div className="meta-grid">
              <div className="meta-card">
                <div className="meta-label">Date</div>
                <div className="meta-value">{dateStr}</div>
              </div>
              <div className="meta-card">
                <div className="meta-label">General Call</div>
                <div className="meta-value">{day.general_call || "TBD"}</div>
              </div>
              <div className="meta-card">
                <div className="meta-label">Primary Location</div>
                <div className="meta-value">{day.location || "TBD"}</div>
              </div>
            </div>

            {/* Crew */}
            {crew.length > 0 && (
              <>
                <h2>Crew</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crew.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td>{c.role}</td>
                        <td>{c.department ?? "—"}</td>
                        <td>{c.phone || c.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Shots */}
            <h2>Scene / Shot Breakdown</h2>
            {shots.length === 0 ? (
              <p style={{ color: "#a1a1aa", fontSize: "11px" }}>No shots assigned to this day.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Scene</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Lens</th>
                  </tr>
                </thead>
                <tbody>
                  {shots.map((s) => (
                    <tr key={s.id}>
                      <td className="shot-num">{s.shot_number}</td>
                      <td>{s.scene ?? "—"}</td>
                      <td>{s.description}</td>
                      <td>{s.shot_type ? <span className="tag">{s.shot_type.replace(/_/g, " ")}</span> : "—"}</td>
                      <td>{s.lens ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Individual Call Times */}
            {crewCalls.length > 0 && (
              <>
                <h2>Individual Call Times</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Call Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crewCalls.map((cc) => (
                      <tr key={cc.id}>
                        <td style={{ fontWeight: 600 }}>{cc.name}</td>
                        <td>{cc.role ?? "—"}</td>
                        <td style={{ fontWeight: 700, color: "#d4a853" }}>{cc.call_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Drone Briefing — shown only when drone shots exist for this day */}
            {shots.filter((s) => s.shot_type === "drone").length > 0 && (
              <>
                <h2>Drone / Aerial Briefing</h2>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Description</th>
                      <th>Scene</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shots.filter((s) => s.shot_type === "drone").map((s) => (
                      <tr key={s.id}>
                        <td className="shot-num">{s.shot_number}</td>
                        <td>{s.description}</td>
                        <td>{s.scene ?? "—"}</td>
                        <td>{s.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ fontSize: "9px", color: "#a1a1aa", marginTop: "6px" }}>
                  Confirm LAANC authorization, pre-flight checklist, and Remote ID broadcast before any aerial operation.
                </p>
              </>
            )}

            {/* Notes */}
            {day.notes && (
              <>
                <h2>Notes</h2>
                <div className="notes-box" style={{ whiteSpace: "pre-wrap" }}>{day.notes}</div>
              </>
            )}

            <div className="footer">
              Generated by Cineflow · Ease your mind.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ShootDaysPanel({ projectId, projectTitle, clientLogoUrl, shots, onShotsUpdated, canEdit }: ShootDaysPanelProps) {
  const [days, setDays] = useState<ShootDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<ShootDay | null>(null);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [collaborators, setCollaborators] = useState<ProjectCollaborator[]>([]);

  // Individual call times
  const [crewCalls, setCrewCalls] = useState<CrewCall[]>([]);
  const [showCallForm, setShowCallForm] = useState(false);
  const [callCollabId, setCallCollabId] = useState<string>("");
  const [callDroneId, setCallDroneId] = useState<string>("");
  const [callName, setCallName] = useState("");
  const [callRole, setCallRole] = useState("");
  const [callTime, setCallTime] = useState("");
  const [savingCall, setSavingCall] = useState(false);
  const [removingCallId, setRemovingCallId] = useState<string | null>(null);

  // Drone equipment
  const [drones, setDrones] = useState<Pick<DroneEquipment, "id" | "make" | "model" | "nickname">[]>([]);

  // Add/edit day form
  const [showForm, setShowForm] = useState(false);
  const [editingDay, setEditingDay] = useState<ShootDay | null>(null);
  const [fDate, setFDate] = useState("");
  const [fCall, setFCall] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Assign shot to day
  const [assigningShot, setAssigningShot] = useState<string | null>(null);

  // Call sheet modal
  const [callSheetDay, setCallSheetDay] = useState<ShootDay | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("shoot_days")
        .select("*")
        .eq("project_id", projectId)
        .order("day_number", { ascending: true });
      setDays((data ?? []) as ShootDay[]);
      if (data && data.length > 0) setSelectedDay(data[0] as ShootDay);
      setLoading(false);
    }
    load();

    supabase
      .from("crew_contacts")
      .select("*")
      .eq("project_id", projectId)
      .order("department", { ascending: true })
      .then(({ data }) => setCrew((data ?? []) as CrewMember[]));

    // Load active collaborators for the call time picker
    fetch(`/api/projects/${projectId}/collaborators`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCollaborators((data as ProjectCollaborator[]).filter((c) => c.status === "active"));
      })
      .catch(() => {});

    // Load user's registered drones
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("drone_equipment")
        .select("id, make, model, nickname")
        .eq("user_id", user.id)
        .order("make")
        .then(({ data }) => setDrones((data ?? []) as Pick<DroneEquipment, "id" | "make" | "model" | "nickname">[]));
    });
  }, [projectId]);

  useEffect(() => {
    if (!selectedDay) { setCrewCalls([]); return; }
    fetch(`/api/projects/${projectId}/shoot-days/${selectedDay.id}/crew-calls`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCrewCalls(data as CrewCall[]); })
      .catch(() => {});
  }, [selectedDay?.id, projectId]);

  function openNewDay() {
    setEditingDay(null);
    setFDate(""); setFCall(""); setFLocation(""); setFNotes("");
    setShowForm(true);
  }

  function openEditDay(day: ShootDay) {
    setEditingDay(day);
    setFDate(day.date ?? "");
    setFCall(day.general_call ?? "");
    setFLocation(day.location ?? "");
    setFNotes(day.notes ?? "");
    setShowForm(true);
  }

  async function handleSaveDay() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editingDay) {
        const changed =
          fDate !== (editingDay.date ?? "") ||
          fCall !== (editingDay.general_call ?? "") ||
          fLocation !== (editingDay.location ?? "");

        const { data, error } = await supabase
          .from("shoot_days")
          .update({ date: fDate || null, general_call: fCall || null, location: fLocation || null, notes: fNotes || null, updated_at: new Date().toISOString() })
          .eq("id", editingDay.id)
          .select()
          .single();
        if (error) throw error;
        const updated = data as ShootDay;
        setDays((prev) => prev.map((d) => d.id === updated.id ? updated : d));
        setSelectedDay(updated);
        toast.success("Day updated");

        // Notify active collaborators if key schedule details changed
        if (changed) {
          fetch(`/api/projects/${projectId}/shoot-days/${editingDay.id}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectTitle,
              dayNumber: editingDay.day_number,
              date: fDate || null,
              generalCall: fCall || null,
              location: fLocation || null,
            }),
          }).catch(() => {});
        }
      } else {
        const nextNum = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;
        const { data, error } = await supabase
          .from("shoot_days")
          .insert({ project_id: projectId, created_by: user?.id, day_number: nextNum, date: fDate || null, general_call: fCall || null, location: fLocation || null, notes: fNotes || null })
          .select()
          .single();
        if (error) throw error;
        const newDay = data as ShootDay;
        setDays((prev) => [...prev, newDay]);
        setSelectedDay(newDay);
        toast.success(`Day ${nextNum} added`);
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDay(day: ShootDay) {
    if (!confirm(`Delete Day ${day.day_number}? Shots assigned to it will be unassigned.`)) return;
    await supabase.from("shoot_days").delete().eq("id", day.id);
    setDays((prev) => prev.filter((d) => d.id !== day.id));
    if (selectedDay?.id === day.id) setSelectedDay(days.find((d) => d.id !== day.id) ?? null);
    toast.success("Day deleted");
  }

  function openCallForm() {
    setCallCollabId(""); setCallDroneId(""); setCallName(""); setCallRole(""); setCallTime("");
    setShowCallForm(true);
  }

  function handleCollabSelect(collabId: string) {
    setCallCollabId(collabId);
    if (!collabId) { setCallName(""); setCallRole(""); return; }
    const c = collaborators.find((x) => x.id === collabId);
    if (c) { setCallName(c.name); setCallRole(c.role ?? ""); }
  }

  async function handleAddCrewCall(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDay || !callName.trim() || !callTime.trim()) return;
    setSavingCall(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/shoot-days/${selectedDay.id}/crew-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collaborator_id: callCollabId || null,
          drone_id: callDroneId || null,
          name: callName.trim(),
          role: callRole.trim() || null,
          call_time: callTime.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to add"); return; }
      setCrewCalls((prev) => [...prev, data as CrewCall]);
      setShowCallForm(false);
      toast.success("Call time added");
    } catch {
      toast.error("Failed to add call time");
    } finally {
      setSavingCall(false);
    }
  }

  async function handleRemoveCrewCall(crewCallId: string) {
    if (!selectedDay) return;
    setRemovingCallId(crewCallId);
    const res = await fetch(
      `/api/projects/${projectId}/shoot-days/${selectedDay.id}/crew-calls?crewCallId=${crewCallId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setCrewCalls((prev) => prev.filter((cc) => cc.id !== crewCallId));
    } else {
      toast.error("Failed to remove");
    }
    setRemovingCallId(null);
  }

  async function assignShotToDay(shotId: string, dayId: string | null) {
    setAssigningShot(shotId);
    const { error } = await supabase
      .from("shot_list_items")
      .update({ shoot_day_id: dayId })
      .eq("id", shotId);
    if (error) { toast.error("Failed to assign"); setAssigningShot(null); return; }
    const updated = shots.map((s) => s.id === shotId ? { ...s, shoot_day_id: dayId ?? undefined } : s);
    onShotsUpdated(updated as ShotListItem[]);
    setAssigningShot(null);
  }

  const dayShots = selectedDay
    ? shots.filter((s) => s.shoot_day_id === selectedDay.id)
    : [];
  const unassignedShots = shots.filter((s) => !s.shoot_day_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Days row */}
        <div className="flex items-center gap-2 flex-wrap">
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day)}
              className={`group flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                selectedDay?.id === day.id
                  ? "border-[#d4a853] bg-[#d4a853]/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Day {day.day_number}
              {day.date && <span className="text-[10px] opacity-70">· {new Date(day.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
            </button>
          ))}
          {canEdit && (
            <button
              onClick={openNewDay}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-[#d4a853]/40 hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Day
            </button>
          )}
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Day header */}
            <div className="flex items-start justify-between gap-4 px-4 py-3 border-b border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Day {selectedDay.day_number}</span>
                  {selectedDay.date && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                  {selectedDay.general_call && (
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{selectedDay.general_call}</span>
                  )}
                  {selectedDay.location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{selectedDay.location}</span>
                  )}
                  <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{dayShots.length} shot{dayShots.length !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{crew.length} crew</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setCallSheetDay(selectedDay)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Call Sheet
                </button>
                {canEdit && (
                  <>
                    <button onClick={() => openEditDay(selectedDay)} className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDeleteDay(selectedDay)} className="rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Individual Call Times */}
            <div className="border-t border-border px-3 py-2.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Individual Call Times</p>
                </div>
                {canEdit && !showCallForm && (
                  <button
                    onClick={openCallForm}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[#d4a853] hover:bg-[#d4a853]/10 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                )}
              </div>

              {showCallForm && canEdit && (
                <form onSubmit={handleAddCrewCall} className="mb-2.5 space-y-2 rounded-lg border border-border bg-background p-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground">Pick collaborator or enter manually</label>
                    <select
                      value={callCollabId}
                      onChange={(e) => handleCollabSelect(e.target.value)}
                      className="w-full rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                    >
                      <option value="">Custom name…</option>
                      {collaborators.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  {drones.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <DroneIcon className="h-2.5 w-2.5" />
                        Link drone (optional)
                      </label>
                      <select
                        value={callDroneId}
                        onChange={(e) => setCallDroneId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                      >
                        <option value="">No drone</option>
                        {drones.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nickname ?? `${d.make} ${d.model}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={callName}
                      onChange={(e) => setCallName(e.target.value)}
                      placeholder="Name"
                      required
                      className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                    />
                    <input
                      type="text"
                      value={callRole}
                      onChange={(e) => setCallRole(e.target.value)}
                      placeholder="Role (optional)"
                      className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                    />
                  </div>
                  <input
                    type="text"
                    value={callTime}
                    onChange={(e) => setCallTime(e.target.value)}
                    placeholder="Call time (e.g. 5:30 AM)"
                    required
                    className="w-full rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingCall}
                      className="flex items-center gap-1 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
                    >
                      {savingCall ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCallForm(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {crewCalls.length === 0 && !showCallForm ? (
                <p className="text-[10px] text-muted-foreground/50 italic">No individual call times set.</p>
              ) : (
                <div className="space-y-1">
                  {crewCalls.map((cc) => (
                    <div key={cc.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/10 px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium text-foreground">{cc.name}</span>
                        {cc.role && <span className="ml-1.5 text-[10px] text-muted-foreground">{cc.role}</span>}
                        {cc.drone_id && (() => {
                          const d = drones.find((dr) => dr.id === cc.drone_id);
                          return d ? (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-[#d4a853]/80">
                              <DroneIcon className="h-2.5 w-2.5" />
                              {d.nickname ?? `${d.make} ${d.model}`}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[#d4a853]">{cc.call_time}</span>
                      {canEdit && (
                        <button
                          onClick={() => handleRemoveCrewCall(cc.id)}
                          disabled={removingCallId === cc.id}
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          {removingCallId === cc.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <X className="h-3 w-3" />
                          }
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Shots assigned to this day */}
            <div className="p-3 space-y-1.5">
              {dayShots.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">No shots assigned to this day yet. Assign shots from the list below.</p>
              ) : (
                dayShots.map((shot) => (
                  <div key={shot.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                    <span className="shrink-0 font-mono text-xs font-bold text-[#d4a853]">#{shot.shot_number}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{shot.description}</p>
                      {shot.scene && <p className="text-[10px] text-muted-foreground">{shot.scene}</p>}
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => assignShotToDay(shot.id, null)}
                        disabled={assigningShot === shot.id}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove from day"
                      >
                        {assigningShot === shot.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Unassigned shots — assign to a day */}
        {days.length > 0 && unassignedShots.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unassigned Shots ({unassignedShots.length})</p>
            {unassignedShots.map((shot) => (
              <div key={shot.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-2">
                <span className="shrink-0 font-mono text-xs font-bold text-muted-foreground">#{shot.shot_number}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{shot.description}</p>
                  {shot.scene && <p className="text-[10px] text-muted-foreground">{shot.scene}</p>}
                </div>
                {canEdit && days.length > 0 && (
                  <div className="relative shrink-0">
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) assignShotToDay(shot.id, e.target.value); }}
                      className="appearance-none rounded-lg border border-border bg-background pl-2 pr-6 py-1 text-[11px] text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                      disabled={assigningShot === shot.id}
                    >
                      <option value="">Assign to day…</option>
                      {days.map((d) => (
                        <option key={d.id} value={d.id}>Day {d.day_number}{d.date ? ` · ${new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {days.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <CalendarDays className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm font-medium text-foreground">No shoot days yet</p>
            <p className="text-xs text-muted-foreground">Add days to organise your shots and generate call sheets.</p>
          </div>
        )}
      </div>

      {/* Add / Edit day form (inline modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-foreground">{editingDay ? `Edit Day ${editingDay.day_number}` : "Add Shoot Day"}</p>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Date</label>
                <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">General Call Time</label>
                <input type="text" value={fCall} onChange={(e) => setFCall(e.target.value)} placeholder="e.g. 06:00 AM" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Primary Location</label>
              <input type="text" value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="e.g. Studio A, 123 Main St" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2} placeholder="Special instructions, parking info…" className="w-full resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowForm(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={handleSaveDay} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Sheet Modal */}
      {callSheetDay && (
        <CallSheetModal
          day={callSheetDay}
          projectTitle={projectTitle}
          clientLogoUrl={clientLogoUrl}
          shots={shots.filter((s) => s.shoot_day_id === callSheetDay.id)}
          crew={crew}
          crewCalls={crewCalls}
          onClose={() => setCallSheetDay(null)}
        />
      )}
    </>
  );
}
