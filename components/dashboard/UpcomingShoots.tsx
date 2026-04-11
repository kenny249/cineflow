import { MapPin, Clock } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";
import type { CalendarEvent } from "@/types";

const TYPE_DOT: Record<string, string> = {
  shoot: "bg-amber-400",
  deadline: "bg-red-400",
  review: "bg-blue-400",
  meeting: "bg-purple-400",
  delivery: "bg-emerald-400",
  other: "bg-zinc-500",
};

export function UpcomingShoots({ events }: { events: CalendarEvent[] }) {
  const now = new Date();
  const upcoming = events
    .filter((e) => (e.type === "shoot" || e.type === "deadline") && new Date(e.start_date) >= now)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 4);

  if (upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No upcoming shoots</p>
        <Link href="/calendar" className="mt-2 text-[11px] text-[#d4a853] hover:underline">Open calendar →</Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {upcoming.map((event) => (
        <Link
          key={event.id}
          href="/calendar"
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
        >
          {/* Date block */}
          <div className="w-10 shrink-0 text-center">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {formatDate(event.start_date, "MMM")}
            </div>
            <div className="font-display text-lg font-bold leading-tight text-foreground">
              {formatDate(event.start_date, "d")}
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px shrink-0 bg-border" />

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[event.type] ?? "bg-zinc-500"}`} />
              <p className="truncate text-xs font-medium text-foreground group-hover:text-[#d4a853] transition-colors">
                {event.title}
              </p>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
              {!event.all_day && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatTime(event.start_date)}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-0.5 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {event.location}
                </span>
              )}
            </div>
          </div>
        </Link>
      ))}

      <Link
        href="/calendar"
        className="mt-1 flex items-center justify-center py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        View full calendar →
      </Link>
    </div>
  );
}
