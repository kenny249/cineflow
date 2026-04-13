"use client";

import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarEventType, Project } from "@/types";

// ── Time helpers ────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = ["00", "15", "30", "45"];

interface TimeState {
  hour: string;   // "1"–"12"
  minute: string; // "00"|"15"|"30"|"45"
  ampm: "AM" | "PM";
}

function toTimeState(iso: string): TimeState {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const rawMin = d.getMinutes();
  // Round to nearest 15-min increment
  const snapped = MINUTES.reduce((prev, cur) =>
    Math.abs(parseInt(cur) - rawMin) < Math.abs(parseInt(prev) - rawMin) ? cur : prev
  );
  return { hour: String(h), minute: snapped, ampm };
}

function toDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  return dateStr;
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  { value: "shoot",     label: "Shoot" },
  { value: "meeting",   label: "Meeting" },
  { value: "deadline",  label: "Deadline" },
  { value: "milestone", label: "Milestone" },
  { value: "delivery",  label: "Delivery" },
  { value: "other",     label: "Other" },
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
}

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: EventFormValues) => Promise<void>;
  projects: Project[];
  /** Pre-fill a specific date (YYYY-MM-DD) when clicking a calendar day */
  defaultDate?: string;
  saving?: boolean;
}

// ── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange, label }: { value: TimeState; onChange: (t: TimeState) => void; label: string }) {
  const selectCls = "rounded-md border border-border bg-input px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-1.5">
        <select
          value={value.hour}
          onChange={(e) => onChange({ ...value, hour: e.target.value })}
          className={`${selectCls} w-14`}
        >
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-muted-foreground text-sm font-medium">:</span>
        <select
          value={value.minute}
          onChange={(e) => onChange({ ...value, minute: e.target.value })}
          className={`${selectCls} w-16`}
        >
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={value.ampm}
          onChange={(e) => onChange({ ...value, ampm: e.target.value as "AM" | "PM" })}
          className={`${selectCls} w-16`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventFormModal({ open, onClose, onSave, projects, defaultDate, saving }: EventFormModalProps) {
  const initDate = defaultDate ?? todayStr();
  const initStart = nowRounded();
  const initEnd = addHour(initDate, initStart);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("shoot");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState<TimeState>(initStart);
  const [endTime, setEndTime] = useState<TimeState>(initEnd);
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [description, setDescription] = useState("");

  // Re-initialize when modal opens or defaultDate changes
  useEffect(() => {
    if (!open) return;
    const d = defaultDate ?? todayStr();
    const s = nowRounded();
    setDate(d);
    setStartTime(s);
    setEndTime(addHour(d, s));
    setTitle("");
    setType("shoot");
    setProjectId(projects[0]?.id ?? "");
    setLocation("");
    setMeetingLink("");
    setDescription("");
  }, [open, defaultDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // When start time changes, shift end time by 1 hour
  const handleStartTimeChange = (t: TimeState) => {
    setStartTime(t);
    setEndTime(addHour(date, t));
  };

  // When date changes, keep same times but update the date
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
  };

  const handleSave = async () => {
    if (!title.trim() || !date) return;
    await onSave({
      title: title.trim(),
      type,
      project_id: projectId,
      start_iso: buildISO(date, startTime),
      end_iso: buildISO(date, endTime),
      location: location.trim(),
      meeting_link: meetingLink.trim(),
      description: description.trim(),
    });
  };

  const selectCls = "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Calendar Event</DialogTitle>
          <DialogDescription>Schedule a shoot, meeting, deadline, or milestone.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client review session"
              onKeyDown={(e) => { if (e.key === "Enter" && title.trim() && date) handleSave(); }}
            />
          </div>

          {/* Type + Project */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value as CalendarEventType)} className={selectCls}>
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Start + End time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <TimePicker label="Start time" value={startTime} onChange={handleStartTimeChange} />
            <TimePicker label="End time" value={endTime} onChange={setEndTime} />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Studio, on location…"
            />
          </div>

          {/* Meeting link */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-muted-foreground" />
              Video call link
            </Label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="Google Meet or Zoom URL"
              type="url"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Any context for this event…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="gold"
            size="sm"
            onClick={handleSave}
            disabled={saving || !title.trim() || !date}
          >
            {saving ? "Saving…" : "Save event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
