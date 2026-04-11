"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, ChevronDown } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import { addDays, endOfDay, isToday, isTomorrow } from "date-fns";
import type { CalendarEvent } from "@/types";

const TYPE_CONFIG: Record<string, { label: string; badge: string }> = {
  shoot:     { label: "Shoot",     badge: "bg-amber-400/10 text-amber-400 border-amber-400/25" },
  deadline:  { label: "Deadline",  badge: "bg-red-400/10 text-red-400 border-red-400/25" },
  meeting:   { label: "Meeting",   badge: "bg-blue-400/10 text-blue-400 border-blue-400/25" },
  milestone: { label: "Milestone", badge: "bg-purple-400/10 text-purple-400 border-purple-400/25" },
  delivery:  { label: "Delivery",  badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25" },
  review:    { label: "Review",    badge: "bg-sky-400/10 text-sky-400 border-sky-400/25" },
  other:     { label: "Other",     badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

interface Group { label: string; events: CalendarEvent[] }

export function UpcomingShoots({ events }: { events: CalendarEvent[] }) {
  const [laterExpanded, setLaterExpanded] = useState(false);
  const now = new Date();

  const groups = useMemo<Group[]>(() => {
    const today: CalendarEvent[] = [];
    const tomorrow: CalendarEvent[] = [];
    const thisWeek: CalendarEvent[] = [];
    const nextWeek: CalendarEvent[] = [];
    const later: CalendarEvent[] = [];
    const weekEnd     = endOfDay(addDays(now, 6));
    const nextWeekEnd = endOfDay(addDays(now, 13));

    events
      .filter((e) => new Date(e.start_date) >= new Date(now.toDateString()))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .forEach((e) => {
        const d = new Date(e.start_date);
        if (isToday(d))           today.push(e);
        else if (isTomorrow(d))   tomorrow.push(e);
        else if (d <= weekEnd)    thisWeek.push(e);
        else if (d <= nextWeekEnd) nextWeek.push(e);
        else                      later.push(e);
      });

    return [
      { label: "Today",     events: today },
      { label: "Tomorrow",  events: tomorrow },
      { label: "This Week", events: thisWeek },
      { label: "Next Week", events: nextWeek },
      { label: "Later",     events: later },
    ].filter((g) => g.events.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <p className="text-sm font-medium text-muted-foreground">Nothing scheduled yet</p>
        <Link href="/calendar" className="mt-2 text-[11px] text-[#d4a853] hover:underline">Open calendar →</Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => {
        const isLater = group.label === "Later";
        return (
          <div key={group.label}>
            <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</span>
              {isLater && (
                <button
                  onClick={() => setLaterExpanded((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {laterExpanded ? "Collapse" : `Show ${group.events.length}`}
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${laterExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>

            {(!isLater || laterExpanded) && group.events.map((event) => {
              const cfg = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.other;
              const href = event.project_id ? `/projects/${event.project_id}` : "/calendar";
              const projectTitle = (event.project as { title?: string } | undefined)?.title;

              return (
                <Link
                  key={event.id}
                  href={href}
                  className="group flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors"
                >
                  <div className="w-9 shrink-0 text-center pt-0.5">
                    {isToday(new Date(event.start_date)) ? (
                      <span className="block text-[10px] font-bold text-[#d4a853] uppercase tracking-wide">Today</span>
                    ) : (
                      <>
                        <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{formatDate(event.start_date, "MMM")}</div>
                        <div className="font-display text-base font-bold leading-tight text-foreground">{formatDate(event.start_date, "d")}</div>
                      </>
                    )}
                  </div>

                  <div className="mt-1 h-7 w-px shrink-0 bg-border" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-foreground group-hover:text-[#d4a853] transition-colors truncate">
                        {event.title}
                      </p>
                      <span className={`shrink-0 inline-flex rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground">
                      {!event.all_day && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />{formatTime(event.start_date)}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-0.5 max-w-[160px] truncate">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />{event.location}
                        </span>
                      )}
                      {projectTitle && (
                        <span className="text-[#d4a853]/60 truncate">{projectTitle}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })}

      <div className="px-4 py-2.5">
        <Link href="/calendar" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          View full calendar →
        </Link>
      </div>
    </div>
  );
}
