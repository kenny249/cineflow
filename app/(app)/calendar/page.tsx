"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, MapPin, Plus, List, Grid3x3 } from "lucide-react";
import { getCalendarEvents, createCalendarEvent, getProjects } from "@/lib/supabase/queries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { CalendarEvent, CalendarEventType, Project } from "@/types";

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
  return events.filter((e) => {
    const d = new Date(e.start_date);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
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
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<CalendarEventType>("shoot");
  const [newProjectId, setNewProjectId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [evts, projs] = await Promise.all([getCalendarEvents(), getProjects()]);
        setEvents(evts || []);
        setProjects(projs || []);
        if (projs?.length) setNewProjectId(projs[0].id);
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

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || !newStartDate) return;
    setIsCreating(true);
    try {
      const newEvent = await createCalendarEvent({
        project_id: newProjectId || undefined,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        type: newType,
        start_date: newStartDate,
        end_date: newEndDate || undefined,
        location: newLocation.trim() || undefined,
      });
      setEvents((prev) => [...prev, newEvent].sort((a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewStartDate("");
      setNewEndDate("");
      setNewLocation("");
      setNewType("shoot");
      toast.success("Event created");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("createCalendarEvent error:", err);
      toast.error(`Failed to create event: ${msg}`);
    } finally {
      setIsCreating(false);
    }
  }, [newTitle, newDesc, newType, newProjectId, newStartDate, newEndDate, newLocation]);

  const openCreateForDay = (day: number) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}T09:00`;
    setNewStartDate(dateStr);
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
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
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
          <Button variant="gold" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Event
          </Button>
        </div>
      </div>

      {/* Event type legend */}
      <div className="flex items-center gap-3 border-b border-border/50 px-6 py-2.5">
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
                    <button onClick={() => setCreateOpen(true)} className="text-[#d4a853] hover:underline">Create one</button> to get started.
                  </p>
                </div>
              ) : (
                listEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
                    <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_DOT[event.type] || EVENT_DOT.other}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">{event.title}</p>
                          {event.description && <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${EVENT_COLORS[event.type]}`}>
                          {event.type}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        {event.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
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
                  <div key={ev.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${EVENT_DOT[ev.type]}`} />
                      <p className="font-medium text-sm text-foreground truncate">{ev.title}</p>
                    </div>
                    {ev.description && <p className="mt-1.5 text-xs text-muted-foreground">{ev.description}</p>}
                    {ev.location && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{ev.location}
                      </p>
                    )}
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {new Date(ev.start_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Calendar Event</DialogTitle>
            <DialogDescription>Schedule a shoot, meeting, deadline, or milestone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Client review session" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CalendarEventType)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                >
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Project</Label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
                >
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="datetime-local" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="datetime-local" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Studio, Zoom, on location…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Any context for this event…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleCreate} disabled={isCreating || !newTitle.trim() || !newStartDate}>
              {isCreating ? "Saving…" : "Save event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
