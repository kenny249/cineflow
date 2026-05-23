"use client";

import { useState } from "react";
import { Film, Check, Zap, Crown, Building2, Rocket } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    icon: Zap,
    monthly: 39,
    annual: 29,
    annualTotal: 348,
    seats: "1 seat",
    color: "text-purple-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    features: [
      "Unlimited projects",
      "Shot lists & storyboards",
      "Client review portals",
      "Invoicing & contracts",
      "AI-powered tools",
      "1 team member",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    icon: Rocket,
    monthly: 79,
    annual: 65,
    annualTotal: 780,
    seats: "Up to 5 seats",
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    popular: true,
    features: [
      "Everything in Solo",
      "Up to 5 team members",
      "Revision workflows",
      "Retainer management",
      "Call sheets",
      "Priority support",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    icon: Building2,
    monthly: 159,
    annual: 129,
    annualTotal: 1548,
    seats: "Up to 15 seats",
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    features: [
      "Everything in Studio",
      "Up to 15 team members",
      "Advanced analytics",
      "Multi-client management",
      "Custom branding",
      "Dedicated support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    icon: Crown,
    monthly: 299,
    annual: 249,
    annualTotal: 2988,
    seats: "20+ seats",
    color: "text-[#d4a853]",
    border: "border-[#d4a853]/20",
    bg: "bg-[#d4a853]/5",
    features: [
      "Everything in Agency",
      "Unlimited team members",
      "Custom integrations",
      "SLA guarantee",
      "Onboarding support",
      "Custom contracts",
    ],
  },
];

type PlanId = (typeof PLANS)[number]["id"];

export default function UpgradePage() {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loading, setLoading] = useState<PlanId | "lifetime" | null>(null);

  async function startCheckout(planId: PlanId | "lifetime", billingInterval: "month" | "year" | "lifetime") {
    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval: billingInterval }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Failed to start checkout");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Film className="h-3.5 w-3.5 text-[#d4a853]" />
            </div>
            <p className="text-[0.65rem] font-bold tracking-[0.3em] text-[#d4a853] uppercase">CineFlow</p>
          </Link>
          <h1 className="font-display text-3xl font-bold text-foreground">Choose your plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            All plans include a 30-day free trial. No credit card required.
          </p>

          {/* Interval toggle */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setInterval("month")}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                interval === "month"
                  ? "bg-[#d4a853] text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-all ${
                interval === "year"
                  ? "bg-[#d4a853] text-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                Save ~20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = interval === "year" ? plan.annual : plan.monthly;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border ${plan.border} ${plan.bg} p-6 transition-all duration-200 hover:border-opacity-50 ${
                  "popular" in plan && plan.popular ? "ring-1 ring-[#d4a853]/30" : ""
                }`}
              >
                {"popular" in plan && plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full border border-[#d4a853]/30 bg-[#d4a853] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl border ${plan.border} bg-background`}>
                  <Icon className={`h-4 w-4 ${plan.color}`} />
                </div>

                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{plan.seats}</p>

                <div className="my-4">
                  <span className="text-3xl font-bold text-foreground">${price}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                  {interval === "year" && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Billed ${plan.annualTotal}/year
                    </p>
                  )}
                </div>

                <ul className="mb-6 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => startCheckout(plan.id, interval)}
                  disabled={isLoading}
                  className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    "popular" in plan && plan.popular
                      ? "bg-[#d4a853] text-black hover:bg-[#d4a853]/90"
                      : "border border-border bg-card text-foreground hover:border-[#d4a853]/30 hover:text-[#d4a853]"
                  } disabled:opacity-60`}
                >
                  {isLoading ? "Loading…" : "Start free trial"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Lifetime card */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10">
              <Crown className="h-5 w-5 text-[#d4a853]" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Lifetime Access — $499</p>
              <p className="text-xs text-muted-foreground">
                One-time payment · Studio-level features · 5 seats · Forever · Capped at 500 licenses
              </p>
            </div>
          </div>
          <button
            onClick={() => startCheckout("lifetime", "lifetime")}
            disabled={loading === "lifetime"}
            className="shrink-0 rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/10 px-6 py-2.5 text-xs font-semibold text-[#d4a853] transition-all hover:bg-[#d4a853]/20 disabled:opacity-60"
          >
            {loading === "lifetime" ? "Loading…" : "Get lifetime access"}
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Questions?{" "}
          <a href="mailto:support@usecineflow.com" className="text-[#d4a853] hover:underline">
            support@usecineflow.com
          </a>
        </p>
      </div>
    </div>
  );
}
