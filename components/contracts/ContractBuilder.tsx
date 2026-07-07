"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Sparkles, Loader2, Upload, FileText,
  ChevronDown, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { ContractTemplate } from "@/components/contracts/ContractTemplatePicker";
import type { Project, Contract, ContractRecipientRole } from "@/types";

// ── Field config per template ─────────────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: { value: string; label: string }[];
};

const TEMPLATE_FIELDS: Record<string, FieldDef[]> = {
  production_agreement: [
    { key: "projectName",        label: "Project Name",        type: "text",     placeholder: "e.g. Brand Campaign 2026",             required: true },
    { key: "projectDescription", label: "Project Description", type: "textarea", placeholder: "Brief description of what's being produced" },
    { key: "totalFee",           label: "Total Fee ($)",       type: "number",   placeholder: "5000",                                  required: true },
    { key: "paymentSchedule",    label: "Payment Schedule",    type: "select",
      options: [
        { value: "50% upfront, 50% on delivery",                        label: "50% upfront · 50% on delivery" },
        { value: "100% upfront before work begins",                     label: "100% upfront" },
        { value: "100% on final delivery",                              label: "100% on delivery" },
        { value: "30% upfront, 40% on milestone, 30% on delivery",     label: "30/40/30 milestone split" },
        { value: "Net 30 invoice on delivery",                          label: "Net 30 on delivery" },
      ],
    },
    { key: "deliverables",    label: "Deliverables",      type: "textarea", placeholder: "e.g. 1× 90-sec final edit, 3× social cutdowns, raw files on drive", required: true },
    { key: "revisionRounds",  label: "Revision Rounds",   type: "select",
      options: [
        { value: "1 round of revisions",                    label: "1 round" },
        { value: "2 rounds of revisions",                   label: "2 rounds" },
        { value: "3 rounds of revisions",                   label: "3 rounds" },
        { value: "Unlimited revisions within project scope", label: "Unlimited (within scope)" },
      ],
    },
    { key: "usageRights",  label: "Usage Rights",  type: "select",
      options: [
        { value: "Online and social media only",                label: "Online & social media only" },
        { value: "Online, social media, and broadcast TV",      label: "Online + broadcast" },
        { value: "All media worldwide in perpetuity",           label: "All media · worldwide · perpetual" },
        { value: "Internal company use only",                   label: "Internal use only" },
        { value: "Paid advertising and commercial use",         label: "Commercial / paid ads" },
      ],
    },
    { key: "startDate",    label: "Project Start Date",    type: "date" },
    { key: "deliveryDate", label: "Target Delivery Date",  type: "date" },
  ],

  crew_deal_memo: [
    { key: "role",          label: "Role / Position",     type: "text",   placeholder: "e.g. Director of Photography",  required: true },
    { key: "dayRate",       label: "Day Rate ($)",        type: "number", placeholder: "750",                           required: true },
    { key: "shootDates",    label: "Shoot Dates",         type: "text",   placeholder: "e.g. July 15–17, 2026",         required: true },
    { key: "kitFee",        label: "Kit / Equipment Fee ($)", type: "number", placeholder: "150 (leave blank if none)" },
    { key: "overtimeRule",  label: "Overtime Rule",       type: "select",
      options: [
        { value: "Standard 8-hour day; overtime after 8 hours", label: "After 8 hours" },
        { value: "Standard 10-hour day; overtime after 10 hours", label: "After 10 hours" },
        { value: "Standard 12-hour day; overtime after 12 hours", label: "After 12 hours" },
        { value: "Flat day rate, no overtime",                    label: "Flat rate (no OT)" },
      ],
    },
    { key: "travel", label: "Travel / Expenses", type: "text", placeholder: "e.g. Mileage reimbursed at IRS rate" },
  ],

  talent_release: [
    { key: "productionTitle", label: "Production Title",     type: "text",   placeholder: "e.g. Summer Brand Film 2026",  required: true },
    { key: "platforms",       label: "Usage Platforms",      type: "text",   placeholder: "e.g. YouTube, Instagram, TV broadcast", required: true },
    { key: "compensation",    label: "Compensation",         type: "text",   placeholder: "e.g. $500, Deferred, In kind / product",  required: true },
    { key: "exclusivity",     label: "Exclusivity",          type: "select",
      options: [
        { value: "no",  label: "Non-exclusive — talent can appear in other productions" },
        { value: "yes", label: "Exclusive — restricted from competing productions during term" },
      ],
    },
    { key: "term", label: "Rights Term", type: "select",
      options: [
        { value: "In perpetuity",   label: "Perpetual (forever)" },
        { value: "5 years",         label: "5 years" },
        { value: "3 years",         label: "3 years" },
        { value: "1 year",          label: "1 year" },
      ],
    },
  ],

  location_release: [
    { key: "locationName", label: "Location Name / Address", type: "text",   placeholder: "e.g. 123 Main St, Brooklyn NY", required: true },
    { key: "shootDates",   label: "Shoot Dates & Hours",     type: "text",   placeholder: "e.g. Aug 10, 7am–8pm",          required: true },
    { key: "crewSize",     label: "Approximate Crew Size",   type: "text",   placeholder: "e.g. 8 people" },
    { key: "fee",          label: "Location Fee",            type: "text",   placeholder: "e.g. $500 or Complimentary" },
    { key: "restoration",  label: "Restoration Required",    type: "select",
      options: [
        { value: "yes", label: "Yes — full restoration to original condition" },
        { value: "no",  label: "Standard care only" },
      ],
    },
  ],

  nda: [
    { key: "ndaType",          label: "NDA Type", type: "select", required: true,
      options: [
        { value: "mutual",    label: "Mutual — both parties protect each other's info" },
        { value: "one-way",   label: "One-way — only recipient is bound" },
      ],
    },
    { key: "confidentialInfo", label: "What's Being Protected", type: "textarea",
      placeholder: "e.g. project details, creative concepts, client lists, pricing, unreleased content",
      required: true,
    },
    { key: "term", label: "Confidentiality Term", type: "select",
      options: [
        { value: "2 years from signing", label: "2 years" },
        { value: "1 year from signing",  label: "1 year" },
        { value: "5 years from signing", label: "5 years" },
        { value: "indefinitely",         label: "Indefinite" },
      ],
    },
  ],

  music_license: [
    { key: "trackTitle", label: "Track Title",          type: "text",   placeholder: "e.g. Summer Haze",          required: true },
    { key: "artist",     label: "Artist / Band Name",  type: "text",   placeholder: "e.g. The Wavs",             required: true },
    { key: "platforms",  label: "Usage Platforms",     type: "text",   placeholder: "e.g. YouTube, Instagram, TV", required: true },
    { key: "territory",  label: "Territory",           type: "select",
      options: [
        { value: "Worldwide",    label: "Worldwide" },
        { value: "United States only", label: "United States only" },
        { value: "North America", label: "North America" },
      ],
    },
    { key: "term",         label: "License Term", type: "select",
      options: [
        { value: "In perpetuity", label: "Perpetual" },
        { value: "5 years",       label: "5 years" },
        { value: "1 year",        label: "1 year" },
      ],
    },
    { key: "fee",          label: "License Fee",         type: "text", placeholder: "e.g. $200 or Complimentary" },
    { key: "exclusivity",  label: "Sync Exclusivity",    type: "select",
      options: [
        { value: "no",  label: "Non-exclusive" },
        { value: "yes", label: "Exclusive for this production" },
      ],
    },
  ],

  model_release: [
    { key: "productionTitle", label: "Production / Campaign Title", type: "text",   placeholder: "e.g. Spring Lookbook 2026", required: true },
    { key: "usageType",       label: "Usage Type",                  type: "select", required: true,
      options: [
        { value: "Commercial and promotional",                    label: "Commercial & promotional" },
        { value: "Editorial and non-commercial",                  label: "Editorial / non-commercial" },
        { value: "Social media and digital advertising",          label: "Social media & digital ads" },
        { value: "All commercial, editorial, and digital media",  label: "All media" },
      ],
    },
    { key: "platforms",    label: "Platforms",    type: "text", placeholder: "e.g. Instagram, print, website, TV", required: true },
    { key: "compensation", label: "Compensation", type: "text", placeholder: "e.g. $300, Trade / product, TFP",    required: true },
    { key: "alterations",  label: "Alterations Permitted", type: "select",
      options: [
        { value: "yes", label: "Yes — editing, cropping, color grading permitted" },
        { value: "no",  label: "Limited — no significant alterations without consent" },
      ],
    },
  ],

  blank_contract: [],
};

// ── Auto-resizing textarea ────────────────────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className={cn(
        "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 overflow-hidden",
        className
      )}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = "form" | "generating" | "preview" | "creating" | "done";

interface ContractBuilderProps {
  template: ContractTemplate;
  projects: Project[];
  onDone: (contract: Contract) => void;
  onClose: () => void;
}

export function ContractBuilder({ template, projects, onDone, onClose }: ContractBuilderProps) {
  const supabase = createClient();

  // Studio info
  const [studioName, setStudioName] = useState("Studio");

  // Step
  const [step, setStep] = useState<Step>("form");

  // Common recipient fields
  const [recipientName,  setRecipientName]  = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [projectId,      setProjectId]      = useState("");

  // Template-specific fields
  const [fields, setFields] = useState<Record<string, string>>({});

  // Generated / editable sections
  const [sections, setSections] = useState<{ title: string; body: string }[]>([]);

  // Upload-instead mode
  const [uploadMode, setUploadMode] = useState(template.id === "blank_contract");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Fetch studio name on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, business_name, company")
        .eq("id", user.id)
        .single();
      if (p) setStudioName(p.business_name || p.company || p.full_name || "Studio");
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  // ── Validate form ────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (!recipientName.trim()) return "Recipient name is required.";
    if (!recipientEmail.trim()) return "Recipient email is required.";
    if (uploadMode) {
      if (!uploadFile) return "Please select a PDF to upload.";
      return null;
    }
    const defs = TEMPLATE_FIELDS[template.id] ?? [];
    for (const def of defs) {
      if (def.required && !fields[def.key]?.trim()) {
        return `${def.label} is required.`;
      }
    }
    return null;
  }

  // ── Generate contract via AI ─────────────────────────────────────────────────

  async function handleGenerate() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setStep("generating");

    try {
      const res = await fetch("/api/ai/contract-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          fields: { recipientName, ...fields },
          studioName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate contract");
      setSections(data.sections);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate");
      setStep("form");
    }
  }

  // ── Create contract + attach PDF ─────────────────────────────────────────────

  async function handleCreate() {
    setError(null);
    setStep("creating");

    try {
      let fileUrl: string | undefined;

      if (uploadMode && uploadFile) {
        // Upload user's own PDF
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const ext = uploadFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("contracts")
          .upload(path, uploadFile, { upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(path);
        fileUrl = publicUrl;
      }

      // Create the contract record
      const createRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: template.id === "blank_contract"
            ? (fields.customTitle?.trim() || "Contract")
            : template.suggestedTitle,
          description: template.suggestedDescription || undefined,
          project_id: projectId || undefined,
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim(),
          recipient_role: template.recipientRole,
          file_url: fileUrl,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Failed to create contract");

      const createdContract: Contract = createData.contract;

      // AI path: generate the PDF and attach it
      if (!uploadMode && sections.length > 0) {
        const pdfRes = await fetch("/api/contracts/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId: createdContract.id,
            sections,
            contractTitle: template.suggestedTitle,
            recipientName: recipientName.trim(),
            recipientEmail: recipientEmail.trim() || undefined,
            templateLabel: template.name,
          }),
        });
        const pdfData = await pdfRes.json();
        if (!pdfRes.ok) throw new Error(pdfData.error || "Failed to generate PDF");
        createdContract.file_url = pdfData.file_url;
      }

      onDone(createdContract);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep(uploadMode ? "form" : "preview");
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const Icon = template.icon;
  const fieldDefs = TEMPLATE_FIELDS[template.id] ?? [];

  // ── Step: form ───────────────────────────────────────────────────────────────

  if (step === "form") {
    return (
      <div className="flex flex-col h-full max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/10">
              <Icon className="h-4 w-4 text-[#d4a853]" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">{template.name}</h2>
              <p className="text-[11px] text-muted-foreground">{template.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Recipient */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {template.recipientLabel}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name <span className="text-red-400">*</span></Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={`${template.recipientLabel} full name`}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email <span className="text-red-400">*</span></Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Link to Project <span className="text-muted-foreground">(optional)</span></Label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Upload mode toggle */}
          {template.id !== "blank_contract" && (
            <div className="flex items-center justify-between py-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {uploadMode ? "Upload Your PDF" : "Contract Details"}
              </p>
              <button
                onClick={() => { setUploadMode((m) => !m); setError(null); }}
                className="text-[11px] text-[#d4a853] hover:underline transition-colors"
              >
                {uploadMode ? "← Generate with AI instead" : "Have your own PDF? Upload it →"}
              </button>
            </div>
          )}

          {uploadMode ? (
            /* Upload mode */
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
                  uploadFile
                    ? "border-[#d4a853]/50 bg-[#d4a853]/5"
                    : "border-border hover:border-[#d4a853]/40 hover:bg-[#d4a853]/[0.02]"
                )}
              >
                {uploadFile ? (
                  <>
                    <FileText className="h-8 w-8 text-[#d4a853]" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Click to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/40" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Upload your PDF</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Click to browse · PDF only</p>
                    </div>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* AI mode — template-specific fields */
            <div className="space-y-3">
              {fieldDefs.map((def) => (
                <div key={def.key} className="space-y-1.5">
                  <Label className="text-xs">
                    {def.label}
                    {def.required && <span className="text-red-400 ml-1">*</span>}
                  </Label>
                  {def.type === "select" ? (
                    <div className="relative">
                      <select
                        value={fields[def.key] ?? ""}
                        onChange={(e) => setField(def.key, e.target.value)}
                        className="w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select…</option>
                        {def.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  ) : def.type === "textarea" ? (
                    <Textarea
                      value={fields[def.key] ?? ""}
                      onChange={(e) => setField(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      rows={2}
                      className="text-sm resize-none"
                    />
                  ) : (
                    <Input
                      type={def.type === "number" ? "number" : def.type === "date" ? "date" : "text"}
                      value={fields[def.key] ?? ""}
                      onChange={(e) => setField(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      className="h-9 text-sm"
                    />
                  )}
                  {def.helpText && (
                    <p className="text-[11px] text-muted-foreground">{def.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          {uploadMode ? (
            <Button
              variant="gold"
              size="sm"
              onClick={handleCreate}
              disabled={!uploadFile || !recipientName.trim() || !recipientEmail.trim()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Create Contract
            </Button>
          ) : (
            <Button variant="gold" size="sm" onClick={handleGenerate}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Contract Draft
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Step: generating ──────────────────────────────────────────────────────────

  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-8 py-20 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
          <Sparkles className="h-7 w-7 text-[#d4a853]" />
          <div className="absolute inset-0 rounded-2xl animate-ping bg-[#d4a853]/10" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-foreground">Writing your contract…</p>
          <p className="text-sm text-muted-foreground">Claude is drafting professional legal language tailored to your details.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  // ── Step: preview (review + edit sections) ────────────────────────────────────

  if (step === "preview") {
    return (
      <div className="flex flex-col h-full max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("form")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">Review Your Contract</h2>
              <p className="text-[11px] text-muted-foreground">Edit any section — then generate your PDF.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sections */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/[0.03] px-4 py-3 flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-[#d4a853] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#d4a853]/80 leading-relaxed">
              Your contract draft is ready. Review each section and make any edits — then click <strong>Generate PDF & Create Contract</strong> below.
            </p>
          </div>

          <div className="space-y-4">
            {sections.map((section, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-[#d4a853]/70 px-1">{section.title}</p>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <AutoTextarea
                  value={section.body}
                  onChange={(v) => setSections((prev) => prev.map((s, idx) => idx === i ? { ...s, body: v } : s))}
                  className="text-sm leading-relaxed text-foreground/90 bg-card/60 min-h-[72px]"
                />
              </div>
            ))}
          </div>

          <p className="text-center text-[10px] text-muted-foreground/50 pb-2">
            Not legal advice · Review with a licensed attorney before use
          </p>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep("form")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
          </Button>
          <Button variant="gold" size="sm" onClick={handleCreate}>
            <FileText className="h-4 w-4 mr-2" />
            Generate PDF &amp; Create Contract
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: creating ────────────────────────────────────────────────────────────

  if (step === "creating") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 px-8 py-20 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
          <FileText className="h-7 w-7 text-[#d4a853]" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-foreground">Creating your contract…</p>
          <p className="text-sm text-muted-foreground">Rendering the PDF and setting everything up.</p>
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return null;
}
