import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

interface AvatarGroupProps {
  members: Pick<Profile, "id" | "full_name" | "avatar_url">[];
  max?: number;
  size?: "sm" | "md";
}

export function AvatarGroup({ members, max = 3, size = "sm" }: AvatarGroupProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - max;
  const sizeClass = size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs";

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((member) => (
        <Avatar
          key={member.id}
          className={`${sizeClass} ring-1 ring-background`}
        >
          <AvatarImage src={member.avatar_url} alt={member.full_name ?? ""} />
          <AvatarFallback>{getInitials(member.full_name ?? "")}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full bg-secondary ring-1 ring-background text-muted-foreground font-medium`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
