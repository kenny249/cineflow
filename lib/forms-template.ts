import type { FormQuestion } from "@/types";

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
