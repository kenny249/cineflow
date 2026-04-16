// ─── Shared Types ───────────────────────────────────────────────────────────

export type PlanType = "solo_beta" | "studio_beta" | "solo_pro" | "studio_pro";

export function isSoloPlan(plan?: PlanType | string | null): boolean {
  return plan === "solo_beta" || plan === "solo_pro";
}

export interface PaymentSettings {
  stripe_secret_key?: string;
  paypal_me_username?: string;
  zelle_contact?: string;
  ach_bank_name?: string;
  ach_routing?: string;
  ach_account?: string;
  wire_instructions?: string;
  check_payable_to?: string;
  check_mail_to?: string;
  resend_api_key?: string;
  invoice_from_email?: string;
  invoice_from_name?: string;
}

export interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  avatar_url?: string;
  role?: string;
  plan?: PlanType;
  business_name?: string;
  logo_url?: string;
  business_address?: string; // legacy single-string fallback
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  business_phone?: string;
  business_website?: string;
  payment_settings?: PaymentSettings;
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
  client_email?: string;
  status: ProjectStatus;
  type: ProjectType;
  progress: number;
  phase_items?: string[];
  due_date?: string;
  shoot_date?: string;
  thumbnail_url?: string;
  created_by?: string;
  owner_id?: string;
  tags?: string[];
  deleted_at?: string;
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
  image_url?: string;
  duration_seconds?: number;
  camera_angle?: string;
  props?: string[];
  actors?: string[];
  shoot_day_id?: string;
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
  shot_type?: string;
  mood?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

// ─── Revisions ────────────────────────────────────────────────────────────────

export interface RevisionComment {
  id: string;
  revision_id: string;
  parent_id?: string;
  author_id?: string;
  author_name?: string;
  author?: Profile;
  content: string;
  timestamp_seconds?: number;
  replies?: RevisionComment[];
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
  meeting_link?: string;
  recurrence_rule?: "daily" | "weekly" | "monthly";
  recurrence_end_date?: string;
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
export type PaymentMethod = "stripe" | "paypal" | "zelle" | "ach" | "wire" | "check";
export type PaymentTerms = "due_on_receipt" | "net15" | "net30" | "net60";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

export interface Invoice {
  id: string;
  project_id?: string;
  invoice_number: string;
  client_name?: string;
  client_email?: string;
  description?: string;
  amount: number;
  status: InvoiceStatus;
  amount_paid: number;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  line_items?: LineItem[];
  tax_rate?: number;
  currency?: string;
  payment_method?: PaymentMethod;
  payment_link?: string;
  payment_terms?: PaymentTerms;
  accepted_payment_methods?: string[];
  invoice_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Client Contacts ─────────────────────────────────────────────────────────
export interface ClientContact {
  id: string;
  user_id: string;
  client_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  created_at: string;
  updated_at: string;
}

// ─── Project Tasks ───────────────────────────────────────────────────────────
export type ProjectTaskType = "general" | "pre_production" | "production" | "post_production" | "admin";
export type ProjectTaskStatus = "todo" | "in_progress" | "done";

export interface ProjectTask {
  id: string;
  created_by?: string;
  project_id?: string;
  project?: Pick<Project, "id" | "title">;
  title: string;
  description?: string;
  type: ProjectTaskType;
  priority: TaskPriority;
  status: ProjectTaskStatus;
  due_date?: string;
  assignee_name?: string;
  created_at: string;
  updated_at?: string;
}

// ─── Contracts ───────────────────────────────────────────────────────────────
export type ContractStatus = "draft" | "sent" | "signed" | "declined" | "voided";
export type ContractRecipientRole = "client" | "crew" | "talent" | "location" | "vendor" | "other";

export type SignatureFieldType = "signature" | "text" | "date";

export interface SignatureField {
  id: string;
  page: number;        // 1-based page number
  x: number;          // PDF points from bottom-left
  y: number;
  width: number;
  height: number;
  role: "sender" | "recipient";
  type?: SignatureFieldType;  // defaults to "signature" if omitted
  value?: string;             // pre-filled value for text/date fields
}

export interface Contract {
  id: string;
  created_by?: string;
  project_id?: string;
  project?: Pick<Project, "id" | "title">;
  title: string;
  description?: string;
  file_url?: string;
  status: ContractStatus;
  recipient_name?: string;
  recipient_email?: string;
  recipient_role?: ContractRecipientRole;
  signing_token?: string;
  sent_at?: string;
  signed_at?: string;
  created_at: string;
  updated_at?: string;
  // Signature placement
  signature_fields?: SignatureField[];
  sender_name?: string;
  sender_signature_data?: string;
  sender_signed_at?: string;
  signed_pdf_url?: string;
}

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_name?: string;
  signer_email?: string;
  signature_data: string;
  signed_at: string;
  ip_address?: string;
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

// ─── Forms / Questionnaires ───────────────────────────────────────────────────

export type FormQuestionType = "short_text" | "long_text" | "single_choice" | "multi_select";

export interface FormQuestion {
  id: string;
  section: string;
  type: FormQuestionType;
  question: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface CineForm {
  id: string;
  created_by: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
  status: "active" | "closed";
  token: string;
  response_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormResponse {
  id: string;
  form_id: string;
  respondent_name?: string;
  respondent_email?: string;
  answers: Record<string, string | string[]>;
  submitted_at: string;
}

// ─── Video Deliverables (Final Client Delivery) ───────────────────────────────

export type VideoDeliverableType = "short" | "youtube" | "web_video" | "podcast" | "photo" | "other";
export type VideoDeliverableStatus = "draft" | "delivered";

export interface VideoDeliverable {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  type: VideoDeliverableType;
  url: string;
  notes?: string;
  status: VideoDeliverableStatus;
  delivered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientPortal {
  id: string;
  created_by: string;
  client_name: string;
  token: string;
  is_active: boolean;
  created_at: string;
}

// ─── Retainers ────────────────────────────────────────────────────────────────

export interface RetainerTemplateItem {
  type: string;   // "short" | "photo" | "premium" | "other" | custom string
  label: string;  // display name e.g. "Short-form Videos"
  quantity: number;
  mode?: "individual" | "batch"; // individual = one row per item; batch = one row for the whole group
}

export interface Retainer {
  id: string;
  created_by: string;
  client_name: string;
  monthly_rate?: number;
  template: RetainerTemplateItem[];
  notes?: string;
  is_active: boolean;
  start_date?: string;
  created_at: string;
  updated_at: string;
}

export type RetainerMonthStatus = "planning" | "active" | "wrapped" | "invoiced";

export interface RetainerMonth {
  id: string;
  retainer_id: string;
  created_by: string;
  month_year: string; // "2026-04"
  status: RetainerMonthStatus;
  shoot_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type RetainerDeliverableStatus = "planned" | "shot" | "delivered";

export interface RetainerDeliverable {
  id: string;
  month_id: string;
  created_by: string;
  title: string;
  type: string;
  status: RetainerDeliverableStatus;
  notes?: string;
  sort_order: number;
  created_at: string;
}
