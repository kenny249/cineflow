// ─── Shared Types ───────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  avatar_url?: string;
  role?: string;
  created_at: string;
  updated_at?: string;
}

export type ProjectStatus = "draft" | "active" | "review" | "delivered" | "archived" | "cancelled";
export type ProjectType =
  | "commercial"
  | "documentary"
  | "music_video"
  | "short_film"
  | "corporate"
  | "wedding"
  | "event"
  | "other";

export type ShotStatus = "planned" | "filming" | "completed" | "review";
export type RevisionStatus = "draft" | "in_review" | "revisions_requested" | "approved" | "final";
export type CalendarEventType = "shoot" | "meeting" | "deadline" | "milestone" | "delivery" | "other";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type ActivityType =
  | "project_created"
  | "project_updated"
  | "revision_uploaded"
  | "revision_approved"
  | "comment_added"
  | "shot_list_updated"
  | "storyboard_updated"
  | "member_added"
  | "status_changed"
  | "note_added";

// ─── Projects ────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  title: string;
  description?: string;
  client_name?: string;
  status: ProjectStatus;
  type: ProjectType;
  progress: number;
  due_date?: string;
  shoot_date?: string;
  thumbnail_url?: string;
  created_by?: string;
  owner_id?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  profile: Profile;
  joined_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  author_id?: string;
  author?: Profile;
  title?: string;
  content: string;
  pinned?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Shot Lists ──────────────────────────────────────────────────────────────

export interface ShotListItem {
  id: string;
  shot_list_id: string;
  shot_number: number;
  scene?: string;
  location?: string;
  description: string;
  shot_type: "wide" | "medium" | "close_up" | "extreme_close_up" | "overhead" | "drone" | "pov" | "other";
  camera_movement: "static" | "pan" | "tilt" | "dolly" | "handheld" | "crane" | "other";
  lens?: string;
  notes?: string;
  is_complete: boolean;
  duration_seconds?: number;
  camera_angle?: string;
  props?: string[];
  actors?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShotList {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  items?: ShotListItem[];
}

// ─── Storyboard ──────────────────────────────────────────────────────────────

export interface StoryboardFrame {
  id: string;
  project_id: string;
  shot_list_item_id?: string;
  frame_number: number;
  title?: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  shot_duration?: string;
  camera_angle?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ─── Revisions ────────────────────────────────────────────────────────────────

export interface RevisionComment {
  id: string;
  revision_id: string;
  author_id?: string;
  author?: Profile;
  content: string;
  timestamp_seconds?: number;
  created_at: string;
  updated_at?: string;
}

export interface Revision {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: RevisionStatus;
  version_number: number;
  file_url?: string;
  file_type?: string;
  file_size?: number;
  thumbnail_url?: string;
  feedback?: string;
  created_by?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  comments?: RevisionComment[];
  created_at: string;
  updated_at?: string;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  project_id?: string;
  project?: Pick<Project, "id" | "title" | "status">;
  title: string;
  description?: string;
  event_type?: CalendarEventType;
  type: CalendarEventType;
  start_time?: string;
  end_time?: string;
  start_date: string;
  end_date?: string;
  all_day?: boolean;
  location?: string;
  attendees?: string[] | Profile[];
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ─── Activity ───────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  project_id: string;
  project?: Pick<Project, "id" | "title">;
  user_id: string;
  user?: Pick<Profile, "id" | "full_name" | "avatar_url">;
  type: ActivityType;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  due_date?: string;
  created_at: string;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
}

// ─── Team ───────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  user_id?: string;
  email: string;
  name?: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "active";
  avatar_url?: string;
  invited_at: string;
  joined_at?: string;
}

export interface TeamTopic {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  created_by?: string;
  created_at: string;
}

export interface TeamMessage {
  id: string;
  topic_id: string;
  author_id?: string;
  author?: Pick<Profile, "id" | "full_name" | "avatar_url" | "email">;
  content: string;
  created_at: string;
  updated_at?: string;
}

// ─── Project Role ─────────────────────────────────────────────────────────────
// owner / admin → full access including finance
// team          → upload, edit, view everything except finance
// client        → view-only restricted scope
export type ProjectRole = "owner" | "admin" | "team" | "client" | "member";

// ─── Project Files ────────────────────────────────────────────────────────────
export type ProjectFileTab = "scripts" | "docs" | "locations" | "other";

export interface ProjectFile {
  id: string;
  project_id: string;
  tab: ProjectFileTab;
  category?: string;
  name: string;
  storage_path: string;
  public_url?: string;
  size?: number;
  mime_type?: string;
  uploaded_by?: string;
  created_at: string;
}

// ─── Crew ────────────────────────────────────────────────────────────────────
export interface CrewContact {
  id: string;
  project_id: string;
  name: string;
  role: string;
  department?: string;
  email?: string;
  phone?: string;
  notes?: string;
  sort_order?: number;
  created_by?: string;
  created_at: string;
}

// ─── Locations ───────────────────────────────────────────────────────────────
export interface ProjectLocation {
  id: string;
  project_id: string;
  name: string;
  address?: string;
  maps_url?: string;
  notes?: string;
  contact_name?: string;
  contact_phone?: string;
  sort_order?: number;
  created_by?: string;
  created_at: string;
}

// ─── Wrap Notes ──────────────────────────────────────────────────────────────
export interface WrapNote {
  id: string;
  project_id: string;
  production_day: string;
  content: string;
  issues?: string;
  outstanding?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Budget ──────────────────────────────────────────────────────────────────
export interface BudgetLine {
  id: string;
  project_id: string;
  category: string;
  description: string;
  budgeted: number;
  actual?: number;
  vendor?: string;
  notes?: string;
  sort_order?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";

export interface Invoice {
  id: string;
  project_id?: string;
  invoice_number: string;
  client_name?: string;
  description?: string;
  amount: number;
  status: InvoiceStatus;
  amount_paid: number;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Review Tokens ────────────────────────────────────────────────────────────
export interface ReviewToken {
  id: string;
  token: string;
  project_id: string;
  client_name: string;
  client_email: string;
  is_active: boolean;
  last_viewed_at?: string;
  created_at: string;
}

export interface PortalDeliverable {
  id: string;
  label: string;
  done: boolean;
}
