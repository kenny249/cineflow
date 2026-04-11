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
} from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { getOrCreateDisplayName } from "@/lib/random-name";

const COMPLIMENTS = [
  "The lens never lies — and today, you're looking sharp.",
  "Every great film starts with one bold decision. Make yours today.",
  "Your vision is your superpower. Trust it.",
  "Lights. Camera. You've got this.",
  "The best directors show up even when it's hard. You showed up.",
  "Frame it, shoot it, own it.",
  "Today's cut could be tomorrow's masterpiece.",
  "The story you tell matters. Keep telling it.",
  "Cinematic excellence isn't accidental — and neither are you.",
  "Roll camera. The world is watching.",
  "You're not just making content. You're making history.",
  "Stay curious. The best shot is always the next one.",
];

function getDailyCompliment(): string {
  const day = new Date().getDate() + new Date().getMonth() * 31;
  return COMPLIMENTS[day % COMPLIMENTS.length];
}
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UpcomingShoots } from "@/components/dashboard/UpcomingShoots";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardParticles } from "@/components/dashboard/DashboardParticles";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { getProjects } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import { MOCK_ACTIVITY } from "@/mock/activity";
import { MOCK_EVENTS } from "@/mock/calendar";
import type { Project } from "@/types";

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Early Tester");
  const router = useRouter();

  useEffect(() => {
    setDisplayName(getOrCreateDisplayName());
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const projectsData = await getProjects();
      setProjects(projectsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProjectSuccess = () => {
    loadData(); // Refresh projects list
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

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "review");
  const upcomingShoots = MOCK_EVENTS.filter((event) => event.type === "shoot").length;

  const stats = [
    {
      label: "Active",
      value: activeProjects.length,
      icon: TrendingUp,
      color: "text-[#d4a853]",
      bg: "bg-[#d4a853]/10",
    },
    {
      label: "Upcoming shoots",
      value: upcomingShoots,
      icon: Camera,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Pending review",
      value: projects.filter(p => p.status === "review").length,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Delivered",
      value: projects.filter((p) => p.status === "delivered").length,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
  ];

  return (
    <>
      <CreateProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handleCreateProjectSuccess} />

      <div className="relative flex h-full flex-col overflow-y-auto custom-scrollbar">
        <DashboardParticles />
        <div className="relative flex-1 space-y-6 p-6">

          {/* ── Welcome header ── */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#d4a853]">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {greeting}, {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-[#d4a853]/25 bg-[#d4a853]/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.2em] text-[#d4a853] uppercase">
                  <Sparkles className="h-2.5 w-2.5" />
                  Early Tester
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground italic">
                {getDailyCompliment()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-1.5 text-xs font-medium text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/12 sm:px-4 sm:py-2 sm:text-sm"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/8 px-3 py-1.5 text-xs font-medium text-[#d4a853] transition-all hover:border-[#d4a853]/40 hover:bg-[#d4a853]/12 sm:px-4 sm:py-2 sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* ── Stat pills ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d4a853]/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:bg-card"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bg} transition-all duration-200 group-hover:shadow-[0_0_14px_rgba(212,168,83,0.2)]`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <div>
                  <div className="font-display text-xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div className="grid gap-5 xl:grid-cols-[1fr_280px]">

            {/* Left column */}
            <div className="space-y-5 min-w-0">

              {/* Active Projects */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                    <span className="h-3 w-0.5 rounded-full bg-[#d4a853]" />
                    Active Projects
                    <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
                      {activeProjects.length}
                    </span>
                  </h2>
                  <Link
                    href="/projects"
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeProjects.length === 0 && !loading ? (
                    <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-8 py-14 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10">
                        <Film className="h-7 w-7 text-[#d4a853]" />
                      </div>
                      <h3 className="font-display text-base font-semibold text-foreground">Your slate is empty</h3>
                      <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        Start by creating your first project. Track shoots, revisions, and shot lists — all in one place.
                      </p>
                      <button
                        onClick={() => setModalOpen(true)}
                        className="mt-6 flex items-center gap-2 rounded-xl bg-[#d4a853] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#d4a853]/90"
                      >
                        <Plus className="h-4 w-4" />
                        Create your first project
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
                    className="group flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent transition-all hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.02]"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border transition-colors group-hover:border-[#d4a853]/40">
                      <Plus className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[#d4a853]" />
                    </div>
                    <span className="text-xs text-muted-foreground transition-colors group-hover:text-[#d4a853]">
                      New project
                    </span>
                  </button>
                  </>
                  )}
                </div>
              </section>

              {/* Upcoming Shoots */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                    <span className="h-3 w-0.5 rounded-full bg-[#d4a853]" />
                    Upcoming Shoots
                  </h2>
                  <Link
                    href="/calendar"
                    className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Full calendar
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="rounded-xl border border-border bg-card">
                  <UpcomingShoots />
                </div>
              </section>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Quick Actions */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <span className="h-3 w-0.5 rounded-full bg-[#d4a853]" />
                  Quick Actions
                </h2>
                <QuickActions
                  onNewProject={() => setModalOpen(true)}
                  onAddShotList={() => router.push("/shot-lists")}
                  onUploadRevision={() => router.push("/revisions")}
                />
              </section>

              {/* Activity feed */}
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                  <span className="h-3 w-0.5 rounded-full bg-[#d4a853]" />
                  Recent Activity
                </h2>
                <div className="rounded-xl border border-border bg-card p-4">
                  <ActivityFeed items={MOCK_ACTIVITY.slice(0, 7)} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
