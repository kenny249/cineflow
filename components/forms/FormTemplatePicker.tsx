"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Search, Sparkles, ClipboardList, Users, MapPin,
  Star, Calendar, RotateCcw, FileText, ArrowLeft, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FORM_TEMPLATES, type FormTemplateId, type FormTemplateMeta } from "@/lib/forms-template";

const TEMPLATE_ICONS: Record<FormTemplateId, React.ElementType> = {
  production_intake: ClipboardList,
  talent_intake:     Users,
  location_scouting: MapPin,
  client_feedback:   Star,
  event_coverage:    Calendar,
  revision_request:  RotateCcw,
  blank:             FileText,
};

const CATEGORY_ORDER = ["Client", "Production", "Talent", "Post", "Custom"];

interface FormTemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onCreate: (templateId: FormTemplateId, title: string) => Promise<void>;
}

export function FormTemplatePicker({ open, onClose, onCreate }: FormTemplatePickerProps) {
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState<FormTemplateMeta | null>(null);
  const [formTitle, setFormTitle]   = useState("");
  const [creating, setCreating]     = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const titleRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setSelected(null);
      setFormTitle("");
      setCreating(false);
      setActiveCategory("All");
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (selected) setTimeout(() => titleRef.current?.focus(), 80);
  }, [selected]);

  if (!open) return null;

  const categories = ["All", ...CATEGORY_ORDER];

  const filtered = FORM_TEMPLATES.filter((t) => {
    const matchesCategory = activeCategory === "All" || t.category === activeCategory;
    const matchesSearch =
      search === "" ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handlePick = (tpl: FormTemplateMeta) => {
    setSelected(tpl);
    setFormTitle(tpl.name);
  };

  const handleCreate = async () => {
    if (!selected || creating) return;
    setCreating(true);
    try {
      await onCreate(selected.id, formTitle.trim() || selected.name);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[88dvh]">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          {selected ? (
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to templates
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
                <Sparkles className="h-4 w-4 text-[#d4a853]" />
              </div>
              <div>
                <h2 className="font-display text-base font-semibold text-foreground">Choose a template</h2>
                <p className="text-[11px] text-muted-foreground">
                  Start from a professionally built form or create from scratch
                </p>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Search + Categories (only on grid view) ─────────────────────── */}
        {!selected && (
          <div className="border-b border-border px-6 py-3 space-y-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
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
        )}

        {/* ── Body ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

          {selected ? (
            /* ── Confirm / name step ─────────────────────────────────────── */
            <div className="space-y-6">
              {/* Selected template card */}
              <div className="rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.04] p-5 flex gap-4 items-start">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#d4a853]/25 bg-[#d4a853]/10">
                  {(() => { const Icon = TEMPLATE_ICONS[selected.id]; return <Icon className="h-5 w-5 text-[#d4a853]" />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-foreground">{selected.name}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", selected.categoryColor)}>
                      {selected.category}
                    </span>
                    {selected.questionCount > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        {selected.questionCount} questions
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <Check className="h-3 w-3" /> Selected
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
                  {selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {selected.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Form name input */}
              <div className="space-y-1.5">
                <Label>Form name</Label>
                <Input
                  ref={titleRef}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={selected.name}
                  onKeyDown={(e) => { if (e.key === "Enter" && formTitle.trim()) handleCreate(); }}
                />
                <p className="text-xs text-muted-foreground">
                  This is what clients see at the top of the form. You can change it anytime.
                </p>
              </div>
            </div>

          ) : filtered.length > 0 ? (
            /* ── Template grid ──────────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const Icon = TEMPLATE_ICONS[tpl.id];
                return (
                  <button
                    key={tpl.id}
                    onClick={() => handlePick(tpl)}
                    className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-[#d4a853]/50 hover:bg-[#d4a853]/[0.03] hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                        "border-border bg-muted/50 group-hover:border-[#d4a853]/30 group-hover:bg-[#d4a853]/10"
                      )}>
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-[#d4a853] transition-colors" />
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tpl.categoryColor)}>
                        {tpl.category}
                      </span>
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground mb-1 group-hover:text-[#d4a853] transition-colors">
                        {tpl.name}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>

                    <p className="text-[11px] text-muted-foreground/60">
                      {tpl.questionCount > 0 ? `${tpl.questionCount} questions included` : "Build your own questions"}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── Empty state ─────────────────────────────────────────────── */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-foreground">No templates found</p>
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

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-border px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
          {selected ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Button
                variant="gold"
                size="sm"
                onClick={handleCreate}
                disabled={creating || !formTitle.trim()}
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Creating…
                  </span>
                ) : (
                  "Create Form"
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {FORM_TEMPLATES.length - 1} templates available
              </p>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
