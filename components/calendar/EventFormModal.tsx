"use client";

import { useEffect, useState } from "react";
import { Video, ChevronDown } from "lucide-react";
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
  recurrence_rule?: "daily" | "weekly" | "monthly";
  recurrence_end_date?: string;
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

function TimePicker({ value, onChange }: { value: TimeState; onChange: (t: TimeState) => void }) {
  const selectCls = "rounded-md border border-border bg-input px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50";
  return (
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
  const [startDate, setStartDate] = useState(initDate);
  const [endDate, setEndDate] = useState(initDate);
  const [startTime, setStartTime] = useState<TimeState>(initStart);
  const [endTime, setEndTime] = useState<TimeState>(initEnd);
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [description, setDescription] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState<"" | "daily" | "weekly" | "monthly">("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // Re-initialize when modal opens or defaultDate changes
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

  // When start time changes, shift end time by 1 hour
  const handleStartTimeChange = (t: TimeState) => {
    setStartTime(t);
    setEndTime(addHour(startDate, t));
  };

  // When start date changes, keep end date in sync if they were the same day
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

  const selectCls = "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/50";

  const EVENT_DOT: Record<string, string> = {
    shoot: "bg-[#d4a853]", meeting: "bg-blue-400", deadline: "bg-red-400",
    milestone: "bg-purple-400", delivery: "bg-emerald-400", other: "bg-zinc-400",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Title */}
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title…"
            className="text-base font-medium"
            onKeyDown={(e) => { if (e.key === "Enter" && title.trim() && startDate) handleSave(); }}
          />

          {/* Type pills */}
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value as CalendarEventType)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                  type === t.value
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${EVENT_DOT[t.value]}`} />
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

          {/* Start date + time on one row */}
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="flex-1 min-w-0"
            />
            <TimePicker value={startTime} onChange={handleStartTimeChange} />
          </div>

          {/* More details toggle */}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Less details" : "More details"}
          </button>

          {showDetails && (
            <div className="space-y-3 border-t border-border pt-3">
              {/* End */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 min-w-0" />
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>

              {/* Location */}
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location…" />

              {/* Video link */}
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="Zoom / Meet link…" type="url" />

              {/* Repeat */}
              <div className="grid grid-cols-2 gap-2">
                <select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value as "" | "daily" | "weekly" | "monthly")} className={selectCls}>
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {recurrenceRule && (
                  <Input type="date" value={recurrenceEndDate} min={startDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} />
                )}
              </div>

              {/* Notes */}
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Notes…" />
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
