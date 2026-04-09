import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelative, getInitials } from "@/lib/utils";
import type { ActivityItem } from "@/types";

const ACTIVITY_ICONS: Record<string, string> = {
  project_created: "✦",
  project_updated: "✎",
  revision_uploaded: "↑",
  revision_approved: "✓",
  comment_added: "◎",
  shot_list_updated: "▤",
  storyboard_updated: "▣",
  member_added: "⊕",
  status_changed: "◈",
  note_added: "✐",
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="space-y-0">
      {items.map((item, index) => (
        <div key={item.id} className="group relative flex gap-3 py-3">
          {/* Connector line */}
          {index < items.length - 1 && (
            <div className="absolute left-[15px] top-10 bottom-0 w-px bg-border" />
          )}

          {/* Avatar */}
          <div className="relative shrink-0 mt-0.5">
            <Avatar className="h-[30px] w-[30px] ring-2 ring-background">
              <AvatarImage src={item.user?.avatar_url} alt={item.user?.full_name} />
              <AvatarFallback className="text-[9px]">
                {item.user ? getInitials(item.user.full_name ?? "") : "?"}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card border border-border text-[8px]">
              {ACTIVITY_ICONS[item.type] || "·"}
            </span>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-xs text-foreground">
              <span className="font-medium">{item.user?.full_name}</span>{" "}
              <span className="text-muted-foreground">{item.description}</span>
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {item.project && (
                <span className="text-[10px] text-[#d4a853]/80 truncate max-w-[140px]">
                  {item.project.title}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                · {formatRelative(item.created_at)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
