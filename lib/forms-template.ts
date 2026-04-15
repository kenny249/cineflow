import type { FormQuestion } from "@/types";

// ── Production Intake (existing) ──────────────────────────────────────────────

export const PRODUCTION_INTAKE_QUESTIONS: FormQuestion[] = [
  // ── About You ──────────────────────────────────────────────────────────────
  { id: "q_name",     section: "About You", type: "short_text",    question: "Your name",           required: true },
  { id: "q_company",  section: "About You", type: "short_text",    question: "Company / Brand name", required: false },
  { id: "q_referral", section: "About You", type: "single_choice", question: "How did you hear about us?", required: false,
    options: ["Referral from a friend", "Instagram", "Google", "LinkedIn", "Past client", "Other"] },

  // ── The Project ────────────────────────────────────────────────────────────
  { id: "q_project_type", section: "The Project", type: "single_choice", question: "What type of project is this?", required: true,
    options: ["Brand / commercial video", "Social media content", "Event coverage", "Documentary / long-form", "Music video", "Corporate / internal", "Real estate", "Other"] },
  { id: "q_deliverables", section: "The Project", type: "single_choice", question: "How many deliverables are you looking for?", required: false,
    options: ["1 hero video", "1 hero + 2–3 social cuts", "Full content package (5+ pieces)", "Not sure yet"] },
  { id: "q_length", section: "The Project", type: "single_choice", question: "Approximate video length?", required: false,
    options: ["Under 60 seconds", "1–3 minutes", "3–5 minutes", "5+ minutes", "Mix of lengths / not sure"] },

  // ── Timeline ───────────────────────────────────────────────────────────────
  { id: "q_shoot_date", section: "Timeline", type: "single_choice", question: "Do you have a shoot date in mind?", required: false,
    options: ["Within the next 2 weeks", "Within the next month", "1–3 months out", "Just exploring right now"] },
  { id: "q_deadline", section: "Timeline", type: "single_choice", question: "Is there a hard delivery deadline?", required: false,
    options: ["Yes — tied to a launch, event, or campaign", "No, flexible", "Not sure"] },

  // ── Budget ─────────────────────────────────────────────────────────────────
  { id: "q_budget", section: "Budget", type: "single_choice", question: "What's your budget range?", required: true,
    options: ["Under $2,500", "$2,500–$5,000", "$5,000–$10,000", "$10,000–$20,000", "$20,000–$50,000", "$50,000+", "I'd like a recommendation based on my needs"] },
  { id: "q_budget_flex", section: "Budget", type: "single_choice", question: "Is your budget flexible if the right concept comes along?", required: false,
    options: ["Yes, if it's the right fit", "No, it's fixed", "Unsure"] },

  // ── Location & Logistics ───────────────────────────────────────────────────
  { id: "q_location", section: "Location & Logistics", type: "multi_select", question: "Where will the shoot take place?", required: false,
    options: ["Client's office / space", "Studio", "On location / outdoors", "Multiple locations", "Travel required", "TBD"] },
  { id: "q_shoot_days", section: "Location & Logistics", type: "single_choice", question: "How many shoot days are you expecting?", required: false,
    options: ["Half day (4 hrs)", "Full day (8 hrs)", "2 days", "3+ days", "Not sure"] },

  // ── Talent ─────────────────────────────────────────────────────────────────
  { id: "q_talent", section: "Talent", type: "single_choice", question: "Do you have on-camera talent ready?", required: false,
    options: ["Yes, confirmed", "Yes, but they'll need direction", "No — need help sourcing", "It's just us / our internal team", "No on-camera talent needed"] },
  { id: "q_hmua",   section: "Talent", type: "single_choice", question: "Will you need hair & makeup?",   required: false, options: ["Yes", "No", "Not sure"] },
  { id: "q_vo",     section: "Talent", type: "single_choice", question: "Voice over needed?",             required: false, options: ["Yes", "No", "Maybe"] },

  // ── Creative Direction ─────────────────────────────────────────────────────
  { id: "q_tone", section: "Creative Direction", type: "multi_select", question: "What tone are you going for?", required: false,
    options: ["Cinematic & premium", "Documentary / authentic", "Corporate & polished", "Fun & energetic", "Minimal & editorial", "Emotional / story-driven", "Open to your direction"] },
  { id: "q_script", section: "Creative Direction", type: "single_choice", question: "Do you have a script or brief ready?", required: false,
    options: ["Yes, fully written", "Rough outline only", "No — need help developing it", "Open to your creative direction entirely"] },
  { id: "q_references", section: "Creative Direction", type: "long_text", question: "Any reference videos or brands that inspire you?", required: false,
    placeholder: "Share links, names, or just describe the vibe" },
  { id: "q_brand", section: "Creative Direction", type: "single_choice", question: "Do you have brand guidelines?", required: false,
    options: ["Yes — full package (colors, fonts, logos)", "Partial — logo only", "No"] },

  // ── Post-Production ────────────────────────────────────────────────────────
  { id: "q_music",     section: "Post-Production", type: "single_choice", question: "Music approach?", required: false,
    options: ["Licensed stock (included in most packages)", "Original custom score", "I'll provide it", "No music needed / not sure"] },
  { id: "q_mograph",   section: "Post-Production", type: "single_choice", question: "Motion graphics or animation needed?", required: false,
    options: ["Title cards / lower thirds only", "Full motion graphics package", "No / not sure"] },
  { id: "q_captions",  section: "Post-Production", type: "single_choice", question: "Captions or subtitles?",               required: false, options: ["Yes", "No", "Not sure"] },
  { id: "q_revisions", section: "Post-Production", type: "single_choice", question: "How many revision rounds are you expecting?", required: false,
    options: ["1 round", "2 rounds", "3 rounds", "Hourly / as needed"] },

  // ── Distribution & Usage ───────────────────────────────────────────────────
  { id: "q_distribution", section: "Distribution & Usage", type: "multi_select", question: "Where will this content live?", required: false,
    options: ["Website / landing page", "Instagram / TikTok / social", "YouTube", "Broadcast / TV", "Paid digital ads", "Internal use / presentations"] },
  { id: "q_usage", section: "Distribution & Usage", type: "single_choice", question: "Usage rights needed?", required: false,
    options: ["1 year", "3 years", "Unlimited / perpetual", "Full buyout", "Not sure"] },

  // ── Final ──────────────────────────────────────────────────────────────────
  { id: "q_experience", section: "Final", type: "single_choice", question: "Have you worked with a production company before?", required: false,
    options: ["Yes, regularly", "A few times", "No, this is my first time", "No, but managed productions internally"] },
  { id: "q_notes", section: "Final", type: "long_text", question: "Anything else we should know?", required: false,
    placeholder: "Timeline pressures, stakeholders, budget context, past experiences — anything that helps us understand what you need" },
];

// ── Talent Intake ─────────────────────────────────────────────────────────────

export const TALENT_INTAKE_QUESTIONS: FormQuestion[] = [
  { id: "t_name",       section: "About You",   type: "short_text",    question: "Full name",                   required: true },
  { id: "t_pronouns",   section: "About You",   type: "single_choice", question: "Pronouns",                    required: false,
    options: ["He / Him", "She / Her", "They / Them", "Prefer not to say"] },
  { id: "t_email",      section: "Contact",     type: "short_text",    question: "Email address",               required: true },
  { id: "t_phone",      section: "Contact",     type: "short_text",    question: "Phone number",                required: false },
  { id: "t_agency",     section: "Contact",     type: "short_text",    question: "Agency or management (if any)", required: false },
  { id: "t_union",      section: "Experience",  type: "single_choice", question: "Union status",                required: false,
    options: ["SAG-AFTRA", "Non-union", "Open to either", "Unsure"] },
  { id: "t_experience", section: "Experience",  type: "single_choice", question: "Years of on-camera experience", required: false,
    options: ["This is my first time", "1–2 years", "3–5 years", "5–10 years", "10+ years"] },
  { id: "t_reel",       section: "Experience",  type: "short_text",    question: "Link to headshot, reel, or portfolio", required: false },
  { id: "t_skills",     section: "Skills",      type: "multi_select",  question: "Special skills", required: false,
    options: ["Dancing", "Stunt work", "Horseback riding", "Driving (specialty vehicles)", "Musical instruments", "Foreign language / accents", "Martial arts", "Athletics / sports", "None of the above"] },
  { id: "t_languages",  section: "Skills",      type: "short_text",    question: "Languages spoken fluently", required: false },
  { id: "t_dietary",    section: "Logistics",   type: "short_text",    question: "Dietary restrictions or allergies", required: false },
  { id: "t_emergency",  section: "Logistics",   type: "short_text",    question: "Emergency contact name & phone number", required: false },
];

// ── Location Scouting ─────────────────────────────────────────────────────────

export const LOCATION_SCOUTING_QUESTIONS: FormQuestion[] = [
  { id: "l_name",        section: "The Location", type: "short_text",    question: "Location name or description",  required: true },
  { id: "l_address",     section: "The Location", type: "short_text",    question: "Full address or general area",  required: true },
  { id: "l_type",        section: "The Location", type: "single_choice", question: "Location type",                 required: true,
    options: ["Residential home", "Commercial / office", "Industrial / warehouse", "Outdoor / nature", "Rooftop", "Studio / creative space", "Retail", "Restaurant / cafe", "Other"] },
  { id: "l_sqft",        section: "The Location", type: "short_text",    question: "Approximate square footage or capacity", required: false },
  { id: "l_natural",     section: "Environment", type: "single_choice",  question: "Natural light availability",    required: false,
    options: ["Excellent — large windows / open air", "Moderate", "Limited", "None / fully enclosed"] },
  { id: "l_dates",       section: "Availability", type: "short_text",   question: "Available dates or general availability", required: false },
  { id: "l_parking",     section: "Logistics",   type: "single_choice", question: "Parking available?",            required: false,
    options: ["Yes — on-site, free", "Yes — on-site, paid", "Street parking nearby", "No parking available"] },
  { id: "l_power",       section: "Logistics",   type: "multi_select",  question: "Power access",                  required: false,
    options: ["Standard outlets (120V)", "High-amperage / 3-phase", "Generator friendly", "Limited / no access"] },
  { id: "l_restrictions", section: "Rules",      type: "long_text",     question: "Any restrictions we should know about?", required: false,
    placeholder: "Noise curfews, no smoking, catering rules, number of crew, etc." },
  { id: "l_rate",        section: "Pricing",     type: "short_text",    question: "Daily rental rate (if any)",    required: false },
  { id: "l_contact",     section: "Contact",     type: "short_text",    question: "Best contact name & phone number", required: true },
];

// ── Client Feedback ───────────────────────────────────────────────────────────

export const CLIENT_FEEDBACK_QUESTIONS: FormQuestion[] = [
  { id: "f_name",       section: "About You",      type: "short_text",    question: "Your name",              required: false },
  { id: "f_project",    section: "About You",      type: "short_text",    question: "Project name",           required: false },
  { id: "f_overall",    section: "Your Experience", type: "single_choice", question: "Overall satisfaction with the final video", required: true,
    options: ["5 — Exceeded expectations", "4 — Very satisfied", "3 — Satisfied", "2 — Needs improvement", "1 — Disappointed"] },
  { id: "f_quality",    section: "Your Experience", type: "single_choice", question: "Video quality and production value", required: false,
    options: ["Exceptional", "Very good", "Good", "Fair", "Below expectations"] },
  { id: "f_comms",      section: "Your Experience", type: "single_choice", question: "Communication throughout the project", required: false,
    options: ["Exceptional", "Very good", "Good", "Fair", "Below expectations"] },
  { id: "f_timeline",   section: "Your Experience", type: "single_choice", question: "Was the project delivered on time?", required: false,
    options: ["Yes, on or ahead of schedule", "Slightly delayed but acceptable", "There were significant delays"] },
  { id: "f_well",       section: "Feedback",        type: "long_text",     question: "What did we do particularly well?", required: false,
    placeholder: "We'd love to hear what stood out" },
  { id: "f_improve",    section: "Feedback",        type: "long_text",     question: "What could we improve for next time?", required: false,
    placeholder: "Honest feedback helps us serve you better" },
  { id: "f_again",      section: "Looking Ahead",   type: "single_choice", question: "Would you work with us again?", required: false,
    options: ["Absolutely", "Probably", "Not sure", "Unlikely"] },
  { id: "f_recommend",  section: "Looking Ahead",   type: "single_choice", question: "How likely are you to recommend us?", required: false,
    options: ["10 — Definitely", "8–9 — Very likely", "6–7 — Maybe", "Under 6 — Unlikely"] },
  { id: "f_testimonial", section: "Testimonial",    type: "long_text",     question: "Would you like to leave a testimonial we can use publicly?", required: false,
    placeholder: "Optional — only shared with your permission" },
];

// ── Event Coverage Brief ──────────────────────────────────────────────────────

export const EVENT_COVERAGE_QUESTIONS: FormQuestion[] = [
  { id: "e_name",       section: "The Event",     type: "short_text",    question: "Event name",                     required: true },
  { id: "e_type",       section: "The Event",     type: "single_choice", question: "Type of event",                  required: true,
    options: ["Wedding / celebration", "Corporate event", "Product launch", "Conference / panel", "Concert / performance", "Birthday / milestone", "Networking event", "Other"] },
  { id: "e_date",       section: "The Event",     type: "short_text",    question: "Date and time (including any setup time)", required: true },
  { id: "e_venue",      section: "The Event",     type: "short_text",    question: "Venue name and address",          required: true },
  { id: "e_attendance", section: "The Event",     type: "single_choice", question: "Expected attendance",             required: false,
    options: ["Under 50", "50–150", "150–500", "500–1,000", "1,000+"] },
  { id: "e_moments",    section: "Coverage",      type: "long_text",     question: "Key moments we must capture",     required: true,
    placeholder: "First dance, keynote speech, product reveal, awards, etc." },
  { id: "e_vips",       section: "Coverage",      type: "long_text",     question: "Important people or VIPs we should prioritize", required: false,
    placeholder: "Names, titles, or descriptions of key individuals" },
  { id: "e_schedule",   section: "Coverage",      type: "single_choice", question: "Will you have a run-of-show or program we can reference?", required: false,
    options: ["Yes — I'll send it before the event", "I'll have a loose timeline", "No formal schedule"] },
  { id: "e_restricted", section: "Coverage",      type: "long_text",     question: "Any restricted areas or moments (no filming zones, private portions)?", required: false,
    placeholder: "Let us know what's off limits" },
  { id: "e_dresscode",  section: "Logistics",     type: "single_choice", question: "Dress code for our team",         required: false,
    options: ["Black tie / formal", "Business casual", "Casual", "Creative / themed", "No preference"] },
  { id: "e_deliverables", section: "Deliverables", type: "multi_select", question: "What deliverables do you need?", required: true,
    options: ["Full event highlight reel", "Short social media cut (60s or under)", "Raw / unedited footage", "Same-day edit", "Photo stills", "Multi-cam edit", "Interview / testimonials"] },
  { id: "e_delivery",   section: "Deliverables",  type: "single_choice", question: "Preferred delivery timeline",     required: false,
    options: ["Same day", "Within 48 hours", "Within 1 week", "2–3 weeks", "Flexible"] },
  { id: "e_notes",      section: "Final",          type: "long_text",     question: "Anything else we need to know before the event?", required: false,
    placeholder: "Parking, load-in instructions, points of contact on the day, etc." },
];

// ── Revision Request ──────────────────────────────────────────────────────────

export const REVISION_REQUEST_QUESTIONS: FormQuestion[] = [
  { id: "r_project",   section: "Project Info",  type: "short_text",    question: "Project / video name",          required: true },
  { id: "r_version",   section: "Project Info",  type: "short_text",    question: "Which edit version is this feedback on? (e.g. V1, V2)", required: true },
  { id: "r_overall",   section: "Your Feedback", type: "single_choice", question: "Overall impression of the current cut", required: true,
    options: ["Love it — just small tweaks", "Getting there — some notable changes needed", "Significant changes required", "Not quite the right direction yet"] },
  { id: "r_sections",  section: "Your Feedback", type: "long_text",     question: "Specific sections or timecodes to change", required: false,
    placeholder: "e.g. 0:12 — remove the pause. 0:45–0:58 — this section feels slow." },
  { id: "r_remove",    section: "Your Feedback", type: "long_text",     question: "Anything you'd like removed from the edit?", required: false,
    placeholder: "Shots, music moments, interview clips, etc." },
  { id: "r_add",       section: "Your Feedback", type: "long_text",     question: "Anything you'd like added or included?", required: false,
    placeholder: "Specific shots, text, logos, b-roll, etc." },
  { id: "r_music",     section: "Audio & Look",  type: "single_choice", question: "Any music changes?", required: false,
    options: ["No — keep it as is", "Yes — I'll explain in notes", "Open to your suggestion"] },
  { id: "r_color",     section: "Audio & Look",  type: "single_choice", question: "Any color or grade changes?", required: false,
    options: ["No — looks great", "Slightly brighter", "Slightly moodier / darker", "More saturated", "More neutral / clean", "Please describe in notes"] },
  { id: "r_deadline",  section: "Timeline",      type: "single_choice", question: "When do you need this revision back?", required: false,
    options: ["As soon as possible", "Within 48 hours", "Within 1 week", "No hard deadline"] },
];

// ── Template metadata (used by the picker UI) ─────────────────────────────────

export type FormTemplateId =
  | "production_intake"
  | "talent_intake"
  | "location_scouting"
  | "client_feedback"
  | "event_coverage"
  | "revision_request"
  | "blank";

export interface FormTemplateMeta {
  id: FormTemplateId;
  name: string;
  description: string;
  questionCount: number;
  category: "Client" | "Talent" | "Production" | "Post" | "Custom";
  categoryColor: string;
  tags: string[];
}

export const FORM_TEMPLATES: FormTemplateMeta[] = [
  {
    id: "production_intake",
    name: "Production Intake",
    description: "Full pre-production questionnaire. Covers budget, timeline, deliverables, creative direction, and logistics. Send this before quoting any project.",
    questionCount: PRODUCTION_INTAKE_QUESTIONS.length,
    category: "Client",
    categoryColor: "bg-sky-400/15 text-sky-400",
    tags: ["budget", "timeline", "deliverables", "creative", "client"],
  },
  {
    id: "event_coverage",
    name: "Event Coverage Brief",
    description: "Everything you need before shooting an event. Key moments, VIPs, schedule, deliverables, and day-of logistics all in one form.",
    questionCount: EVENT_COVERAGE_QUESTIONS.length,
    category: "Production",
    categoryColor: "bg-emerald-400/15 text-emerald-400",
    tags: ["event", "wedding", "corporate", "coverage", "day-of"],
  },
  {
    id: "talent_intake",
    name: "Talent Intake",
    description: "Send to on-camera talent before a shoot. Collects availability, experience, special skills, union status, and emergency contacts.",
    questionCount: TALENT_INTAKE_QUESTIONS.length,
    category: "Talent",
    categoryColor: "bg-purple-400/15 text-purple-400",
    tags: ["talent", "casting", "availability", "skills"],
  },
  {
    id: "location_scouting",
    name: "Location Scouting",
    description: "Send to location owners or scouts. Covers logistics, power access, parking, restrictions, and rental rates.",
    questionCount: LOCATION_SCOUTING_QUESTIONS.length,
    category: "Production",
    categoryColor: "bg-emerald-400/15 text-emerald-400",
    tags: ["location", "scouting", "permits", "logistics"],
  },
  {
    id: "client_feedback",
    name: "Client Feedback",
    description: "Post-project satisfaction survey. Captures ratings, testimonials, and improvement areas. Great for building your reputation.",
    questionCount: CLIENT_FEEDBACK_QUESTIONS.length,
    category: "Post",
    categoryColor: "bg-amber-400/15 text-amber-400",
    tags: ["feedback", "review", "testimonial", "satisfaction"],
  },
  {
    id: "revision_request",
    name: "Revision Request",
    description: "Structured form for clients to submit edit feedback clearly. Reduces email back-and-forth and keeps revision notes organized.",
    questionCount: REVISION_REQUEST_QUESTIONS.length,
    category: "Post",
    categoryColor: "bg-amber-400/15 text-amber-400",
    tags: ["revisions", "edits", "feedback", "post-production"],
  },
  {
    id: "blank",
    name: "Blank Form",
    description: "Start from scratch and build a fully custom form tailored to your exact needs.",
    questionCount: 0,
    category: "Custom",
    categoryColor: "bg-muted/60 text-muted-foreground",
    tags: ["custom", "blank"],
  },
];

export function getTemplateQuestions(templateId: FormTemplateId): FormQuestion[] {
  switch (templateId) {
    case "production_intake":  return PRODUCTION_INTAKE_QUESTIONS;
    case "talent_intake":      return TALENT_INTAKE_QUESTIONS;
    case "location_scouting":  return LOCATION_SCOUTING_QUESTIONS;
    case "client_feedback":    return CLIENT_FEEDBACK_QUESTIONS;
    case "event_coverage":     return EVENT_COVERAGE_QUESTIONS;
    case "revision_request":   return REVISION_REQUEST_QUESTIONS;
    case "blank":              return [];
    default:                   return PRODUCTION_INTAKE_QUESTIONS;
  }
}
