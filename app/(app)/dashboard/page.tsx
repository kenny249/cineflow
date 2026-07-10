"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  Plus,
  LogOut,
  Sparkles,
  Film,
  Camera,
  Repeat2,
  DollarSign,
  MessageSquare,
  Clapperboard,
} from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";

const COMPLIMENTS = [
  "The lens never lies, and today you're looking sharp.",
  "Every great film starts with one bold decision. Make yours today.",
  "Your vision is your superpower. Trust it.",
  "Lights. Camera. You've got this.",
  "The best directors show up even when it's hard. You showed up.",
  "Frame it, shoot it, own it.",
  "Today's cut could be tomorrow's masterpiece.",
  "The story you tell matters. Keep telling it.",
  "Cinematic excellence isn't accidental, and neither are you.",
  "Roll camera. The world is watching.",
  "You're not just making content. You're making history.",
  "Stay curious. The best shot is always the next one.",
];

function getDailyCompliment(): string {
  const day = new Date().getDate() + new Date().getMonth() * 31;
  return COMPLIMENTS[day % COMPLIMENTS.length];
}
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ClientActivityWidget } from "@/components/dashboard/ClientActivityWidget";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { UpcomingShoots } from "@/components/dashboard/UpcomingShoots";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardParticles } from "@/components/dashboard/DashboardParticles";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { getProjects, getActivityLog, getCalendarEvents, getRetainers, getInvoices, updateProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { Project, ActivityItem, CalendarEvent, Retainer, Invoice } from "@/types";
import { isSoloPlan } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Editorial section header — a quiet, uppercase label instead of a gold marker bar.
 * Keeps the gold rationed to the hero + primary CTA.
 */
function SectionHeader({
  title,
  count,
  href,
  linkLabel = "View all",
}: {
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-baseline gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        {title}
        {count !== undefined && (
          <span className="font-mono text-[0.7rem] font-normal tabular-nums text-muted-foreground/45">
            {count}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [nameSetupOpen, setNameSetupOpen] = useState(false);
  const [nameFirst, setNameFirst] = useState("");
  const [nameLast, setNameLast] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [savedQuickActions, setSavedQuickActions] = useState<string[] | null>(null);
  const [pipelineQuotes, setPipelineQuotes] = useState(0);
  const [pipelineQuoteOldestDays, setPipelineQuoteOldestDays] = useState<number | null>(null);
  const [pipelineContracts, setPipelineContracts] = useState(0);
  const [pipelineContractOldestDays, setPipelineContractOldestDays] = useState<number | null>(null);
  const [plan, setPlan] = useState<string>(() =>
    (typeof window !== "undefined" ? sessionStorage.getItem("cf_plan") : null) ?? "studio"
  );
  const [planStatus, setPlanStatus] = useState<string>("trialing");
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Load plan — awaited so the correct mode renders before loading clears
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("plan, plan_status, first_name, last_name, quick_actions").eq("id", user.id).single();
        if (profile?.plan) {
          setPlan(profile.plan);
          sessionStorage.setItem("cf_plan", profile.plan);
        }
        if (profile?.plan_status) {
          setPlanStatus(profile.plan_status);
        }
        const validFirst = profile?.first_name && !profile.first_name.includes("@")
          ? profile.first_name : null;
        if (validFirst || profile?.last_name) {
          setDisplayName([validFirst, profile?.last_name].filter(Boolean).join(" "));
        } else {
          const emailName = user.email?.split("@")[0] ?? "";
          if (emailName) setDisplayName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
          // Only prompt for name if account is less than 2 hours old — never show to existing users
          const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
          if (accountAgeMs < 2 * 60 * 60 * 1000) {
            setNameSetupOpen(true);
          }
        }
        if (profile?.quick_actions) {
          setSavedQuickActions(profile.quick_actions as string[]);
        }
      }

      const projectsData = await getProjects();
      setProjects(projectsData);
      try {
        const retainersData = await getRetainers();
        setRetainers(retainersData);
      } catch {
        // retainers table may not exist yet
      }
      try {
        const invoicesData = await getInvoices();
        setInvoices(invoicesData);
      } catch {
        // invoices table may not exist yet
      }
      try {
        const activityData = await getActivityLog(25);
        setActivity(activityData);
      } catch {
        // activity log failure is non-critical
      }
      try {
        const eventsData = await getCalendarEvents();
        setCalendarEvents(eventsData);
      } catch {
        // calendar_events table may not exist yet
      }
      try {
        const [{ data: qData }, { data: cData }] = await Promise.all([
          supabase.from("quotes").select("created_at").in("status", ["sent", "viewed"]).order("created_at", { ascending: true }),
          supabase.from("contracts").select("created_at").eq("status", "sent").order("created_at", { ascending: true }),
        ]);
        setPipelineQuotes(qData?.length ?? 0);
        setPipelineContracts(cData?.length ?? 0);
        if (qData && qData.length > 0) {
          const days = Math.floor((Date.now() - new Date(qData[0].created_at).getTime()) / 86_400_000);
          setPipelineQuoteOldestDays(days);
        }
        if (cData && cData.length > 0) {
          const days = Math.floor((Date.now() - new Date(cData[0].created_at).getTime()) / 86_400_000);
          setPipelineContractOldestDays(days);
        }
      } catch {
        // pipeline counts are non-critical
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProjectSuccess = () => {
    loadData();
  };

  const handleNameSave = async () => {
    if (!nameFirst.trim()) return;
    setNameSaving(true);
    try {
      await updateProfile({ first_name: nameFirst.trim(), last_name: nameLast.trim() || undefined });
      setDisplayName([nameFirst.trim(), nameLast.trim()].filter(Boolean).join(" "));
      setNameSetupOpen(false);
      // Nudge them straight into creating their first project
      setTimeout(() => setModalOpen(true), 300);
      toast.success(`Welcome, ${nameFirst.trim()}! Let's create your first project.`);
    } catch {
      toast.error("Couldn't save your name — try again.");
    } finally {
      setNameSaving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const solo = isSoloPlan(plan);

  // Revenue metrics
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonthInvoiced = invoices
    .filter((inv) => new Date(inv.created_at) >= monthStart && inv.status !== "draft")
    .reduce((s, inv) => s + (inv.amount ?? 0), 0);
  const outstanding = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue" || inv.status === "partial")
    .reduce((s, inv) => s + (inv.amount ?? 0), 0);

  const reviewProjects = projects.filter((p) => p.status === "review");

  const activeProjects = projects.filter(
    (p) => p.status !== "archived" && p.status !== "cancelled" && p.status !== "delivered"
  );
  const inFlightCount = projects.filter((p) => p.status === "active" || p.status === "review").length;
  const now = new Date();
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const thisWeekEvents = calendarEvents.filter((e) => {
    const d = new Date(e.start_date);
    return d >= now && d <= weekEnd;
  }).length;
  const todayEvents = calendarEvents.filter((e) => {
    const d = new Date(e.start_date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const stats = solo
    ? [
        { label: "Active Jobs",       value: inFlightCount,                                            icon: TrendingUp,  color: "text-foreground", bg: "bg-white/[0.06]",  href: "/projects" },
        { label: "Shoots This Week",  value: thisWeekEvents,                                           icon: Camera,      color: "text-sky-400",    bg: "bg-sky-400/10",    href: "/calendar" },
        { label: "Awaiting Feedback", value: projects.filter(p => p.status === "review").length,       icon: Clock,       color: "text-amber-400",  bg: "bg-amber-400/10",  href: "/projects" },
        { label: "Delivered",         value: projects.filter(p => p.status === "delivered").length,    icon: CheckCircle2,color: "text-emerald-400",bg: "bg-emerald-400/10", href: "/projects" },
      ]
    : [
        { label: "Active",        value: inFlightCount,                                            icon: TrendingUp,  color: "text-foreground", bg: "bg-white/[0.06]",  href: "/projects" },
        { label: "This Week",     value: thisWeekEvents,                                           icon: Camera,      color: "text-sky-400",    bg: "bg-sky-400/10",    href: "/calendar" },
        { label: "Pending review",value: projects.filter(p => p.status === "review").length,       icon: Clock,       color: "text-amber-400",  bg: "bg-amber-400/10",  href: "/projects" },
        { label: "Delivered",     value: projects.filter(p => p.status === "delivered").length,    icon: CheckCircle2,color: "text-emerald-400",bg: "bg-emerald-400/10", href: "/projects" },
      ];

  return (
    <>
      {/* ── Name setup modal (first login) ── */}
      {nameSetupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#d4a853]/20 bg-card p-6 shadow-2xl">
            <div className="mb-5 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
                <Clapperboard className="h-6 w-6 text-[#d4a853]" />
              </div>
              <h2 className="font-display text-lg font-bold text-foreground">Welcome to CineFlow</h2>
              <p className="mt-1 text-sm text-muted-foreground">What should we call you?</p>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                placeholder="First name"
                value={nameFirst}
                onChange={(e) => setNameFirst(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
              />
              <input
                type="text"
                placeholder="Last name (optional)"
                value={nameLast}
                onChange={(e) => setNameLast(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
              />
            </div>
            <button
              onClick={handleNameSave}
              disabled={!nameFirst.trim() || nameSaving}
              className="mt-4 w-full rounded-xl bg-[#d4a853] py-2.5 text-sm font-bold text-black transition hover:bg-[#d4a853]/90 disabled:opacity-40"
            >
              {nameSaving ? "Saving…" : "Let's go"}
            </button>
          </div>
        </div>
      )}

      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleCreateProjectSuccess} />

      <div className="relative flex h-full flex-col overflow-y-auto custom-scrollbar">
        <DashboardParticles />
        <div className="relative flex-1 space-y-6 p-6">

          {/* ── Hero header ── */}
          <div className="relative">
            <div className="letterbox-bar mb-6" />
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
              <div className="min-w-0">
                {/* Kicker — date + plan, deliberately quiet so the greeting leads */}
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <span className="h-3 w-px bg-border" />
                  {(plan === "lifetime" || planStatus === "founding") ? (
                    <span className="group relative inline-flex cursor-default select-none items-center gap-1.5 overflow-hidden rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-[0.2em]"
                      style={{
                        background: "linear-gradient(135deg, #1c1a0f 0%, #0e0d08 55%, #1a180e 100%)",
                        boxShadow: "0 0 0 1px rgba(212,168,83,0.45), inset 0 1px 0 rgba(212,168,83,0.15)",
                      }}
                    >
                      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#d4a853]/20 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />
                      <Sparkles className="relative h-2.5 w-2.5 text-[#d4a853]" />
                      <span
                        className="relative"
                        style={{
                          background: "linear-gradient(90deg, #a0720a, #f0c84a, #d4a853, #f5d98e, #b8860b)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        Founding Member
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[9px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                      <Sparkles className="h-2.5 w-2.5" />
                      {plan === "solo" || plan === "solo_beta" ? "Solo" :
                       plan === "agency" ? "Agency" :
                       plan === "enterprise" ? "Enterprise" :
                       planStatus === "trialing" ? "Free Trial" :
                       "Studio"}
                    </span>
                  )}
                </div>
                {/* Greeting — the one place typography is allowed to shout */}
                <h1 className="font-display text-[1.9rem] font-bold leading-[1.03] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
                  {greeting},{" "}
                  {displayName === null ? (
                    <span className="shimmer-gold inline-block h-[0.8em] w-48 translate-y-[0.03em] rounded-lg align-middle sm:w-64" />
                  ) : (
                    <span className="animate-fade-in-name text-gradient-gold">{displayName}</span>
                  )}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {getDailyCompliment()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-red-500/30 hover:text-red-400 sm:text-sm"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 py-2 text-xs font-semibold text-black shadow-[0_2px_20px_-6px_rgba(212,168,83,0.55)] transition-all hover:bg-[#e0b866] hover:shadow-[0_4px_28px_-6px_rgba(212,168,83,0.7)] active:scale-[0.98] sm:text-sm"
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{solo ? "New Job" : "New Project"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Stat rail — a single elevated surface, numbers as the hero ── */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_16px_40px_-24px_rgba(0,0,0,0.7)]">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {stats.map((stat, i) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className={cn(
                    "group relative flex flex-col justify-between gap-6 border-border/60 p-4 transition-colors hover:bg-white/[0.02] sm:p-5",
                    ["border-b border-r sm:border-b-0", "border-b sm:border-b-0 sm:border-r", "border-r", ""][i]
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", stat.bg)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60" />
                  </div>
                  <div>
                    <div className="font-display text-[2rem] font-bold leading-none tabular-nums text-foreground">
                      {stat.value}
                    </div>
                    <div className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ── Main grid ── */}
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

            {/* Left column */}
            <div className="space-y-5 min-w-0">

              {/* Active Projects */}
              <section>
                <SectionHeader
                  title={solo ? "Current Jobs" : "Current Projects"}
                  count={activeProjects.length}
                  href="/projects"
                />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeProjects.length === 0 && !loading ? (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-8 py-14 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
                        <Film className="h-7 w-7 text-[#d4a853]" />
                      </div>
                      <h3 className="font-display text-base font-semibold text-foreground">
                        {solo ? "No active jobs yet" : "Your slate is empty"}
                      </h3>
                      <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        {solo
                          ? "Add your first client job. Track shoots, send cuts, and get feedback — all in one place."
                          : "Start by creating your first project. Track shoots, revisions, and shot lists, all in one place."}
                      </p>
                      <button
                        onClick={() => setModalOpen(true)}
                        className="mt-6 flex items-center gap-2 rounded-xl bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#d4a853]/90"
                      >
                        <Plus className="h-4 w-4" />
                        {solo ? "Add your first job" : "Create your first project"}
                      </button>
                    </div>
                  ) : (
                    <>
                  {activeProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}

                  {/* Add project card */}
                  <button
                    onClick={() => setModalOpen(true)}
                    className="group flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent transition-all hover:border-border/90 hover:bg-white/[0.015]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border transition-colors group-hover:border-muted-foreground/50">
                      <Plus className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      New project
                    </span>
                  </button>
                  </>
                  )}
                </div>
              </section>

              {/* Schedule */}
              <section>
                <SectionHeader title="Schedule" href="/calendar" linkLabel="Full calendar" />
                <div className="rounded-xl border border-border/60 bg-card/40">
                  <UpcomingShoots events={calendarEvents} />
                </div>
              </section>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Onboarding checklist — shown once to new users */}
              {!loading && (
                <OnboardingChecklist
                  hasProjects={projects.length > 0}
                  hasClients={projects.some((p) => !!p.client_name)}
                  hasInvoices={invoices.length > 0}
                  hasRevisions={activity.some((a) => a.type === "revision_uploaded")}
                  isSolo={solo}
                  onCreateProject={() => setModalOpen(true)}
                  userCreatedAt={user?.created_at ?? null}
                />
              )}

              {/* Quick Actions */}
              <section>
                <SectionHeader title="Quick Actions" />
                <QuickActions
                  savedKeys={savedQuickActions}
                  onNewProject={() => setModalOpen(true)}
                />
              </section>

              {/* Revenue Pipeline */}
              <section>
                <SectionHeader title="Revenue Pipeline" href="/finance" linkLabel="Finance" />
                <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
                  {[
                    {
                      label: "Quotes",
                      sub: pipelineQuotes > 0
                        ? `${pipelineQuotes} pending${pipelineQuoteOldestDays !== null ? ` · oldest ${pipelineQuoteOldestDays}d ago` : ""}`
                        : "None sent",
                      warn: pipelineQuoteOldestDays !== null && pipelineQuoteOldestDays >= 7,
                      href: "/finance?tab=quotes",
                      active: pipelineQuotes > 0,
                    },
                    {
                      label: "Contracts",
                      sub: pipelineContracts > 0
                        ? `${pipelineContracts} awaiting signature${pipelineContractOldestDays !== null ? ` · ${pipelineContractOldestDays}d ago` : ""}`
                        : "None sent",
                      warn: pipelineContractOldestDays !== null && pipelineContractOldestDays >= 5,
                      href: "/contracts",
                      active: pipelineContracts > 0,
                    },
                    {
                      label: "Invoices",
                      sub: outstanding > 0 ? `$${outstanding.toLocaleString()} outstanding` : "All clear",
                      warn: false,
                      href: "/finance?tab=invoices",
                      active: outstanding > 0,
                    },
                  ].map((step, i) => (
                    <Link
                      key={step.label}
                      href={step.href}
                      className="group flex items-center gap-3 border-b border-border/50 px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.02]"
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-colors ${step.warn ? "bg-amber-500/15 text-amber-400" : step.active ? "bg-white/[0.07] text-foreground" : "bg-muted/30 text-muted-foreground/40"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground transition-colors">{step.label}</p>
                        <p className={`text-[10px] ${step.warn ? "text-amber-400/80" : step.active ? "text-muted-foreground" : "text-muted-foreground/50"}`}>{step.sub}</p>
                      </div>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </section>

              {/* Client Activity */}
              <ClientActivityWidget />

              {/* Retainers widget */}
              {retainers.length > 0 && (
                <section>
                  <SectionHeader title="Retainers" href="/retainers" />
                  <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60 bg-card/40">
                    {retainers.filter((r) => r.is_active).slice(0, 4).map((r) => (
                      <Link
                        key={r.id}
                        href={`/retainers/${r.id}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                          <Repeat2 className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground transition-colors group-hover:text-foreground">
                            {r.client_name}
                          </p>
                          {r.monthly_rate != null && (
                            <p className="text-[10px] text-muted-foreground">
                              ${r.monthly_rate.toLocaleString()}/mo
                            </p>
                          )}
                        </div>
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Finance widget */}
              {invoices.length > 0 && (
                <section>
                  <SectionHeader title="Finance" href="/finance" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border/60 bg-card p-3.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">This month</span>
                      </div>
                      <p className="font-display text-xl font-bold tabular-nums text-foreground">
                        ${thisMonthInvoiced.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card p-3.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</span>
                      </div>
                      <p className="font-display text-xl font-bold tabular-nums text-foreground">
                        ${outstanding.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Review queue widget */}
              {reviewProjects.length > 0 && (
                <section>
                  <SectionHeader title="Awaiting Feedback" count={reviewProjects.length} href="/projects" />
                  <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-amber-500/15 bg-amber-500/[0.02]">
                    {reviewProjects.slice(0, 4).map((p) => (
                      <Link
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/10">
                          <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                        </div>
                        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground transition-colors group-hover:text-foreground">
                          {p.title}
                        </p>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Activity feed — studio only */}
              {!solo && (
                <section>
                  <SectionHeader title="Recent Activity" />
                  <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                    {activity.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">No activity yet — create a project or upload a revision to get started.</p>
                    ) : (
                      <>
                        <ActivityFeed items={activity.slice(0, 10)} />
                        {activity.length > 10 && (
                          <button
                            onClick={() => { /* navigate to full activity log */ window.location.href = "/projects"; }}
                            className="mt-3 w-full rounded-lg border border-border bg-muted/20 py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {activity.length - 10} more events — view all projects
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Today's shoots — solo only */}
              {solo && (
                <section>
                  <SectionHeader title="Today" />
                  <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                    {todayEvents.length === 0 ? (
                      <div className="py-4 text-center">
                        <p className="text-xs text-muted-foreground">Nothing scheduled today.</p>
                        <Link href="/calendar" className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                          Add a shoot <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {todayEvents.map((e) => (
                          <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
                            <div className="h-2 w-2 shrink-0 rounded-full bg-[#d4a853]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-foreground">{e.title}</p>
                              {e.start_time && <p className="text-[10px] text-muted-foreground">{e.start_time}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
