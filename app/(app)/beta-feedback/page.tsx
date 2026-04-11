"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitBetaFeedback } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

// ─── Question data ────────────────────────────────────────────────────────────

const USAGE_OPTIONS = [
  "Daily",
  "A few times a week",
  "Weekly",
  "Rarely",
];

const FEATURE_OPTIONS = [
  "Projects",
  "Calendar",
  "Shot Lists",
  "Tasks",
  "Storyboard",
  "Clients",
  "Budget & Finance",
];

const WORKFLOW_OPTIONS = [
  "Yes, it replaces tools I already use",
  "Partially",
  "Not yet, but it could",
  "No",
];

const PAY_OPTIONS = [
  "Yes, definitely",
  "Probably",
  "Unsure",
  "No",
];

const PRICE_OPTIONS = [
  "Free only",
  "$5–10 / mo",
  "$15–25 / mo",
  "$30–50 / mo",
  "$50+ / mo",
];

const MODEL_OPTIONS = [
  "Monthly subscription",
  "Annual (discounted)",
  "Free + paid upgrades",
  "One-time purchase",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm transition-all duration-150 text-left active:scale-95",
        selected
          ? "border-[#d4a853]/60 bg-[#d4a853]/10 text-[#d4a853] ring-[0.5px] ring-[#d4a853]/30"
          : "border-white/8 bg-white/[0.03] text-muted-foreground hover:border-white/15 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform duration-100 active:scale-90"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors duration-150",
              n <= (hovered || value)
                ? "fill-[#d4a853] text-[#d4a853]"
                : "fill-transparent text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LS_KEY = "cf_beta_feedback_done";

export default function BetaFeedbackPage() {
  const [done, setDone] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(LS_KEY) === "1"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Answers
  const [usageFrequency, setUsageFrequency] = useState("");
  const [topFeatures, setTopFeatures] = useState<string[]>([]);
  const [workflowFit, setWorkflowFit] = useState("");
  const [wouldPay, setWouldPay] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [missingFeature, setMissingFeature] = useState("");
  const [starRating, setStarRating] = useState(0);

  function toggleFeature(f: string) {
    setTopFeatures((prev) =>
      prev.includes(f)
        ? prev.filter((x) => x !== f)
        : prev.length < 3
        ? [...prev, f]
        : prev
    );
  }

  const canSubmit =
    usageFrequency &&
    topFeatures.length > 0 &&
    workflowFit &&
    wouldPay &&
    priceRange &&
    pricingModel;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitBetaFeedback({
        usage_frequency: usageFrequency,
        top_features: topFeatures,
        workflow_fit: workflowFit,
        would_pay: wouldPay,
        price_range: priceRange,
        pricing_model: pricingModel,
        missing_feature: missingFeature || undefined,
        star_rating: starRating || undefined,
      });
      localStorage.setItem(LS_KEY, "1");
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Thank-you screen ──
  if (done) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 text-center max-w-sm"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#d4a853]/20 blur-2xl" />
            <CheckCircle2 className="relative h-14 w-14 text-[#d4a853]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Thank you.</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Your feedback helps shape CineFlow into something that actually fits how you work.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Survey ──
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-10 pb-24">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d4a853]/25 bg-[#d4a853]/8 px-3 py-1 text-xs font-medium text-[#d4a853]">
            <Sparkles className="h-3 w-3" />
            Beta Program
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Beta Feedback</h1>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Anonymous · ~2 minutes · helps us get pricing and features right
          </p>
        </div>

        <div className="flex flex-col gap-8">

          {/* Q1 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              1. How often would you use CineFlow in a real production?
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {USAGE_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={usageFrequency === o}
                  onClick={() => setUsageFrequency(o)}
                />
              ))}
            </div>
          </div>

          {/* Q2 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              2. Which features matter most to you?{" "}
              <span className="text-muted-foreground font-normal">(pick up to 3)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {FEATURE_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={topFeatures.includes(o)}
                  onClick={() => toggleFeature(o)}
                />
              ))}
            </div>
            {topFeatures.length === 3 && (
              <p className="text-xs text-muted-foreground">Max 3 selected</p>
            )}
          </div>

          {/* Q3 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              3. Does CineFlow fit into your current workflow?
            </label>
            <div className="flex flex-col gap-2">
              {WORKFLOW_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={workflowFit === o}
                  onClick={() => setWorkflowFit(o)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/6 pt-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">Pricing</p>
          </div>

          {/* Q4 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              4. Would you pay for CineFlow?
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAY_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={wouldPay === o}
                  onClick={() => setWouldPay(o)}
                />
              ))}
            </div>
          </div>

          {/* Q5 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              5. What monthly price feels fair for a solo plan?
            </label>
            <div className="flex flex-wrap gap-2">
              {PRICE_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={priceRange === o}
                  onClick={() => setPriceRange(o)}
                />
              ))}
            </div>
          </div>

          {/* Q6 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              6. Preferred pricing model?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MODEL_OPTIONS.map((o) => (
                <OptionButton
                  key={o}
                  label={o}
                  selected={pricingModel === o}
                  onClick={() => setPricingModel(o)}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/6 pt-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/50">Optional</p>
          </div>

          {/* Q7 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              7. What&apos;s the one thing missing that would make you use this daily?
            </label>
            <Textarea
              value={missingFeature}
              onChange={(e) => setMissingFeature(e.target.value)}
              placeholder="Type anything..."
              className="resize-none bg-white/[0.03] border-white/8 text-sm"
              rows={3}
            />
          </div>

          {/* Q8 */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              8. Overall first impression
            </label>
            <StarRating value={starRating} onChange={setStarRating} />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <div className="pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className={cn(
                "relative h-11 gap-2 rounded-lg px-6 text-sm font-medium transition-all duration-200",
                canSubmit
                  ? "bg-[#d4a853] text-black hover:bg-[#c89940] shadow-[0_0_24px_rgba(212,168,83,0.35)] active:scale-95"
                  : "bg-white/6 text-muted-foreground cursor-not-allowed"
              )}
            >
              {submitting ? "Submitting…" : "Submit Feedback"}
              {!submitting && <ChevronRight className="h-4 w-4" />}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Responses are anonymous and stored securely.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
