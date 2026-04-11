import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns";
import type { ProjectStatus, ProjectType, CalendarEventType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function formatDate(date: string | Date, fmt = "MMM d, yyyy"): string {
  return format(new Date(date), fmt);
}

export function formatRelative(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), "h:mm a");
}

// ─── File Size ─────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Status Labels & Styles ───────────────────────────────────────────────────

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  active: "In Production",
  review: "In Review",
  delivered: "Delivered",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "status-draft",
  active: "status-active",
  review: "status-review",
  delivered: "status-delivered",
  cancelled: "status-cancelled",
  archived: "status-cancelled",
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  commercial: "Commercial",
  documentary: "Documentary",
  music_video: "Music Video",
  short_film: "Short Film",
  corporate: "Corporate",
  wedding: "Wedding",
  event: "Event",
  other: "Other",
};

export const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  shoot: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  deadline: "bg-red-500/20 text-red-300 border-red-500/30",
  meeting: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  milestone: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  delivery: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  other: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

// ─── String Helpers ───────────────────────────────────────────────────────────

export function truncate(str: string, length = 60): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}…`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

// ─── Progress Color ───────────────────────────────────────────────────────────

export function getProgressColor(progress: number): string {
  if (progress >= 80) return "bg-emerald-500";
  if (progress >= 50) return "bg-amber-500";
  if (progress >= 25) return "bg-blue-500";
  return "bg-[#d4a853]";
}
