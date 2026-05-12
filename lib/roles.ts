import { Crown, Shield, User } from "lucide-react";

export type WorkspaceRole = "owner" | "admin" | "member";

export const ROLE_DEFINITIONS = [
  {
    value: "owner" as WorkspaceRole,
    label: "Owner",
    icon: Crown,
    color: "text-[#d4a853]",
    border: "border-[#d4a853]/40",
    bg: "bg-[#d4a853]/8",
    description: "Full control over the entire workspace.",
    can: [
      "Everything Producers and Members can do",
      "Manage team — invite, remove, change roles",
      "Payment credentials and billing settings",
      "Delete projects and workspace data",
    ],
    cannot: [],
  },
  {
    value: "admin" as WorkspaceRole,
    label: "Producer",
    icon: Shield,
    color: "text-blue-400",
    border: "border-blue-400/30",
    bg: "bg-blue-400/5",
    description: "Manages projects, budgets and client relationships.",
    can: [
      "All production tools — projects, shot lists, scripts, storyboards",
      "Finance — budgets and invoices",
      "Clients, contracts, crew and calendar",
      "Invite and manage external collaborators",
    ],
    cannot: [
      "Invite or remove internal team members",
      "Change team member roles",
      "View or edit payment credentials",
    ],
  },
  {
    value: "member" as WorkspaceRole,
    label: "Member",
    icon: User,
    color: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/20",
    description: "Works on production — no access to financial data.",
    can: [
      "All production tools — projects, shot lists, scripts, storyboards",
      "Clients, crew, calendar and tasks",
      "Contracts and forms",
      "Project chat and collaboration",
    ],
    cannot: [
      "Finance, budgets or invoices",
      "Payment credentials or billing",
      "Invite or manage team members",
    ],
  },
] as const;

export const ROLE_MAP = Object.fromEntries(
  ROLE_DEFINITIONS.map((r) => [r.value, r])
) as Record<WorkspaceRole, typeof ROLE_DEFINITIONS[number]>;
