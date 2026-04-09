import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
  accent?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  accent = false,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        accent
          ? "border-[#d4a853]/20 bg-[#d4a853]/[0.04]"
          : "border-border bg-card"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            accent ? "bg-[#d4a853]/10" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              accent ? "text-[#d4a853]" : "text-muted-foreground"
            )}
          />
        </div>
      </div>

      <div className="font-display text-2xl font-bold text-foreground">{value}</div>

      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}

      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={cn(
              "text-xs font-medium",
              trend.value >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-xs text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
