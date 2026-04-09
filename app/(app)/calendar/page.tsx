"use client";

import { useMemo, useState } from "react";
import { MOCK_EVENTS } from "@/mock/calendar";
import { MOCK_PROJECTS } from "@/mock/projects";
import { formatDate, formatTime, EVENT_TYPE_STYLES } from "@/lib/utils";
import { Calendar as CalIcon, MapPin, Plus, Globe, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarEvent } from "@/types";

const EVENT_TYPES = [
  { value: "shoot", label: "Shoot" },
  { value: "meeting", label: "Meeting" },
  { value: "deadline", label: "Deadline" },
  { value: "milestone", label: "Milestone" },
  { value: "delivery", label: "Delivery" },
  { value: "other", label: "Other" },
] as const;

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>(MOCK_EVENTS);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(MOCK_PROJECTS[0]?.id ?? "");
  const [eventType, setEventType] = useState<CalendarEvent["type"]>("shoot");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);

  const projectMap = useMemo(
    () => new Map(MOCK_PROJECTS.map((project) => [project.id, project])),
    []
  );

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
    [events]
  );

  const handleCreateEvent = () => {
    if (!title.trim() || !startDate) return;
    const project = projectMap.get(selectedProjectId);
    const newEvent: CalendarEvent = {
      id: `evt_${Math.random().toString(36).slice(2)}`,
      project_id: selectedProjectId,
      project: project ? { id: project.id, title: project.title, status: project.status } : undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      type: eventType,
      start_date: startDate,
      end_date: endDate || undefined,
      all_day: !endDate,
      location: location.trim() || undefined,
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev]);
    setOpen(false);
    setTitle("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setLocation("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Calendar</h1>
            <p className="text-xs text-muted-foreground">Manage shoot dates, reviews, deadlines, and future Google sync plans.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="gold" size="sm" className="h-9 gap-2" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New Event
            </Button>
            <button
              type="button"
              onClick={() => setSyncEnabled((value) => !value)}
              className={`rounded-2xl border px-3 py-2 text-xs transition ${
                syncEnabled ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border bg-card text-muted-foreground hover:border-[#d4a853]/40 hover:bg-[#d4a853]/[0.05]"
              }`}
            >
              <Globe className="mr-1 inline h-3.5 w-3.5" />
              {syncEnabled ? "Google sync enabled" : "Enable Google Calendar"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-72 border-r border-border bg-card/70 p-5 sm:block">
          <div className="rounded-3xl border border-border bg-muted p-4">
            <div className="flex items-center gap-3 text-sm font-semibold text-foreground mb-3">
              <CalIcon className="h-4 w-4 text-[#d4a853]" />
              Upcoming events
            </div>
            <div className="space-y-3">
              {sorted.slice(0, 3).map((event) => (
                <div key={event.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="text-xs font-semibold text-foreground">{event.title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(event.start_date, "MMM d")}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-foreground">Upcoming schedule</h2>
            <div className="text-xs text-muted-foreground">{events.length} total event{events.length === 1 ? "" : "s"}</div>
          </div>

          <div className="grid gap-4">
            {sorted.map((event) => (
              <div
                key={event.id}
                className="rounded-3xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      <span className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#d4a853]/90">
                        {event.type}
                      </span>
                      {event.project && <span>{event.project.title}</span>}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{event.title}</h3>
                    {event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}
                  </div>
                  <div className="flex flex-col gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#d4a853]" />
                      {formatDate(event.start_date, "MMM d")}
                      {event.end_date ? ` – ${formatDate(event.end_date, "MMM d")}` : ""}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New calendar event</DialogTitle>
            <DialogDescription>Schedule a shoot, review, or milestone for any client project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Client review session"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project">Project</Label>
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {MOCK_PROJECTS.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date">End date</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-type">Event type</Label>
              <select
                id="event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as CalendarEvent["type"])}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground"
              >
                {EVENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Studio, Zoom, on location"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What needs to happen during this event?"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="gold" size="sm" onClick={handleCreateEvent}>
              Save event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
