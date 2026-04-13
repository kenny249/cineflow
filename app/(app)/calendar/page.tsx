"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, MapPin, Plus, List, Grid3x3, Pencil, Check, X, Clock, Trash2, Video } from "lucide-react";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getProjects } from "@/lib/supabase/queries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CalendarEvent, CalendarEventType, Project } from "@/types";
import { EventFormModal } from "@/components/calendar/EventFormModal";
import type { EventFormValues } from "@/components/calendar/EventFormModal";

const EVENT_COLORS: Record<string, string> = {
  shoot: "bg-[#d4a853] text-black",
  meeting: "bg-blue-500/80 text-white",
  deadline: "bg-red-500/80 text-white",
  milestone: "bg-purple-500/80 text-white",
  delivery: "bg-emerald-500/80 text-white",
  other: "bg-muted text-muted-foreground",
};

const EVENT_DOT: Record<string, string> = {
  shoot: "bg-[#d4a853]",
  meeting: "bg-blue-400",
  deadline: "bg-red-400",
  milestone: "bg-purple-400",
  delivery: "bg-emerald-400",
  other: "bg-muted-foreground",
};

const EVENT_TYPES = [
  { value: "shoot", label: "Shoot" },
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "milestone", label: "Milestone" },
  { value: "delivery", label: "Delivery" },
  { value: "other", label: "Other" },
] as const;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getEventsForDay(events: CalendarEvent[], year: number, month: number, day: number) {
  const target = new Date(year, month, day);
  const targetEnd = new Date(year, month, day, 23, 59, 59, 999);
  return events.filter((e) => {
    const start = new Date(e.start_date);
    // Normalize start to midnight for multi-day comparison
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = e.end_date
      ? (() => { const ed = new Date(e.end_date); return new Date(ed.getFullYear(), ed.getMonth(), ed.getDate()); })()
      : startDay;
    return startDay <= targetEnd && endDay >= target;
  });
}

type ViewMode = "month" | "list";

export default function CalendarPage() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);

  // Inline editing — per field
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [typePickerId, setTypePickerId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState<"description" | "location" | "time" | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState("");
  // time picker state (hour 1-12, minute 00/15/30/45, ampm)
  const [timeHour, setTimeHour] = useState("12");
  const [timeMinute, setTimeMinute] = useState("00");
  const [timeAmPm, setTimeAmPm] = useState<"AM" | "PM">("PM");

  const openTimeEdit = (ev: CalendarEvent) => {
    const d = new Date(ev.start_date);
    let h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    setTimeHour(String(h));
    setTimeMinute(String(d.getMinutes()).padStart(2, "0"));
    setTimeAmPm(ampm);
    setEditingFieldId(ev.id);
    setEditingFieldName("time");
  };

  const commitTimeEdit = async (id: string) => {
    setEditingFieldId(null);
    setEditingFieldName(null);
    let h = Number(timeHour) % 12;
    if (timeAmPm === "PM") h += 12;
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const d = new Date(ev.start_date);
    d.setHours(h, Number(timeMinute));
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, start_date: d.toISOString() } : e));
    try { await updateCalendarEvent(id, { start_date: d.toISOString() }); } catch { /* silent */ }
  };

  const commitTitle = async (id: string) => {
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, title: trimmed } : e));
    try { await updateCalendarEvent(id, { title: trimmed }); } catch { /* silent */ }
  };

  const commitType = async (id: string, type: CalendarEventType) => {
    setTypePickerId(null);
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, type } : e));
    try { await updateCalendarEvent(id, { type }); } catch { /* silent */ }
  };

  const commitFieldText = async (id: string, field: "description" | "location") => {
    const val = editingFieldValue.trim();
    setEditingFieldId(null);
    setEditingFieldName(null);
    if (field === "description") {
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, description: val || undefined } : e));
      try { await updateCalendarEvent(id, { description: val || undefined }); } catch { /* silent */ }
    } else {
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, location: val || undefined } : e));
      try { await updateCalendarEvent(id, { location: val || undefined }); } catch { /* silent */ }
    }
  };

  // Card edit (full form via pencil)
  const [cardEditId, setCardEditId] = useState<string | null>(null);
  const [cardEdit, setCardEdit] = useState<{ title: string; type: CalendarEventType; description: string; location: string; time: string } | null>(null);

  const openCardEdit = (ev: CalendarEvent) => {
    const d = new Date(ev.start_date);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    setCardEditId(ev.id);
    setCardEdit({ title: ev.title, type: ev.type, description: ev.description ?? "", location: ev.location ?? "", time: `${hh}:${mm}` });
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setSelectedDay((d) => d); // keep panel open
    try { await deleteCalendarEvent(id); toast.success("Event deleted."); } catch { toast.error("Failed to delete."); }
  };

  const saveCardEdit = async (id: string) => {
    if (!cardEdit) return;
    const d = new Date(events.find((e) => e.id === id)!.start_date);
    const [h, m] = cardEdit.time.split(":").map(Number);
    d.setHours(h, m);
    const updates = { title: cardEdit.title.trim() || "Untitled", type: cardEdit.type, description: cardEdit.description.trim() || undefined, location: cardEdit.location.trim() || undefined, start_date: d.toISOString() };
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...updates } : e));
    setCardEditId(null);
    setCardEdit(null);
    try { await updateCalendarEvent(id, updates); } catch { toast.error("Failed to save"); }
  };

  useEffect(() => {
    async function load() {
      try {
        const [evts, projs] = await Promise.all([getCalendarEvents(), getProjects()]);
        setProjects(projs || []);

        if ((evts || []).length === 0) {
          // Seed demo events so beta testers see a populated calendar
          const p1 = projs?.[0];
          const p2 = projs?.[1];
          function dt(daysOffset: number, hour: number, min = 0) {
            const d = new Date(); d.setDate(d.getDate() + daysOffset); d.setHours(hour, min, 0, 0); return d.toISOString();
          }
          const seeds: Parameters<typeof createCalendarEvent>[0][] = [
            { title: "Pre-production kickoff", type: "meeting",  start_date: dt(0, 10, 0),  location: "Studio Office",         project_id: p1?.id, description: "Review shot list, timeline, and crew assignments." },
            { title: "Location scout review",  type: "meeting",  start_date: dt(0, 15, 30), location: "Scouting HQ",            description: "Walk through shortlisted locations and lock final choice." },
            { title: "Gear rental pickup",     type: "other",    start_date: dt(1,  9, 0),  location: "LensRentals, LA",        description: "Collect camera package and lighting kit." },
            { title: `${p1?.title ?? "Project"} — Storyboard session`, type: "meeting", start_date: dt(3, 14, 0), project_id: p1?.id, location: "Zoom", description: "Walk client through full storyboard frame by frame." },
            { title: `${p1?.title ?? "Project"} — Shoot Day 1`,        type: "shoot",   start_date: dt(7,  8, 0), project_id: p1?.id, location: "Studio One, Los Angeles", description: "First principal photography day. Call time 07:30." },
            { title: "Client check-in",        type: "meeting",  start_date: dt(9, 11, 0),  location: "Zoom",                  project_id: p2?.id, description: "Mid-production update with client stakeholders." },
            { title: `${p1?.title ?? "Project"} — Shoot Day 2`,        type: "shoot",   start_date: dt(10, 8, 0), project_id: p1?.id, location: "Studio One, Los Angeles", description: "Second principal photography day." },
            { title: "Color grade review",     type: "meeting",  start_date: dt(12, 13, 0), project_id: p1?.id,                description: "Review offline grade with colorist and approve LUT." },
            { title: `${p2?.title ?? "Project 2"} — Shoot Day`, type: "shoot", start_date: dt(18, 9, 0), project_id: p2?.id, location: "Client HQ", description: "Full shoot day on location." },
            { title: `${p1?.title ?? "Project"} — First cut delivery`, type: "delivery", start_date: dt(21, 17, 0), project_id: p1?.id, description: "Deliver rough cut to client for first review." },
            { title: `${p2?.title ?? "Project 2"} — Final delivery`,   type: "deadline", start_date: dt(30, 12, 0), project_id: p2?.id, description: "Hard deadline for final deliverables to client." },
          ];
          await Promise.allSettled(seeds.map((s) => createCalendarEvent(s)));
          const seeded = await getCalendarEvents();
          setEvents(seeded || []);
        } else {
          setEvents(evts || []);
        }
      } catch {
        toast.error("Failed to load calendar");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Build calendar grid cells: null = empty cell, number = day
  const gridCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth, firstDayOfWeek, daysInMonth]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);

  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const handleCreate = useCallback(async (values: EventFormValues) => {
    setIsCreating(true);
    try {
      const newEvent = await createCalendarEvent({
        project_id: values.project_id || undefined,
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        start_date: values.start_iso,
        end_date: values.end_iso || undefined,
        location: values.location || undefined,
        meeting_link: values.meeting_link || undefined,
      });
      setEvents((prev) => [...prev, newEvent].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      setCreateOpen(false);
      toast.success("Event created");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("createCalendarEvent error:", err);
      toast.error(`Failed to create event: ${msg}`);
    } finally {
      setIsCreating(false);
    }
  }, []);

  const openCreateForDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    setCreateDefaultDate(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`);
    setCreateOpen(true);
  };

  const selectedDayEvents = selectedDay
    ? getEventsForDay(events, viewYear, viewMonth, selectedDay)
    : [];

  const listEvents = useMemo(() => {
    return events.filter((e) => {
      const d = new Date(e.start_date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [events, viewYear, viewMonth]);

  const isToday = (day: number) =>
    day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground">{MONTHS[viewMonth]} {viewYear}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setViewMonth(now.getMonth()); setViewYear(now.getFullYear()); }}
              className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >Today</button>
            <button onClick={nextMonth} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              onClick={() => setViewMode("month")}
              className={`flex h-8 w-8 items-center justify-center text-xs transition-colors ${viewMode === "month" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="Month view"
            ><Grid3x3 className="h-3.5 w-3.5" /></button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center text-xs transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
              title="List view"
            ><List className="h-3.5 w-3.5" /></button>
          </div>
          <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => { setCreateDefaultDate(undefined); setCreateOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />
            New Event
          </Button>
        </div>
      </div>

      {/* Event type legend */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar border-b border-border/50 px-4 py-2.5 sm:px-6">
        {EVENT_TYPES.map((t) => (
          <span key={t.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${EVENT_DOT[t.value]}`} />
            {t.label}
          </span>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Month grid */}
        {viewMode === "month" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAYS.map((d) => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: "minmax(90px, 1fr)" }}>
                {gridCells.map((day, idx) => {
                  const dayEvents = day ? getEventsForDay(events, viewYear, viewMonth, day) : [];
                  const isSelected = day !== null && day === selectedDay;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!day) return;
                        setSelectedDay(day === selectedDay ? null : day);
                      }}
                      className={`relative border-b border-r border-border/50 p-1.5 transition-colors ${
                        !day ? "bg-muted/20" : "cursor-pointer hover:bg-accent/30"
                      } ${isSelected ? "bg-[#d4a853]/[0.06] ring-1 ring-inset ring-[#d4a853]/30" : ""}`}
                    >
                      {day && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                                isToday(day)
                                  ? "bg-[#d4a853] text-black font-bold"
                                  : "text-foreground"
                              }`}
                            >
                              {day}
                            </span>
                            {dayEvents.length === 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openCreateForDay(day); }}
                                className="hidden h-4 w-4 items-center justify-center rounded text-muted-foreground/40 hover:text-[#d4a853] group-hover:flex"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-none ${EVENT_COLORS[ev.type] || EVENT_COLORS.other}`}
                              >
                                {ev.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* List view */
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="space-y-3">
              {listEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CalIcon className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="font-medium text-foreground">No events this month</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <button onClick={() => { setCreateDefaultDate(undefined); setCreateOpen(true); }} className="text-[#d4a853] hover:underline">Create one</button> to get started.
                  </p>
                </div>
              ) : (
                listEvents.map((event) => (
                    <div key={event.id} className="group flex items-start gap-4 rounded-xl border border-border bg-card p-4" onClick={() => setTypePickerId(null)}>
                    {/* Type dot */}
                    <div className="relative mt-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setTypePickerId(typePickerId === event.id ? null : event.id); }}
                        title="Change type"
                        className={`h-2.5 w-2.5 rounded-full ${EVENT_DOT[event.type] || EVENT_DOT.other} hover:ring-2 hover:ring-offset-1 hover:ring-offset-background hover:ring-current transition-all`}
                      />
                      {typePickerId === event.id && (
                        <div className="absolute left-0 top-5 z-50 rounded-lg border border-border bg-popover shadow-lg py-1 w-28" onClick={(e) => e.stopPropagation()}>
                          {EVENT_TYPES.map((t) => (
                            <button
                              key={t.value}
                              onClick={() => commitType(event.id, t.value as CalendarEventType)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${event.type === t.value ? "text-foreground font-medium" : "text-muted-foreground"}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${EVENT_DOT[t.value]}`} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {editingId === event.id ? (
                            <input
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => commitTitle(event.id)}
                              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(event.id); if (e.key === "Escape") setEditingId(null); }}
                              className="w-full border-0 bg-transparent text-sm font-medium text-foreground outline-none ring-0 p-0"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p
                              className="font-medium text-foreground cursor-text hover:text-[#d4a853] transition-colors"
                              title="Click to edit"
                              onClick={(e) => { e.stopPropagation(); setEditingId(event.id); setEditingTitle(event.title); }}
                            >
                              {event.title}
                            </p>
                          )}
                          {event.description && <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_COLORS[event.type]}`}>
                            {event.type}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id); }}
                            title="Delete event"
                            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/0 transition-colors hover:bg-red-500/15 hover:text-red-400 group-hover:text-muted-foreground/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        )}
                        {event.meeting_link && (
                          <a href={event.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
                            <Video className="h-3 w-3" />
                            Join call
                          </a>
                        )}
                        {event.project && <span className="text-[#d4a853]/70">{(event.project as any).title}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Day detail panel */}
        {selectedDay !== null && viewMode === "month" && (
          <aside className="hidden w-72 flex-col border-l border-border bg-card/70 p-4 md:flex overflow-y-auto custom-scrollbar">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display font-semibold text-foreground">
                {MONTHS[viewMonth]} {selectedDay}
              </p>
              <button onClick={() => openCreateForDay(selectedDay)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {selectedDayEvents.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                <p className="text-sm text-muted-foreground">No events</p>
                <button onClick={() => openCreateForDay(selectedDay)} className="mt-1.5 text-xs text-[#d4a853] hover:underline">
                  Add one
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => (
                  <div key={ev.id} className="group rounded-xl border border-border bg-background p-3 transition-colors hover:border-border/60">
                    {cardEditId === ev.id && cardEdit ? (
                      /* ── Edit mode ── */
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={cardEdit.title}
                          onChange={(e) => setCardEdit({ ...cardEdit, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Escape") { setCardEditId(null); setCardEdit(null); } }}
                          className="w-full rounded bg-accent/40 px-2 py-1 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50"
                          placeholder="Event title"
                        />
                        {/* Type pills */}
                        <div className="flex flex-wrap gap-1">
                          {EVENT_TYPES.map((t) => (
                            <button
                              key={t.value}
                              onClick={() => setCardEdit({ ...cardEdit, type: t.value as CalendarEventType })}
                              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all ${
                                cardEdit.type === t.value ? EVENT_COLORS[t.value] : "bg-accent text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${EVENT_DOT[t.value]}`} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                        {/* Time */}
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <input
                            type="time"
                            value={cardEdit.time}
                            onChange={(e) => setCardEdit({ ...cardEdit, time: e.target.value })}
                            className="rounded bg-accent/40 px-2 py-0.5 text-xs text-foreground outline-none"
                          />
                        </div>
                        {/* Location */}
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <input
                            value={cardEdit.location}
                            onChange={(e) => setCardEdit({ ...cardEdit, location: e.target.value })}
                            placeholder="Location"
                            className="flex-1 rounded bg-accent/40 px-2 py-0.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                          />
                        </div>
                        {/* Notes */}
                        <textarea
                          rows={2}
                          value={cardEdit.description}
                          onChange={(e) => setCardEdit({ ...cardEdit, description: e.target.value })}
                          placeholder="Notes…"
                          className="w-full resize-none rounded bg-accent/40 px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                        />
                        <div className="flex justify-end gap-1.5 pt-0.5">
                          <button
                            onClick={() => { setCardEditId(null); setCardEdit(null); }}
                            className="flex h-6 items-center gap-1 rounded px-2 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                          <button
                            onClick={() => saveCardEdit(ev.id)}
                            className="flex h-6 items-center gap-1 rounded bg-[#d4a853] px-2 text-[10px] font-semibold text-black transition-opacity hover:opacity-90"
                          >
                            <Check className="h-3 w-3" /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read mode ── */
                      <>
                        <div className="flex items-start justify-between gap-1">
                          {/* Type dot — click to change */}
                          <div className="relative mt-1 shrink-0">
                            <button
                              onClick={() => setTypePickerId(typePickerId === ev.id ? null : ev.id)}
                              title="Change type"
                              className={`h-2.5 w-2.5 rounded-full ${EVENT_DOT[ev.type]} ring-offset-background transition-all hover:ring-2 hover:ring-current hover:ring-offset-1`}
                            />
                            {typePickerId === ev.id && (
                              <div className="absolute left-0 top-5 z-50 w-28 rounded-lg border border-border bg-popover py-1 shadow-lg">
                                {EVENT_TYPES.map((t) => (
                                  <button
                                    key={t.value}
                                    onClick={() => commitType(ev.id, t.value as CalendarEventType)}
                                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${ev.type === t.value ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                                  >
                                    <span className={`h-2 w-2 rounded-full ${EVENT_DOT[t.value]}`} />{t.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Title — click to edit inline */}
                          <div className="flex-1 min-w-0 mx-2">
                            {editingId === ev.id ? (
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => commitTitle(ev.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") commitTitle(ev.id); if (e.key === "Escape") setEditingId(null); }}
                                className="w-full rounded bg-accent/40 px-1.5 py-0.5 text-sm font-medium text-foreground outline-none"
                              />
                            ) : (
                              <p
                                className="cursor-text text-sm font-medium text-foreground truncate hover:text-[#d4a853] transition-colors"
                                onClick={() => { setEditingId(ev.id); setEditingTitle(ev.title); }}
                              >{ev.title}</p>
                            )}
                          </div>

                          {/* Actions — edit + delete */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              onClick={() => openCardEdit(ev)}
                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-accent hover:text-foreground group-hover:text-muted-foreground"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/30 transition-colors hover:bg-red-500/15 hover:text-red-400 group-hover:text-muted-foreground"
                              title="Delete event"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        {editingFieldId === ev.id && editingFieldName === "description" ? (
                          <textarea
                            autoFocus
                            rows={2}
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            onBlur={() => commitFieldText(ev.id, "description")}
                            onKeyDown={(e) => { if (e.key === "Escape") { setEditingFieldId(null); setEditingFieldName(null); } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitFieldText(ev.id, "description"); } }}
                            placeholder="Add notes…"
                            className="mt-1.5 w-full resize-none rounded bg-accent/40 px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                          />
                        ) : (
                          <p
                            className={`mt-1.5 cursor-text text-xs transition-colors ${ev.description ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/25 hover:text-muted-foreground/50"}`}
                            onClick={() => { setEditingFieldId(ev.id); setEditingFieldName("description"); setEditingFieldValue(ev.description ?? ""); }}
                          >{ev.description || "Add notes…"}</p>
                        )}

                        {/* Location */}
                        {editingFieldId === ev.id && editingFieldName === "location" ? (
                          <input
                            autoFocus
                            value={editingFieldValue}
                            onChange={(e) => setEditingFieldValue(e.target.value)}
                            onBlur={() => commitFieldText(ev.id, "location")}
                            onKeyDown={(e) => { if (e.key === "Enter") commitFieldText(ev.id, "location"); if (e.key === "Escape") { setEditingFieldId(null); setEditingFieldName(null); } }}
                            placeholder="Add location…"
                            className="mt-1.5 w-full rounded bg-accent/40 px-2 py-0.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                          />
                        ) : (
                          <p
                            className={`mt-1.5 flex cursor-text items-center gap-1 text-xs transition-colors ${ev.location ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/25 hover:text-muted-foreground/50"}`}
                            onClick={() => { setEditingFieldId(ev.id); setEditingFieldName("location"); setEditingFieldValue(ev.location ?? ""); }}
                          >
                            <MapPin className="h-3 w-3 shrink-0" />{ev.location || "Add location…"}
                          </p>
                        )}

                        {/* Meeting link */}
                        {ev.meeting_link && (
                          <a
                            href={ev.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 flex items-center gap-1 text-xs text-blue-400 hover:underline"
                          >
                            <Video className="h-3 w-3 shrink-0" />
                            Join call
                          </a>
                        )}

                        {/* Time — custom hour/min/ampm selects */}
                        {editingFieldId === ev.id && editingFieldName === "time" ? (
                          <div className="mt-1.5 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <select value={timeHour} onChange={(e) => setTimeHour(e.target.value)} className="rounded bg-accent/40 px-1 py-0.5 text-xs text-foreground outline-none">
                              {[1,2,3,4,5,6,7,8,9,10,11,12].map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">:</span>
                            <select value={timeMinute} onChange={(e) => setTimeMinute(e.target.value)} className="rounded bg-accent/40 px-1 py-0.5 text-xs text-foreground outline-none">
                              {["00","15","30","45"].map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select value={timeAmPm} onChange={(e) => setTimeAmPm(e.target.value as "AM" | "PM")} className="rounded bg-accent/40 px-1 py-0.5 text-xs text-foreground outline-none">
                              <option>AM</option>
                              <option>PM</option>
                            </select>
                            <button onClick={() => commitTimeEdit(ev.id)} className="ml-1 rounded bg-[#d4a853] px-1.5 py-0.5 text-[10px] font-semibold text-black">✓</button>
                            <button onClick={() => { setEditingFieldId(null); setEditingFieldName(null); }} className="rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                          </div>
                        ) : (
                          <p
                            className="mt-1.5 flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                            onClick={() => openTimeEdit(ev)}
                          >
                            <Clock className="h-3 w-3 shrink-0" />
                            {new Date(ev.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── Mobile day events bottom sheet ── */}
      <AnimatePresence>
        {selectedDay !== null && viewMode === "month" && (
          <>
            <motion.div
              key="cal-day-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setSelectedDay(null)}
            />
            <motion.div
              key="cal-day-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-[#0f0f0f] pb-[env(safe-area-inset-bottom)] md:hidden"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" />
              <div className="flex items-center justify-between px-5 py-3.5">
                <p className="font-display font-semibold text-foreground">
                  {MONTHS[viewMonth]} {selectedDay}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCreateForDay(selectedDay)}
                    className="flex items-center gap-1 rounded-lg bg-[#d4a853]/15 px-2.5 py-1 text-xs font-semibold text-[#d4a853]"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto px-5 pb-4">
                {selectedDayEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-sm text-muted-foreground">No events this day</p>
                    <button
                      onClick={() => openCreateForDay(selectedDay)}
                      className="mt-2 text-xs text-[#d4a853] hover:underline"
                    >
                      Add one
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3"
                      >
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_DOT[ev.type] || EVENT_DOT.other}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm">{ev.title}</p>
                          {ev.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{ev.description}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(ev.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {ev.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Event Dialog */}
      <EventFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
        projects={projects}
        defaultDate={createDefaultDate}
        saving={isCreating}
      />
    </div>
  );
}
