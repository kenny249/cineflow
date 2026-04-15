"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Search, FileSignature, Shield, MapPin, Users,
  Briefcase, Music2, Camera, FileText, ArrowLeft, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ContractRecipientRole } from "@/types";

// ── Template definitions ───────────────────────────────────────────────────────

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  recipientRole: ContractRecipientRole;
  recipientLabel: string;
  roleColor: string;
  category: string;
  categoryColor: string;
  suggestedTitle: string;
  suggestedDescription: string;
  tips: string[];
  tags: string[];
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "production_agreement",
    name: "Client Production Agreement",
    description: "Your main service contract. Covers scope of work, payment schedule, deliverables, revisions, and usage rights. Send this before any project starts.",
    icon: FileSignature,
    recipientRole: "client",
    recipientLabel: "Client",
    roleColor: "bg-sky-400/15 text-sky-400",
    category: "Client",
    categoryColor: "bg-sky-400/15 text-sky-400",
    suggestedTitle: "Client Production Agreement",
    suggestedDescription: "Service agreement covering project scope, deliverables, payment terms, and usage rights.",
    tips: [
      "Include a payment schedule (e.g. 50% upfront, 50% on delivery)",
      "Specify the number of revision rounds included",
      "Define usage rights clearly — online, broadcast, perpetual, etc.",
    ],
    tags: ["service", "payment", "deliverables", "scope", "client"],
  },
  {
    id: "talent_release",
    name: "Talent / Actor Release",
    description: "Permission agreement for on-camera talent. Covers their image, likeness, and voice for use in the final production across defined media.",
    icon: Users,
    recipientRole: "talent",
    recipientLabel: "Talent",
    roleColor: "bg-purple-400/15 text-purple-400",
    category: "Talent",
    categoryColor: "bg-purple-400/15 text-purple-400",
    suggestedTitle: "Talent Release Agreement",
    suggestedDescription: "Permission for use of talent's image, likeness, and voice in the production.",
    tips: [
      "Specify the exact production name and usage platforms",
      "Include compensation terms (paid, deferred, or gifted)",
      "Note whether the release is exclusive or non-exclusive",
    ],
    tags: ["talent", "actor", "likeness", "release", "on-camera"],
  },
  {
    id: "location_release",
    name: "Location Release",
    description: "Property permission agreement for filming on private or commercial locations. Covers dates, crew access, restoration obligations, and liability.",
    icon: MapPin,
    recipientRole: "location",
    recipientLabel: "Location Owner",
    roleColor: "bg-emerald-400/15 text-emerald-400",
    category: "Production",
    categoryColor: "bg-emerald-400/15 text-emerald-400",
    suggestedTitle: "Location Release Agreement",
    suggestedDescription: "Permission to film on the property, including access dates, crew size, and restoration obligations.",
    tips: [
      "List specific dates and hours of access",
      "Include a restoration / leave-no-trace clause",
      "Clarify who holds liability for property damage",
    ],
    tags: ["location", "property", "filming", "permit", "access"],
  },
  {
    id: "nda",
    name: "Non-Disclosure Agreement",
    description: "Mutual or one-way NDA to protect confidential project details, creative concepts, client information, and proprietary materials.",
    icon: Shield,
    recipientRole: "client",
    recipientLabel: "Client / Partner",
    roleColor: "bg-sky-400/15 text-sky-400",
    category: "Client",
    categoryColor: "bg-sky-400/15 text-sky-400",
    suggestedTitle: "Non-Disclosure Agreement",
    suggestedDescription: "Confidentiality agreement protecting project details, creative concepts, and sensitive information.",
    tips: [
      "Specify whether it's mutual or one-directional",
      "Define the term (e.g. 2 years from signing)",
      "List what's excluded from confidentiality (e.g. publicly known info)",
    ],
    tags: ["nda", "confidentiality", "privacy", "legal"],
  },
  {
    id: "crew_deal_memo",
    name: "Crew Deal Memo",
    description: "Engagement agreement for freelance crew members. Covers role, rate, hours, kit fees, travel, and work-for-hire terms.",
    icon: Briefcase,
    recipientRole: "crew",
    recipientLabel: "Crew Member",
    roleColor: "bg-blue-400/15 text-blue-400",
    category: "Crew",
    categoryColor: "bg-blue-400/15 text-blue-400",
    suggestedTitle: "Crew Deal Memo",
    suggestedDescription: "Freelance crew engagement covering role, day rate, hours, and work-for-hire terms.",
    tips: [
      "Include the day rate and any kit/equipment fees",
      "Specify overtime rules (after 8 hrs, 10 hrs, etc.)",
      "Add a work-for-hire clause so footage ownership stays with you",
    ],
    tags: ["crew", "freelance", "day rate", "deal memo", "work-for-hire"],
  },
  {
    id: "music_license",
    name: "Music License Agreement",
    description: "License for using music in your production. Covers the specific track, usage platform, term, territory, and synchronization rights.",
    icon: Music2,
    recipientRole: "vendor",
    recipientLabel: "Musician / Label",
    roleColor: "bg-orange-400/15 text-orange-400",
    category: "Vendor",
    categoryColor: "bg-orange-400/15 text-orange-400",
    suggestedTitle: "Music Synchronization License",
    suggestedDescription: "License for synchronizing the specified music track with the production across defined media and territory.",
    tips: [
      "Name the exact track, artist, and album",
      "Define sync rights — film, online, broadcast, advertising",
      "Specify the territory (worldwide vs. regional)",
    ],
    tags: ["music", "sync", "license", "rights", "audio"],
  },
  {
    id: "model_release",
    name: "Model Release",
    description: "General model release for commercial, editorial, or social media use. Covers physical appearance, voice, and name across specified media.",
    icon: Camera,
    recipientRole: "talent",
    recipientLabel: "Model",
    roleColor: "bg-purple-400/15 text-purple-400",
    category: "Talent",
    categoryColor: "bg-purple-400/15 text-purple-400",
    suggestedTitle: "Model Release",
    suggestedDescription: "Permission to use model's image, likeness, and appearance in commercial and promotional materials.",
    tips: [
      "Specify commercial vs. editorial use",
      "Include social media, website, and advertising platforms",
      "Note whether the model can be digitally altered",
    ],
    tags: ["model", "commercial", "likeness", "photo", "release"],
  },
  {
    id: "blank_contract",
    name: "Blank Contract",
    description: "Start from scratch with an empty contract. Upload your own PDF and configure recipient details.",
    icon: FileText,
    recipientRole: "other",
    recipientLabel: "Recipient",
    roleColor: "bg-muted/60 text-muted-foreground",
    category: "Custom",
    categoryColor: "bg-muted/60 text-muted-foreground",
    suggestedTitle: "",
    suggestedDescription: "",
    tips: [],
    tags: ["custom", "blank"],
  },
];

const CATEGORY_ORDER = ["All", "Client", "Talent", "Production", "Crew", "Vendor", "Custom"];

// ── Component ─────────────────────────────────────────────────────────────────

interface ContractTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: ContractTemplate) => void;
}

export function ContractTemplatePicker({ open, onClose, onSelect }: ContractTemplatePickerProps) {
  const [search, setSearch]               = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [hovered, setHovered]             = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setActiveCategory("All");
      setHovered(null);
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  if (!open) return null;

  const categories = CATEGORY_ORDER.filter(
    (cat) => cat === "All" || CONTRACT_TEMPLATES.some((t) => t.category === cat)
  );

  const filtered = CONTRACT_TEMPLATES.filter((t) => {
    const matchesCat = activeCategory === "All" || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch =
      q === "" ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.includes(q));
    return matchesCat && matchesSearch;
  });

  const hoveredTemplate = CONTRACT_TEMPLATES.find((t) => t.id === hovered) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[88dvh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
              <Sparkles className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">Choose a contract type</h2>
              <p className="text-[11px] text-muted-foreground">
                Select a template — we'll pre-fill the details for you
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search + Categories ─────────────────────────────────────────────── */}
        <div className="border-b border-border px-6 py-3 space-y-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contracts…"
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  activeCategory === cat
                    ? "bg-[#d4a853] text-black"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body: two columns on larger screens ────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Template list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {filtered.length > 0 ? (
              <div className="space-y-2">
                {filtered.map((tpl) => {
                  const Icon = tpl.icon;
                  const isHovered = hovered === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onMouseEnter={() => setHovered(tpl.id)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => onSelect(tpl)}
                      className={cn(
                        "group w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.99]",
                        isHovered
                          ? "border-[#d4a853]/50 bg-[#d4a853]/[0.04] shadow-sm"
                          : "border-border bg-card hover:border-border/80"
                      )}
                    >
                      <div className={cn(
                        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors",
                        isHovered
                          ? "border-[#d4a853]/30 bg-[#d4a853]/10"
                          : "border-border bg-muted/50"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5 transition-colors",
                          isHovered ? "text-[#d4a853]" : "text-muted-foreground"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className={cn(
                            "font-semibold text-sm transition-colors",
                            isHovered ? "text-[#d4a853]" : "text-foreground"
                          )}>
                            {tpl.name}
                          </p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tpl.categoryColor)}>
                            {tpl.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      <span className={cn(
                        "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                        tpl.roleColor
                      )}>
                        {tpl.recipientLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold text-foreground">No contracts found</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or category</p>
                <button
                  onClick={() => { setSearch(""); setActiveCategory("All"); }}
                  className="mt-3 text-xs text-[#d4a853] underline underline-offset-2 hover:text-[#e0b55e] transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* Right: tips panel */}
          <div className="hidden lg:flex w-64 flex-shrink-0 flex-col border-l border-border bg-muted/20 p-5">
            {hoveredTemplate && hoveredTemplate.tips.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <hoveredTemplate.icon className="h-4 w-4 text-[#d4a853]" />
                  <p className="text-xs font-bold text-foreground">{hoveredTemplate.name}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What to include</p>
                  <ul className="space-y-2">
                    {hoveredTemplate.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#d4a853]/60" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/5 px-3 py-2">
                  <p className="text-[11px] text-[#d4a853]/80">
                    Recipient type: <span className="font-semibold">{hoveredTemplate.recipientLabel}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                <FileSignature className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Hover a template to see what to include in your PDF
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            {CONTRACT_TEMPLATES.length - 1} contract types available
          </p>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
