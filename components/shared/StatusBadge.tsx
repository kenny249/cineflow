import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const STATUS_VARIANT: Record<ProjectStatus, "active" | "review" | "draft" | "delivered" | "cancelled"> = {
  active: "active",
  review: "review",
  draft: "draft",
  delivered: "delivered",
  cancelled: "cancelled",
  archived: "cancelled",
};

interface StatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
