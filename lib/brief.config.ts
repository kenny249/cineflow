// ─── CineFlow Company Brief ──────────────────────────────────────────────────
// Update this file whenever features, pricing, or positioning changes.
// The admin Brief tab reads this directly — push to main and it's live.

export const BRIEF = {
  company: {
    name: "CineFlow",
    tagline: "The all-in-one platform built for professional filmmakers.",
    website: "usecineflow.com",
    founded: "2026",
    stage: "Bootstrapped · Beta → Public Launch 2026",
    mission:
      "To give independent filmmakers and production teams a single, purpose-built platform that eliminates the chaos of juggling 10+ disconnected tools — so they can focus on the work that matters.",
    vision:
      "Every filmmaker, from solo freelancer to boutique agency, runs their entire business on CineFlow: from first client call to final delivery and beyond.",
    targetUser:
      "Independent video editors, cinematographers, and small production companies (1–10 people) who manage client work, shoot projects, and need professional-grade tooling without enterprise pricing.",
  },

  problem: {
    headline: "Filmmakers are drowning in disconnected tools",
    points: [
      { stat: "10+", label: "tools the average filmmaker uses", detail: "Frame.io, Google Drive, Slack, email, spreadsheets, Calendly, Wave, DocuSign, StudioBinder, Notion…" },
      { stat: "$80–$150", label: "per month on fragmented SaaS", detail: "Most tools aren't built for filmmakers — they're generic software bolted together." },
      { stat: "5–10 hrs", label: "lost per week to admin overhead", detail: "Chasing client feedback, manually updating shot lists, sending invoices, scheduling — none of this is filmmaking." },
      { stat: "0", label: "platforms built specifically for this workflow", detail: "Frame.io handles review. StudioBinder handles pre-production. Neither does both, let alone invoicing, AI, or client portals." },
    ],
  },

  solution: {
    headline: "CineFlow: One platform. Your entire workflow.",
    description:
      "CineFlow consolidates every tool a filmmaker needs — project management, client portals, AI-powered production tools, contracts, invoicing, crew management, and more — into a single, beautifully designed platform built from the ground up for how filmmakers actually work.",
  },

  features: [
    {
      name: "Project Management",
      icon: "FolderOpen",
      description: "Full project lifecycle from quote to delivery. Status tracking, production stages, deliverables, and client milestones in one place.",
      highlights: ["Kanban + list views", "Production stage tracking", "Deliverable management", "AI-powered project breakdowns"],
    },
    {
      name: "Client Portal",
      icon: "MonitorPlay",
      description: "Beautiful, branded review links and digital intake forms that make clients look forward to giving feedback.",
      highlights: ["Video review with timestamp comments", "Digital contracts & intake forms", "Client-facing project status", "Branded experience"],
    },
    {
      name: "AI Production Tools",
      icon: "Sparkles",
      description: "Claude-powered AI woven throughout the platform — from script breakdown to audio transcription to cut list generation.",
      highlights: ["AI script breakdown → shot lists", "AI cut list & content intelligence", "Audio transcription (Whisper)", "AI-generated production briefs"],
    },
    {
      name: "Collaborator Workspace",
      icon: "Users",
      description: "Real-time team collaboration with chat, task management, shared files, and production scheduling.",
      highlights: ["Team chat per project", "Shared task boards (Kanban)", "File library", "Production schedule & call sheets"],
    },
    {
      name: "Contracts & Invoicing",
      icon: "FileText",
      description: "Built-in finance tools so filmmakers never need a separate accounting app for client billing.",
      highlights: ["Stripe-powered invoicing", "Contract creation & e-signing", "Quote builder", "Retainer management"],
    },
    {
      name: "Shot Lists & Storyboards",
      icon: "Camera",
      description: "Visual production planning tools purpose-built for how directors and DPs think.",
      highlights: ["Shot list builder", "AI-assisted breakdown from script", "Storyboard frames", "Equipment tracking per shot"],
    },
    {
      name: "Crew Management",
      icon: "UserCheck",
      description: "Manage your entire production network — contacts, roles, availability, and project assignments.",
      highlights: ["Crew contact database", "Role & department tracking", "Project-based crew assignments", "Location management"],
    },
    {
      name: "Editor Tools",
      icon: "Wrench",
      description: "A dedicated toolkit for post-production professionals — the tools editors actually reach for every day.",
      highlights: ["Session time logger", "Timecode calculator", "Delivery spec reference", "Audio transcriber with AI analysis"],
    },
    {
      name: "Drone Operations",
      icon: "Wind",
      description: "FAA waiver tracking, flight log management, and drone-specific production planning.",
      highlights: ["FAA waiver management", "Flight logs", "Equipment tracking", "Location clearance notes"],
    },
    {
      name: "Retainer Management",
      icon: "RefreshCw",
      description: "Full retainer lifecycle for agencies managing ongoing client relationships and monthly deliverables.",
      highlights: ["Monthly retainer contracts", "Deliverable tracking per period", "Client-facing status", "Billing integration"],
    },
    {
      name: "Business Analytics",
      icon: "BarChart2",
      description: "Revenue tracking, project profitability, and business health — visible to the filmmaker, not just accountants.",
      highlights: ["Revenue over time", "Project profitability", "Client lifetime value", "Admin portal for full oversight"],
    },
  ],

  pricing: {
    tiers: [
      {
        name: "Solo",
        price: 39,
        period: "mo",
        seats: 1,
        tagline: "Independent editors & cinematographers",
        highlights: ["All core features", "Up to 10 active projects", "Client portal", "AI tools", "Invoicing"],
      },
      {
        name: "Studio",
        price: 79,
        period: "mo",
        seats: 3,
        tagline: "Small production companies",
        highlights: ["Everything in Solo", "3 team seats", "Unlimited projects", "Collaborator workspace", "Priority support"],
      },
      {
        name: "Agency",
        price: 159,
        period: "mo",
        seats: 10,
        tagline: "Growing agencies",
        highlights: ["Everything in Studio", "10 team seats", "White label options", "Advanced analytics", "Retainer management"],
      },
      {
        name: "Enterprise",
        price: 299,
        period: "mo",
        seats: 999,
        tagline: "Large production companies",
        highlights: ["Everything in Agency", "Unlimited seats", "Custom branding", "Dedicated support", "Custom integrations"],
      },
    ],
    lifetime: {
      price: 299,
      description: "One-time payment · Solo-level access · 1 seat · No recurring fees",
    },
  },

  competitors: {
    columns: ["CineFlow", "Frame.io", "StudioBinder", "Wipster", "Vimeo Review", "Notion"],
    monthlyPrice: [39, 25, 29, 25, "Bundled", 16],
    rows: [
      { feature: "Built for filmmakers", values: [true, false, true, false, false, false] },
      { feature: "Project management", values: [true, false, true, false, false, true] },
      { feature: "Client review portal", values: [true, true, true, true, true, false] },
      { feature: "AI-powered tools", values: [true, false, false, false, false, false] },
      { feature: "Invoicing & billing", values: [true, false, false, false, false, false] },
      { feature: "Contracts & e-sign", values: [true, false, false, false, false, false] },
      { feature: "Team collaboration", values: [true, true, false, false, false, true] },
      { feature: "Shot lists & storyboards", values: [true, false, true, false, false, false] },
      { feature: "Crew management", values: [true, false, true, false, false, false] },
      { feature: "Audio transcription", values: [true, false, false, false, false, false] },
      { feature: "Drone operations", values: [true, false, false, false, false, false] },
      { feature: "Retainer management", values: [true, false, false, false, false, false] },
      { feature: "All-in-one (no integrations)", values: [true, false, false, false, false, false] },
    ],
    savingsNote: "A typical filmmaker using Frame.io + StudioBinder alone spends $54+/mo. CineFlow's Solo plan ($39/mo) replaces both and adds AI, invoicing, contracts, and more.",
  },

  market: {
    tam: { value: "$6.7B", label: "Global video production software market (2026 est.)", growth: "8.2% CAGR" },
    sam: { value: "$1.2B", label: "Freelance & independent production company segment" },
    target: { value: "750K+", label: "Freelance video editors & small production companies in the US alone" },
    tailwinds: [
      "Creator economy growing 20%+ YoY — more independent filmmakers than ever",
      "AI tools becoming table stakes — early movers capture loyalty",
      "Remote production teams need cloud-native tooling",
      "Rising Stripe/payment tooling adoption in creative industries",
    ],
  },

  roi: {
    savings: [
      { tool: "Frame.io (Pro)", cost: 25, replacedBy: "Client portal + video review" },
      { tool: "StudioBinder (Indie)", cost: 29, replacedBy: "Project mgmt + shot lists + crew" },
      { tool: "DocuSign / HelloSign", cost: 20, replacedBy: "Built-in contracts" },
      { tool: "Wave / FreshBooks", cost: 16, replacedBy: "Built-in invoicing" },
      { tool: "Notion (for production)", cost: 16, replacedBy: "Project workspace" },
    ],
    totalReplaced: 106,
    cineflowCost: 39,
    monthlySavings: 67,
    timePerWeek: "5–10 hours saved on admin tasks",
    annualSavings: 804,
  },

  tech: {
    stack: ["Next.js 15 (App Router)", "Supabase (Postgres + Auth + Storage)", "Stripe (billing)", "OpenAI Whisper (transcription)", "Anthropic Claude (AI features)", "Vercel (deployment)", "Resend (email)"],
    highlights: [
      "100% cloud-native — no install required, works on any device",
      "Real-time collaboration via Supabase subscriptions",
      "SOC 2-ready infrastructure (Supabase + Vercel)",
      "Sub-100ms global edge delivery via Vercel",
    ],
  },
} as const;

export type BriefConfig = typeof BRIEF;
