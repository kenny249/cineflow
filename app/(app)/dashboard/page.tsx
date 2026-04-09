"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Clock,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  Plus,
  LogOut,
} from "lucide-react";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { UpcomingShoots } from "@/components/dashboard/UpcomingShoots";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { getProjects } from "@/lib/supabase/queries";
import { formatDate, getProgressColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { MOCK_ACTIVITY } from "@/mock/activity";
import { MOCK_EVENTS } from "@/mock/calendar";
import type { Project } from "@/types";

export default function DashboardPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
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

      <div className="flex h-full flex-col overflow-y-auto custom-scrollbar">
        <div className="flex-1 space-y-6 p-6">

          {/* ── Welcome header ── */}
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-0.5 text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#d4a853]">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {greeting}{user?.email ? `, ${user.email.split('@')[0]}` : ''}<span className="text-[#d4a853]">.</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/12"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-[#d4a853]/25 bg-[#d4a853]/8 px-4 py-2 text-sm font-medium text-[#d4a853] transition-all hover:border-[#d4a853]/40 hover:bg-[#d4a853]/12"
              >
                <Plus className="h-4 w-4" />
                New Project
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
                  {activeProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-xl hover:shadow-black/30"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-36 w-full overflow-hidden bg-muted">
                        {project.thumbnail_url && (
                          <Image
                            src={project.thumbnail_url}
                            alt={project.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            unoptimized
                          />
                        )}
                        {/* Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
                        {/* Status */}
                        <div className="absolute left-3 top-3">
                          <StatusBadge status={project.status} />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-3.5">
                        <h3 className="truncate font-display text-sm font-semibold text-foreground transition-colors group-hover:text-[#d4a853]">
                          {project.title}
                        </h3>
                        {project.client_name && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {project.client_name}
                          </p>
                        )}

                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Progress</span>
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {project.progress}%
                            </span>
                          </div>
                          <Progress
                            value={project.progress}
                            className="h-1"
                            indicatorClassName={getProgressColor(project.progress)}
                          />
                        </div>

                        {project.due_date && (
                          <p className="mt-2.5 text-[10px] text-muted-foreground">
                            Due {formatDate(project.due_date, "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </Link>
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
