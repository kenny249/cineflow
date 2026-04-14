"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import type { FormQuestion, CineForm } from "@/types";

interface AgencyBranding {
  name: string;
  logo_url: string | null;
}

interface PublicFormData {
  form: Pick<CineForm, "id" | "title" | "description" | "questions" | "token">;
  agency: AgencyBranding;
}

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: FormQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

  if (question.type === "short_text") {
    return (
      <input
        type="text"
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder ?? "Your answer…"}
        className={inputCls}
      />
    );
  }

  if (question.type === "long_text") {
    return (
      <textarea
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder ?? "Your answer…"}
        rows={4}
        className={`${inputCls} resize-none`}
      />
    );
  }

  if (question.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-all ${
                selected
                  ? "border-zinc-800 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className={`h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? "border-white" : "border-zinc-300"}`}>
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (opt: string) => {
      onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
    };
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-400 mb-1">Select all that apply</p>
        {(question.options ?? []).map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-all ${
                isSelected
                  ? "border-zinc-800 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className={`h-4 w-4 flex-shrink-0 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "border-white bg-white" : "border-zinc-300"}`}>
                {isSelected && (
                  <svg className="h-2.5 w-2.5 text-zinc-900" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FormClient({ token }: { token: string }) {
  const [data, setData] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Group questions by section
  const [sections, setSections] = useState<{ title: string; questions: FormQuestion[] }[]>([]);
  const [sectionIndex, setSectionIndex] = useState(0);

  // Answers keyed by question id
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch(`/api/forms/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setNotFound(true); return; }
        setData(json);
        // Group into sections
        const map = new Map<string, FormQuestion[]>();
        for (const q of json.form.questions as FormQuestion[]) {
          if (!map.has(q.section)) map.set(q.section, []);
          map.get(q.section)!.push(q);
        }
        setSections(Array.from(map.entries()).map(([title, questions]) => ({ title, questions })));
        // Init answers
        const init: Record<string, string | string[]> = {};
        for (const q of json.form.questions as FormQuestion[]) {
          init[q.id] = q.type === "multi_select" ? [] : "";
        }
        setAnswers(init);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const currentSection = sections[sectionIndex];
  const totalSections = sections.length;
  const progress = totalSections > 0 ? ((sectionIndex + 1) / totalSections) * 100 : 0;

  const canAdvance = () => {
    if (!currentSection) return false;
    return currentSection.questions.every((q) => {
      if (!q.required) return true;
      const val = answers[q.id];
      return Array.isArray(val) ? val.length > 0 : val?.trim() !== "";
    });
  };

  const handleNext = () => {
    if (sectionIndex < totalSections - 1) setSectionIndex((i) => i + 1);
    else handleSubmit();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/forms/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          respondent_name: (answers["q_name"] as string) || undefined,
          respondent_email: undefined,
          answers,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSubmitError(json.error ?? "Something went wrong."); return; }
      setSubmitted(true);
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-zinc-300" />
        <p className="font-semibold text-zinc-700">This form isn&apos;t available</p>
        <p className="text-sm text-zinc-400">It may have been closed or the link is incorrect.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        {data.agency.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.agency.logo_url} alt={data.agency.name} className="h-10 object-contain mb-2" />
        ) : (
          <p className="text-base font-bold text-zinc-800 mb-2">{data.agency.name}</p>
        )}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900">
          <CheckCircle2 className="h-7 w-7 text-white" />
        </div>
        <div>
          <p className="text-lg font-bold text-zinc-900">You&apos;re all set!</p>
          <p className="mt-1 text-sm text-zinc-500">Thanks for filling this out. We&apos;ll be in touch soon.</p>
        </div>
        <p className="mt-8 text-xs text-zinc-300">Powered by Cineflow</p>
      </div>
    );
  }

  // ── Form UI ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-100">
        <div className="mx-auto max-w-xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.agency.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.agency.logo_url} alt={data.agency.name} className="h-7 object-contain" />
            ) : (
              <span className="font-bold text-sm text-zinc-800">{data.agency.name}</span>
            )}
          </div>
          <span className="text-xs text-zinc-400">{sectionIndex + 1} of {totalSections}</span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-zinc-100">
          <div
            className="h-full bg-zinc-800 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 mx-auto w-full max-w-xl px-5 py-8">
        {/* Form title — only on first section */}
        {sectionIndex === 0 && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900">{data.form.title}</h1>
            {data.form.description && (
              <p className="mt-1 text-sm text-zinc-500">{data.form.description}</p>
            )}
          </div>
        )}

        {/* Section */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-5">
            {currentSection?.title}
          </p>
          <div className="space-y-6">
            {currentSection?.questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-semibold text-zinc-800 mb-2.5">
                  {q.question}
                  {q.required && <span className="ml-1 text-red-400">*</span>}
                </label>
                <QuestionField
                  question={q}
                  value={answers[q.id] ?? (q.type === "multi_select" ? [] : "")}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        {submitError && (
          <p className="text-sm text-red-500 mb-4">{submitError}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          {sectionIndex > 0 ? (
            <button
              type="button"
              onClick={() => setSectionIndex((i) => i - 1)}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance() || submitting}
            className="flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sectionIndex === totalSections - 1 ? (
              "Submit"
            ) : (
              <>Continue <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center">
        <p className="text-xs text-zinc-300">Powered by <span className="font-medium text-zinc-400">Cineflow</span></p>
      </footer>
    </div>
  );
}
