import type { ActivityItem } from "@/types";

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "act_001",
    project_id: "proj_001",
    project: { id: "proj_001", title: "Volta — Brand Manifesto" },
    user_id: "user_002",
    user: {
      id: "user_002",
      full_name: "Maya Chen",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
    },
    type: "revision_uploaded",
    description: "Uploaded Director's Cut v2",
    created_at: "2026-04-04T16:00:00Z",
  },
  {
    id: "act_002",
    project_id: "proj_002",
    project: { id: "proj_002", title: "Meridian — Wedding Story" },
    user_id: "user_003",
    user: {
      id: "user_003",
      full_name: "Alex Torres",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
    },
    type: "comment_added",
    description: "Left feedback on Final Cut v3",
    created_at: "2026-04-04T13:45:00Z",
  },
  {
    id: "act_003",
    project_id: "proj_001",
    project: { id: "proj_001", title: "Volta — Brand Manifesto" },
    user_id: "user_001",
    user: {
      id: "user_001",
      full_name: "Kenneth Garcia",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
    },
    type: "shot_list_updated",
    description: "Marked 2 shots complete in Day 1 shot list",
    created_at: "2026-04-03T11:20:00Z",
  },
  {
    id: "act_004",
    project_id: "proj_003",
    project: { id: "proj_003", title: "Solstice — Music Video" },
    user_id: "user_001",
    user: {
      id: "user_001",
      full_name: "Kenneth Garcia",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
    },
    type: "project_created",
    description: "Created project",
    created_at: "2026-04-01T12:00:00Z",
  },
  {
    id: "act_005",
    project_id: "proj_002",
    project: { id: "proj_002", title: "Meridian — Wedding Story" },
    user_id: "user_001",
    user: {
      id: "user_001",
      full_name: "Kenneth Garcia",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
    },
    type: "status_changed",
    description: "Changed status to In Review",
    metadata: { from: "active", to: "review" },
    created_at: "2026-04-01T09:00:00Z",
  },
  {
    id: "act_006",
    project_id: "proj_004",
    project: { id: "proj_004", title: "Arca Hotels — Story Series" },
    user_id: "user_001",
    user: {
      id: "user_001",
      full_name: "Kenneth Garcia",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80",
    },
    type: "revision_approved",
    description: "Marked Final Delivery as approved",
    created_at: "2026-03-31T18:00:00Z",
  },
];

export const MOCK_DASHBOARD_STATS = {
  active_projects: 3,
  upcoming_shoots: 2,
  pending_revisions: 1,
  delivered_this_month: 1,
  total_projects: 6,
  storage_used_gb: 284,
  storage_limit_gb: 500,
};
