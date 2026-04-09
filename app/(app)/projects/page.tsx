"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  LayoutGrid,
  List,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUpRight,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { getProjects, deleteProject } from "@/lib/supabase/queries";
import { toast } from "sonner";
import type { Project } from "@/types";
import {
  formatDate,
  formatRelative,
  getProgressColor,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/utils";
import type { ProjectStatus } from "@/types";

type ViewMode = "grid" | "list";

const STATUS_FILTERS: { value: "all" | ProjectStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "In Production" },
  { value: "review", label: "In Review" },
  { value: "draft", label: "Draft" },
  { value: "delivered", label: "Delivered" },
];

function ProjectsPageInner() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects();
        setProjects(data || []);
      } catch (error) {
        console.error("Failed to load projects:", error);
        setProjects([]);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  const handleProjectCreated = async () => {
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch (error) {
      console.error("Failed to refresh projects:", error);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await deleteProject(deleteConfirm.id);
      setProjects(projects.filter((p) => p.id !== deleteConfirm.id));
      toast.success("Project deleted successfully");
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <CreateProjectModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        onSuccess={handleProjectCreated}
      />

      <div className="flex h-full flex-col overflow-hidden">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Projects</h1>
            <p className="text-xs text-muted-foreground">
              {projects.length} projects · {projects.filter((p) => p.status === "active").length} in production
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-[#d4a853] px-4 py-2 text-sm font-semibold text-[#0a0a0a] transition-all hover:bg-[#e0b866] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 border-b border-border px-6 py-3">
          {/* Status filters */}
          <div className="flex items-center gap-1.5 flex-1 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const count =
                f.value === "all"
                  ? projects.length
                  : projects.filter((p) => p.status === f.value).length;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    statusFilter === f.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {f.label}
                  <span className={`rounded px-1 py-0.5 text-[10px] ${statusFilter === f.value ? "bg-black/10" : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + view toggle */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex overflow-hidden rounded-md border border-border">
              {(["grid", "list"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`flex h-8 w-8 items-center justify-center transition-colors ${
                    viewMode === m
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "grid" ? (
                    <LayoutGrid className="h-3.5 w-3.5" />
                  ) : (
                    <List className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 font-display text-3xl text-muted-foreground">◎</div>
              <p className="font-display font-semibold text-foreground">No projects found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or{" "}
                <button onClick={() => setModalOpen(true)} className="text-[#d4a853] underline underline-offset-2">
                  create a new project
                </button>
                .
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <GridView 
              projects={filtered} 
              onNew={() => setModalOpen(true)}
              onDelete={(id, title) => setDeleteConfirm({ id, title })}
            />
          ) : (
            <ListView 
              projects={filtered}
              onDelete={(id, title) => setDeleteConfirm({ id, title })}
            />
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground">Delete project?</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Are you sure you want to delete <span className="font-medium text-foreground">"{deleteConfirm.title}"</span>? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────────

function GridView({
  projects,
  onNew,
  onDelete,
}: {
  projects: Project[];
  onNew: () => void;
  onDelete: (id: string, title: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* New project card */}
      <button
        onClick={onNew}
        className="group flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-transparent transition-all hover:border-[#d4a853]/30 hover:bg-[#d4a853]/[0.02]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border transition-colors group-hover:border-[#d4a853]/40">
          <Plus className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-[#d4a853]" />
        </div>
        <span className="text-xs text-muted-foreground transition-colors group-hover:text-[#d4a853]">
          New project
        </span>
      </button>

      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-xl hover:shadow-black/25"
        >
          {/* Thumbnail */}
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            {project.thumbnail_url ? (
              <Image
                src={project.thumbnail_url}
                alt={project.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
                <span className="text-base font-semibold">
                  {project.title
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")
                    .toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
            <div className="absolute left-3 top-3">
              <StatusBadge status={project.status} />
            </div>
            <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === project.id ? null : project.id);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white/80 opacity-0 transition-opacity backdrop-blur-sm group-hover:opacity-100 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              
              {/* Dropdown menu */}
              {openMenuId === project.id && (
                <div className="absolute -right-1 top-8 w-40 rounded-lg border border-border bg-card shadow-lg z-50">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(project.id, project.title);
                      setOpenMenuId(null);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-display text-sm font-semibold text-foreground transition-colors group-hover:text-[#d4a853]">
                  {project.title}
                </h3>
                {project.client_name && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {project.client_name}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {PROJECT_TYPE_LABELS[project.type]}
              </span>
            </div>

            <div className="mt-auto pt-3">
              <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
                <span>{project.progress}%</span>
              </div>
              <Progress
                value={project.progress}
                className="h-1"
                indicatorClassName={getProgressColor(project.progress)}
              />
              {project.due_date && (
                <p className="mt-2.5 text-[10px] text-muted-foreground">
                  Due {formatDate(project.due_date, "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── List view ──────────────────────────────────────────────────────────────────

function ListView({ projects, onDelete }: { projects: Project[]; onDelete: (id: string, title: string) => void }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 border-b border-border bg-muted/50 px-4 py-2.5">
        {["Project", "Type", "Status", "Progress", ""].map((h) => (
          <div
            key={h}
            className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {h}
            {h === "Project" && <ArrowUpDown className="h-2.5 w-2.5" />}
          </div>
        ))}
      </div>

      {/* Rows */}
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="group grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-border bg-card px-4 py-3 transition-colors last:border-0 hover:bg-accent/40"
        >
          {/* Project */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative h-9 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
              {project.thumbnail_url ? (
                <Image
                  src={project.thumbnail_url}
                  alt={project.title}
                  fill
                  className="object-cover"
                  sizes="56px"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
                  <span className="text-[10px] font-semibold">
                    {project.title
                      .split(" ")
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-[#d4a853]">
                {project.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {project.client_name || "—"}
              </p>
            </div>
          </div>

          {/* Type */}
          <span className="text-xs text-muted-foreground">
            {PROJECT_TYPE_LABELS[project.type]}
          </span>

          {/* Status */}
          <StatusBadge status={project.status} />

          {/* Progress */}
          <div className="flex items-center gap-2">
            <Progress
              value={project.progress}
              className="h-1 w-20"
              indicatorClassName={getProgressColor(project.progress)}
            />
            <span className="w-8 text-right text-[10px] text-muted-foreground">
              {project.progress}%
            </span>
          </div>

          {/* Actions */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenuId((current) => (current === project.id ? null : project.id));
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {openMenuId === project.id && (
              <div className="absolute right-0 top-8 z-10 w-36 rounded-2xl border border-border bg-card p-2 shadow-lg">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(project.id, project.title);
                    setOpenMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenuId(null);
                    router.push(`/projects/${project.id}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  View details
                </button>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsPageInner />
    </Suspense>
  );
}
