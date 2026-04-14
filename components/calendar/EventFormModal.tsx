"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MapPin, Link2, RotateCcw, StickyNote, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarEventType, Project } from "@/types";

// ── Time helpers ─────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ["00", "15", "30", "45"];

interface TimeState {
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
}

function toTimeState(iso: string): TimeState {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const rawMin = d.getMinutes();
  const snapped = MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - rawMin) < Math.abs(parseInt(prev) - rawMin) ? cur : prev
  );
  return { hour: String(h), minute: snapped, ampm };
}

function buildISO(dateStr: string, time: TimeState): string {
  if (!dateStr) return "";
  let h = parseInt(time.hour) % 12;
  if (time.ampm === "PM") h += 12;
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day, h, parseInt(time.minute), 0, 0);
  return d.toISOString();
}

function addHour(dateStr: string, time: TimeState): TimeState {
  const iso = buildISO(dateStr, time);
  if (!iso) return time;
  const d = new Date(iso);
  d.setHours(d.getHours() + 1);
  return toTimeState(d.toISOString());
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowRounded(): TimeState {
  const d = new Date();
  const h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const rawMin = d.getMinutes();
  const snapped = MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - rawMin) < Math.abs(parseInt(prev) - rawMin) ? cur : prev
  );
  return { hour: String(h12), minute: snapped, ampm };
}

// ── Types ────────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { value: "shoot",     label: "Shoot",     dot: "bg-[#d4a853]" },
  { value: "meeting",   label: "Meeting",   dot: "bg-blue-400" },
  { value: "deadline",  label: "Deadline",  dot: "bg-red-400" },
  { value: "milestone", label: "Milestone", dot: "bg-purple-400" },
  { value: "delivery",  label: "Delivery",  dot: "bg-emerald-400" },
  { value: "other",     label: "Other",     dot: "bg-zinc-400" },
] as const;

export interface EventFormValues {
  title: string;
  type: CalendarEventType;
  project_id: string;
  start_iso: string;
  end_iso: string;
  location: string;
  meeting_link: string;
  description: string;
  recurrence_rule?: "daily" | "weekly" | "monthly";
  recurrence_end_date?: string;
}

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: EventFormValues) => Promise<void>;
  projects: Project[];
  defaultDate?: string;
  saving?: boolean;
}

// ── TimePicker ────────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: TimeState; onChange: (t: TimeState) => void }) {
  const sel = "rounded-lg border border-border bg-input px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50 cursor-pointer";
  return (
    <div className="flex items-center gap-2">
      <select value={value.hour} onChange={(e) => onChange({ ...value, hour: e.target.value })} className={`${sel} w-16`}>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-muted-foreground font-semibold">:</span>
      <select value={value.minute} onChange={(e) => onChange({ ...value, minute: e.target.value })} className={`${sel} w-16`}>
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={value.ampm} onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" })} className={`${sel} w-20`}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventFormModal({ open, onClose, onSave, projects, defaultDate, saving }: EventFormModalProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("shoot");
  const [projectId, setProjectId] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [startTime, setStartTime] = useState<TimeState>(nowRounded());
  const [endTime, setEndTime] = useState<TimeState>(() => addHour(todayStr(), nowRounded()));
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [description, setDescription] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = defaultDate ?? todayStr();
    const s = nowRounded();
    setStartDate(d);
    setEndDate(d);
    setStartTime(s);
    setEndTime(addHour(d, s));
    setTitle("");
    setType("shoot");
    setProjectId(projects[0]?.id ?? "");
    setLocation("");
    setMeetingLink("");
    setDescription("");
    setRecurrenceRule("");
    setRecurrenceEndDate("");
    setShowDetails(false);
  }, [open, defaultDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartTimeChange = (t: TimeState) => {
    setStartTime(t);
    setEndTime(addHour(startDate, t));
  };

  const handleStartDateChange = (newDate: string) => {
    const wasSync = startDate === endDate;
    setStartDate(newDate);
    if (wasSync) setEndDate(newDate);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate) return;
    await onSave({
      title: title.trim(),
      type,
      project_id: projectId,
      start_iso: buildISO(startDate, startTime),
      end_iso: buildISO(endDate, endTime),
      location: location.trim(),
      meeting_link: meetingLink.trim(),
      description: description.trim(),
      recurrence_rule: recurrenceRule || undefined,
      recurrence_end_date: recurrenceRule && recurrenceEndDate ? recurrenceEndDate : undefined,
    });
  };

  const selectCls = "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title */}
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title…"
            className="text-base font-medium h-11"
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim() && startDate) handleSave(); }}
          />

          {/* Event type pills */}
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value as CalendarEventType)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  type === t.value
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${t.dot}`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}

          {/* When — date and time stacked cleanly */}
          <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
            {/* Date row */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border">
              <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Label className="text-sm text-muted-foreground w-12 flex-shrink-0">Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 flex-1"
              />
            </div>
            {/* Time row */}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Label className="text-sm text-muted-foreground w-12 flex-shrink-0">Time</Label>
              <TimePicker value={startTime} onChange={handleStartTimeChange} />
            </div>
          </div>

          {/* More details toggle */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Less details" : "More details"}
          </button>

          {showDetails && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 overflow-hidden">
              {/* End date/time */}
              <div className="border-b border-border">
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Label className="text-sm text-muted-foreground w-12 flex-shrink-0">End</Label>
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 flex-1"
                  />
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Label className="text-sm text-muted-foreground w-12 flex-shrink-0"></Label>
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location…"
                  className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                />
              </div>

              {/* Meeting link */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
                <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="Zoom / Meet link…"
                  type="url"
                  className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0"
                />
              </div>

              {/* Repeat */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
                <RotateCcw className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value as "" | "daily" | "weekly" | "monthly")}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {recurrenceRule && (
                  <Input
                    type="date"
                    value={recurrenceEndDate}
                    min={startDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 w-36"
                    placeholder="Until…"
                  />
                )}
              </div>

              {/* Notes */}
              <div className="flex gap-3 px-3 py-2">
                <StickyNote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Add notes…"
                  className="border-0 bg-transparent p-0 text-sm focus-visible:ring-0 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="gold" size="sm" onClick={handleSave} disabled={saving || !title.trim() || !startDate}>
            {saving ? "Saving…" : "Save Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
