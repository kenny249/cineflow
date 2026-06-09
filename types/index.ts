// ─── Shared Types ───────────────────────────────────────────────────────────

export type PlanType =
  | "solo_beta"
  | "studio_beta"
  | "solo"
  | "studio"
  | "agency"
  | "enterprise"
  | "lifetime";

export function isSoloPlan(plan?: PlanType | string | null): boolean {
  return plan === "solo_beta" || plan === "solo";
}

export interface PaymentSettings {
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
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
  brand_color?: string;
  is_collaborator?: boolean;
  quick_actions?: string[];
  referral_code?: string | null;
  referred_by?: string | null;
  is_admin?: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan_interval?: "month" | "year" | "lifetime" | null;
  plan_status?: "trialing" | "active" | "past_due" | "canceled" | "founding" | null;
  trial_ends_at?: string | null;
  trial_reminders_sent?: string[] | null;
  current_period_end?: string | null;
  seat_count?: number | null;
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
  delivery_platform?: string;
  delivery_url?: string;
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

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  invited_by: string;
  user_id: string | null;
  email: string;
  name: string;
  role?: string | null;
  status: "pending" | "active" | "inactive";
  permissions: string[];
  created_at: string;
}

export interface CrewCall {
  id: string;
  shoot_day_id: string;
  project_id: string;
  collaborator_id?: string | null;
  name: string;
  role?: string | null;
  call_time: string;
  sort_order: number;
  created_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  author_id?: string;
  author?: Profile;
  author_name?: string;
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
  completion_note?: string;
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
  assigned_to?: string;
  assigned_to_name?: string;
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

export interface PaymentInstallment {
  id: string;
  label: string;
  amount: number;
  due_date?: string;
  status: "unpaid" | "paid";
  paid_at?: string;
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
  client_address?: string;
  description?: string;
  amount: number;
  status: InvoiceStatus;
  amount_paid: number;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  line_items?: LineItem[];
  tax_rate?: number;
  discount?: number;
  currency?: string;
  payment_method?: PaymentMethod;
  payment_link?: string;
  payment_terms?: PaymentTerms;
  accepted_payment_methods?: string[];
  invoice_date?: string;
  payment_schedule?: PaymentInstallment[];
  po_number?: string;
  brand_color?: string;
  header_color?: string;
  reminders_sent?: Record<string, string>;
  reminders_enabled?: boolean;
  show_signature_lines?: boolean;
  show_rights_notice?: boolean;
  rights_notice_text?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export type QuoteStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
export type QuoteType = "project" | "retainer";

export interface QuotePackage {
  id: string;
  name: string;
  description?: string;
  line_items: LineItem[];
  amount: number;
  highlighted?: boolean;
}

export interface Quote {
  id: string;
  project_id?: string;
  quote_number: string;
  client_name?: string;
  client_email?: string;
  description?: string;
  status: QuoteStatus;
  quote_type: QuoteType;
  amount: number;
  tax_rate?: number;
  discount?: number;
  currency?: string;
  line_items?: LineItem[];
  packages?: QuotePackage[];
  scope_of_work?: string;
  payment_terms?: PaymentTerms;
  notes?: string;
  monthly_rate?: number;
  retainer_months?: number;
  retainer_deliverables?: RetainerTemplateItem[];
  valid_until?: string;
  sent_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  declined_at?: string;
  accepted_name?: string;
  accepted_email?: string;
  accepted_package_id?: string;
  token: string;
  is_active: boolean;
  brand_logo_url?: string;
  brand_name?: string;
  brand_color?: string;
  converted_project_id?: string;
  converted_invoice_id?: string;
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

export interface ShootDay {
  id: string;
  date: string;
  location?: string;
  notes?: string;
}

export interface RetainerTemplateItem {
  type: string;   // "short" | "photo" | "premium" | "other" | custom string
  label: string;  // display name e.g. "Short-form Videos"
  quantity: number;
  mode?: "individual" | "batch"; // individual = one row per item; batch = one row for the whole group
  revisions_included?: number;   // agreed revision rounds per deliverable, e.g. 2
}

export interface Retainer {
  id: string;
  created_by: string;
  client_name: string;
  client_email?: string;
  monthly_rate?: number;
  template: RetainerTemplateItem[];
  notes?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  delivery_folder_url?: string;
  portal_token?: string;
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
  shoot_days?: ShootDay[];
  notes?: string;
  client_notes?: string;
  delivery_url?: string;
  approved_at?: string;
  paid?: boolean;
  created_at: string;
  updated_at: string;
}

export type RetainerDeliverableStatus = "planned" | "shot" | "delivered";

export type RetainerRevisionStatus = 'none' | 'requested' | 'in_progress' | 'resolved';

export interface RetainerDeliverable {
  id: string;
  month_id: string;
  created_by: string;
  title: string;
  type: string;
  status: RetainerDeliverableStatus;
  notes?: string;
  sort_order: number;
  revision_notes?: string;
  revision_count: number;
  revision_status: RetainerRevisionStatus;
  created_at: string;
}

// ─── Crew ─────────────────────────────────────────────────────────────────────

export type CrewAvailability = "available" | "booked" | "unavailable";

export interface CrewProfile {
  id: string;
  added_by: string;
  user_id?: string;
  name: string;
  slug?: string;
  photo_url?: string;
  primary_role: string;
  roles: string[];
  city?: string;
  state?: string;
  country: string;
  skills: string[];
  gear: string[];
  day_rate_min?: number;
  day_rate_max?: number;
  reel_url?: string;
  instagram?: string;
  website?: string;
  email?: string;
  phone?: string;
  bio?: string;
  notes?: string;
  rating?: number;
  availability: CrewAvailability;
  available_from?: string;
  is_public: boolean;
  is_claimed: boolean;
  created_at: string;
  updated_at: string;
}

export type EditSessionCategory = "social" | "commercial" | "narrative" | "documentary" | "corporate" | "other";

export interface EditSession {
  id: string;
  user_id: string;
  task_id?: string | null;
  title: string;
  category: EditSessionCategory;
  duration_secs: number;
  notes?: string | null;
  created_at: string;
}

export const CREW_ROLES = [
  "Director",
  "Director of Photography (DP)",
  "Camera Operator",
  "Drone / Aerial Operator",
  "1st AC / Focus Puller",
  "2nd AC",
  "Steadicam Operator",
  "Editor",
  "Colorist",
  "Sound Mixer / Recordist",
  "Sound Designer",
  "Composer",
  "Gaffer",
  "Key Grip",
  "Production Designer",
  "Art Director",
  "Makeup / Hair",
  "Producer",
  "Line Producer",
  "Production Assistant",
  "Script Supervisor",
  "Motion Graphics Designer",
  "VFX Artist",
  "Photographer",
  "Other",
] as const;

// ── Quote Calculator ──────────────────────────────────────────────────────────

export type CalcCategory =
  | "pre-production"
  | "production"
  | "post-production"
  | "equipment"
  | "travel"
  | "other";

export interface RateCardItem {
  id: string;
  user_id: string;
  name: string;
  category: CalcCategory;
  default_rate: number;
  rate_type: "day" | "flat";
  sort_order: number;
  created_at: string;
}

export interface CalcLineItem {
  id: string;
  service: string;
  category: CalcCategory;
  people: number;
  days: number;
  rate: number;
  rateType: "day" | "unit" | "flat";
  isFlat?: boolean; // deprecated — kept for backward compat with saved estimates
}

export interface QuoteEstimate {
  id: string;
  user_id: string;
  title: string;
  line_items: CalcLineItem[];
  overhead_pct: number;
  floor_mult: number;
  std_mult: number;
  premium_mult: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Drone Module ─────────────────────────────────────────────────────────────

export type DroneStatus = "active" | "in_repair" | "retired";
export type DroneBatteryStatus = "active" | "retired";

export interface DroneEquipment {
  id: string;
  user_id: string;
  make: string;
  model: string;
  nickname?: string | null;
  serial_number?: string | null;
  faa_registration?: string | null;
  purchase_date?: string | null;
  status: DroneStatus;
  notes?: string | null;
  weight_grams?: number | null;
  remote_id_serial?: string | null;
  firmware_version?: string | null;
  insurance_policy?: string | null;
  insurance_expires_at?: string | null;
  created_at: string;
}

export interface DroneBattery {
  id: string;
  user_id: string;
  drone_id?: string | null;
  drone?: Pick<DroneEquipment, "id" | "make" | "model"> | null;
  label: string;
  serial_number?: string | null;
  purchase_date?: string | null;
  cycle_count: number;
  capacity_mah?: number | null;
  status: DroneBatteryStatus;
  notes?: string | null;
  created_at: string;
}

export interface DroneFlightLog {
  id: string;
  user_id: string;
  drone_id?: string | null;
  drone?: Pick<DroneEquipment, "id" | "make" | "model"> | null;
  project_id?: string | null;
  project?: Pick<Project, "id" | "title"> | null;
  flight_date: string;
  location: string;
  duration_minutes: number;
  max_altitude_ft?: number | null;
  purpose?: string | null;
  weather_conditions?: string | null;
  wind_speed_mph?: number | null;
  visibility_miles?: number | null;
  temperature_f?: number | null;
  preflight_completed: boolean;
  preflight_items?: Record<string, boolean> | null;
  notes?: string | null;
  laanc_auth_code?: string | null;
  is_night_flight: boolean;
  incident_flag: boolean;
  incident_notes?: string | null;
  batteries?: { battery: Pick<DroneBattery, "id" | "label" | "cycle_count"> }[];
  created_at: string;
}

export interface DroneMaintenanceLog {
  id: string;
  user_id: string;
  drone_id: string;
  drone?: Pick<DroneEquipment, "id" | "make" | "model"> | null;
  maintenance_date: string;
  maintenance_type: string;
  description?: string | null;
  cost_cents?: number | null;
  next_maintenance_date?: string | null;
  created_at: string;
}
