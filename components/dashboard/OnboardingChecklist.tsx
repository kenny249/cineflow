"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle, X, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

const STEPS = (isSolo: boolean) => [
  {
    id: "project",
    label: isSolo ? "Create your first job" : "Create your first project",
    sub: "Track shoots, revisions & deliverables",
    action: "project" as const,
    href: null,
  },
  {
    id: "client",
    label: "Add a client",
    sub: "Store contacts & share work directly",
    href: "/clients",
  },
  {
    id: "form",
    label: "Send a client form",
    sub: "Collect info before quoting a project",
    href: "/forms",
  },
  {
    id: "revision",
    label: "Send a cut for review",
    sub: "Get client feedback with timestamps",
    href: "/revisions",
  },
  {
    id: "invoice",
    label: "Create an invoice",
    sub: "Get paid directly from Cineflow",
    href: "/finance",
  },
];

interface Props {
  hasProjects: boolean;
  hasClients?: boolean;
  hasInvoices?: boolean;
  isSolo: boolean;
  onCreateProject: () => void;
}

export function OnboardingChecklist({ hasProjects, hasClients, hasInvoices, isSolo, onCreateProject }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cf_welcomed") === "true") return;
    const saved: Record<string, boolean> = JSON.parse(
      localStorage.getItem("cf_onboard_done") ?? "{}"
    );
    if (hasProjects) saved.project = true;
    if (hasClients) saved.client = true;
    if (hasInvoices) saved.invoice = true;
    setDone(saved);
    setVisible(true);
  }, [hasProjects, hasClients, hasInvoices]);

  if (!visible) return null;

  const steps = STEPS(isSolo);

  const markDone = (id: string) => {
    const next = { ...done, [id]: true };
    setDone(next);
    localStorage.setItem("cf_onboard_done", JSON.stringify(next));
    if (steps.every((s) => next[s.id])) dismiss();
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("cf_welcomed", "true");
  };

  const completedCount = steps.filter((s) => done[s.id]).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#d4a853]" />
            <span className="text-xs font-semibold text-foreground">Getting Started</span>
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {completedCount}/{steps.length} complete
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1 w-full rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-[#d4a853] transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {steps.map((step) => {
          const isComplete = !!done[step.id];
          const baseClass = `group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
            isComplete
              ? "border-border bg-card/30 opacity-50 cursor-default"
              : "border-border bg-card hover:border-[#d4a853]/30 cursor-pointer"
          }`;

          const inner = (
            <>
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-[#d4a853] transition-colors" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-medium ${
                    isComplete ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground">{step.sub}</p>
              </div>
              {!isComplete && (
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-[#d4a853] transition-colors" />
              )}
            </>
          );

          if (step.action === "project") {
            return (
              <button
                key={step.id}
                onClick={() => {
                  if (isComplete) return;
                  onCreateProject();
                  markDone(step.id);
                }}
                className={`w-full text-left ${baseClass}`}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={step.id}
              href={step.href!}
              onClick={() => { if (!isComplete) markDone(step.id); }}
              className={baseClass}
            >
              {inner}
            </Link>
          );
        })}
      </div>

      <button
        onClick={dismiss}
        className="mt-3 w-full text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Skip for now
      </button>
    </div>
  );
}
