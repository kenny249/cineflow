"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Trash2, CheckCircle2, Circle, Clock, ChevronDown,
  ClipboardList, Filter, LayoutList, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getProjects, getTeamMembers, createNotification, getProfile } from "@/lib/supabase/queries";
import { KanbanBoard } from "./KanbanBoard";
import type { Project, ProjectTask, ProjectTaskType, TaskPriority, ProjectTaskStatus, TeamMember } from "@/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const TASK_TYPES: { value: ProjectTaskType; label: string }[] = [
  { value: "general",         label: "General" },
  { value: "pre_production",  label: "Pre-Production" },
  { value: "production",      label: "Production" },
  { value: "post_production", label: "Post-Production" },
  { value: "admin",           label: "Admin" },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high:   { label: "High",   color: "text-red-400",   bg: "bg-red-400/15 border-red-400/30" },
  medium: { label: "Medium", color: "text-amber-400",  bg: "bg-amber-400/15 border-amber-400/30" },
  low:    { label: "Low",    color: "text-blue-400",   bg: "bg-blue-400/15 border-blue-400/30" },
};

const STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  todo:        { label: "To Do",       color: "text-muted-foreground", icon: <Circle className="h-3.5 w-3.5" /> },
  in_progress: { label: "In Progress", color: "text-amber-400",        icon: <Clock className="h-3.5 w-3.5" /> },
  done:        { label: "Done",        color: "text-emerald-400",       icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

const TYPE_LABELS: Record<ProjectTaskType, string> = {
  general: "General", pre_production: "Pre-Prod", production: "Production",
  post_production: "Post-Prod", admin: "Admin",
};

type ViewMode = "list" | "board";

export default function ProjectTasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("board");

  // Filters
  const [filterStatus, setFilterStatus] = useState<ProjectTaskStatus | "all">("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterType, setFilterType] = useState<ProjectTaskType | "all">("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<ProjectTaskStatus>("todo");

  // Form fields
  const [fTitle, setFTitle] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fProject, setFProject] = useState("");
  const [fType, setFType] = useState<ProjectTaskType>("general");
  const [fPriority, setFPriority] = useState<TaskPriority>("medium");
  const [fStatus, setFStatus] = useState<ProjectTaskStatus>("todo");
  const [fDueDate, setFDueDate] = useState("");
  const [fAssignee, setFAssignee] = useState("");     // display name
  const [fAssigneeId, setFAssigneeId] = useState(""); // linked user id (empty = none/unlinked)

  // Persist view preference
  useEffect(() => {
    const saved = localStorage.getItem("tasks-view") as ViewMode | null;
    if (saved === "list" || saved === "board") setView(saved);
  }, []);

  function switchView(v: ViewMode) {
    setView(v);
    localStorage.setItem("tasks-view", v);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projs, members, profile, { data: { user } }] = await Promise.all([
          getProjects(),
          getTeamMembers(),
          getProfile(),
          supabase.auth.getUser(),
        ]);
        setProjects(projs || []);
        setTeamMembers(members);
        if (!user) return;
        const meName = profile?.full_name?.trim() || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || user.email || "Me";
        setMe({ id: user.id, name: meName });
        const { data } = await supabase
          .from("project_tasks")
          .select("*, project:projects(id, title)")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });
        setTasks((data as ProjectTask[]) || []);
      } catch {
        toast.error("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterProject !== "all" && t.project_id !== filterProject) return false;
    if (filterType !== "all" && t.type !== filterType) return false;
    return true;
  }), [tasks, filterStatus, filterProject, filterType]);

  function openNew(status: ProjectTaskStatus = "todo") {
    setEditingTask(null);
    setDefaultStatus(status);
    setFTitle(""); setFDescription(""); setFProject(""); setFType("general");
    setFPriority("medium"); setFStatus(status); setFDueDate(""); setFAssignee(""); setFAssigneeId("");
    setDialogOpen(true);
  }

  function openEdit(task: ProjectTask) {
    setEditingTask(task);
    setFTitle(task.title);
    setFDescription(task.description || "");
    setFProject(task.project_id || "");
    setFType(task.type);
    setFPriority(task.priority);
    setFStatus(task.status);
    setFDueDate(task.due_date || "");
    setFAssignee(task.assignee_name || "");
    setFAssigneeId(task.assignee_id || "");
    setDialogOpen(true);
  }

  const handleSave = useCallback(async () => {
    if (!fTitle.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        title: fTitle.trim(),
        description: fDescription.trim() || null,
        project_id: fProject || null,
        type: fType,
        priority: fPriority,
        status: fStatus,
        due_date: fDueDate || null,
        assignee_name: fAssignee.trim() || null,
        assignee_id: fAssigneeId || null,
        updated_at: new Date().toISOString(),
      };

      // Notify the assignee when they're a real user, newly assigned, and not the actor.
      const previousAssigneeId = editingTask?.assignee_id || "";
      const shouldNotifyAssignee =
        !!fAssigneeId && fAssigneeId !== user.id && fAssigneeId !== previousAssigneeId;

      if (editingTask) {
        const { data, error } = await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", editingTask.id)
          .select("*, project:projects(id, title)")
          .single();
        if (error) throw error;
        setTasks((prev) => prev.map((t) => t.id === editingTask.id ? data as ProjectTask : t));
        toast.success("Task updated");
      } else {
        const { data, error } = await supabase
          .from("project_tasks")
          .insert({ ...payload, created_by: user.id })
          .select("*, project:projects(id, title)")
          .single();
        if (error) throw error;
        setTasks((prev) => [data as ProjectTask, ...prev]);
        toast.success("Task created");
      }
      if (shouldNotifyAssignee) {
        createNotification({
          user_id: fAssigneeId,
          type: "task_assigned",
          title: `${fAssignee.trim() || "A task"} — assigned to you`,
          description: fTitle.trim(),
          href: "/tasks",
        });
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  }, [fTitle, fDescription, fProject, fType, fPriority, fStatus, fDueDate, fAssignee, fAssigneeId, editingTask]);

  const handleStatusCycle = useCallback(async (task: ProjectTask) => {
    const next: Record<ProjectTaskStatus, ProjectTaskStatus> = {
      todo: "in_progress", in_progress: "done", done: "todo",
    };
    const newStatus = next[task.status];
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      await supabase.from("project_tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", task.id);
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t));
      toast.error("Failed to update task");
    }
  }, []);

  const handleStatusChange = useCallback(async (taskId: string, newStatus: ProjectTaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await supabase.from("project_tasks").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", taskId);
    } catch {
      toast.error("Failed to move task");
      // Revert
      const task = tasks.find((t) => t.id === taskId);
      if (task) setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }, [tasks]);

  // Inline reassign from the list — "pass a task along" without opening the editor.
  // rawValue matches the dialog's scheme: "id:<uid>" (real account), "name:<x>"
  // (unlinked invite), or "" (unassigned).
  const reassignTask = useCallback(async (task: ProjectTask, rawValue: string) => {
    let assignee_id: string | null = null;
    let assignee_name: string | null = null;
    if (rawValue.startsWith("id:")) {
      assignee_id = rawValue.slice(3);
      assignee_name = assignee_id === me?.id ? (me?.name ?? "") : (teamMembers.find((m) => m.user_id === assignee_id)?.name ?? teamMembers.find((m) => m.user_id === assignee_id)?.email ?? "");
    } else if (rawValue.startsWith("name:")) {
      assignee_name = rawValue.slice(5);
    }
    const prev = { assignee_id: task.assignee_id, assignee_name: task.assignee_name };
    setTasks((cur) => cur.map((t) => t.id === task.id ? { ...t, assignee_id, assignee_name: assignee_name ?? undefined } : t));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("project_tasks").update({ assignee_id, assignee_name, updated_at: new Date().toISOString() }).eq("id", task.id);
      // Notify the new assignee if it's a real account, changed, and not the actor.
      if (assignee_id && assignee_id !== user?.id && assignee_id !== prev.assignee_id) {
        createNotification({
          user_id: assignee_id,
          type: "task_assigned",
          title: `${assignee_name || "A task"} — assigned to you`,
          description: task.title,
          href: "/tasks",
        });
      }
      toast.success(assignee_name ? `Assigned to ${assignee_name}` : "Unassigned");
    } catch {
      setTasks((cur) => cur.map((t) => t.id === task.id ? { ...t, ...prev } : t));
      toast.error("Failed to reassign");
    }
  }, [me, teamMembers]);

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await supabase.from("project_tasks").delete().eq("id", id);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  }, []);

  const counts = useMemo(() => ({
    todo: tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }), [tasks]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Tasks</h1>
          <p className="text-xs text-muted-foreground">Project-linked tasks, deadlines, and assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              onClick={() => switchView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                view === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => switchView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all",
                view === "board"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
          </div>

          <Button variant="gold" size="sm" className="h-9 gap-2" onClick={() => openNew()}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stats + Filters bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-2.5">
        {(["todo", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
              filterStatus === s ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].icon}</span>
            {STATUS_CONFIG[s].label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {counts[s]}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="relative">
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="appearance-none rounded-md border border-border bg-transparent py-1 pl-2.5 pr-6 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ProjectTaskType | "all")}
              className="appearance-none rounded-md border border-border bg-transparent py-1 pl-2.5 pr-6 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All types</option>
              {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
            <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="font-display font-semibold text-foreground">No tasks yet</p>
          <p className="text-sm text-muted-foreground">Create your first project task to get organized.</p>
          <Button variant="gold" size="sm" onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>
      ) : view === "board" ? (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            tasks={filtered}
            projects={projects}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusCycle={handleStatusCycle}
            onStatusChange={handleStatusChange}
            onAddInColumn={openNew}
          />
        </div>
      ) : (
        /* List view */
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">No tasks match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[1.5rem_1fr_120px_140px_80px_90px_100px_auto] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
                  {["", "Task", "Project", "Assignee", "Type", "Priority", "Due Date", ""].map((h, i) => (
                    <div key={i} className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</div>
                  ))}
                </div>
                {filtered.map((task) => {
                  const pri = PRIORITY_CONFIG[task.priority];
                  const st = STATUS_CONFIG[task.status];
                  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "grid grid-cols-[1.5rem_1fr_120px_140px_80px_90px_100px_auto] items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0",
                        task.status === "done" ? "bg-muted/20" : "bg-card hover:bg-accent/30"
                      )}
                    >
                      <button
                        onClick={() => handleStatusCycle(task)}
                        title={`Status: ${st.label} — click to advance`}
                        className={cn("flex items-center justify-center transition-colors hover:scale-110", st.color)}
                      >
                        {st.icon}
                      </button>
                      <div className="min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                        <p className={cn("text-sm font-medium", task.status === "done" ? "line-through text-muted-foreground" : "text-foreground")}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="truncate text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                        )}
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {(task.project as { title?: string } | null)?.title || "—"}
                      </span>
                      {/* Inline assignee — reassign / pass a task along without opening the editor */}
                      <select
                        value={task.assignee_id ? `id:${task.assignee_id}` : (task.assignee_name ? `name:${task.assignee_name}` : "")}
                        onChange={(e) => reassignTask(task, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        title="Assign / reassign"
                        className="w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground focus:border-[#d4a853]/50 focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {me && <option value={`id:${me.id}`}>Me ({me.name})</option>}
                        {/* Keep the current name-only assignee selectable if it isn't a linked account */}
                        {task.assignee_name && !task.assignee_id && !teamMembers.some((m) => (m.name ?? m.email) === task.assignee_name) && (
                          <option value={`name:${task.assignee_name}`}>{task.assignee_name}</option>
                        )}
                        {teamMembers.filter((m) => m.user_id !== me?.id).map((m) => (
                          <option key={m.id} value={m.user_id ? `id:${m.user_id}` : `name:${m.name ?? m.email}`}>
                            {m.name ?? m.email}{m.status === "pending" ? " (pending)" : ""}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">{TYPE_LABELS[task.type]}</span>
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", pri.bg, pri.color)}>
                        {pri.label}
                      </span>
                      <span className={cn("text-xs tabular-nums", isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground")}>
                        {task.due_date ? formatDate(task.due_date) : "—"}
                      </span>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="rounded p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update task details." : "Add a project-linked task with deadline and assignee."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Review rough cut…" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={fDescription} onChange={(e) => setFDescription(e.target.value)} rows={2} placeholder="Optional details…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Project</Label>
                <div className="relative">
                  <select
                    value={fProject}
                    onChange={(e) => setFProject(e.target.value)}
                    className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="relative">
                  <select
                    value={fType}
                    onChange={(e) => setFType(e.target.value as ProjectTaskType)}
                    className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <div className="relative">
                  <select
                    value={fPriority}
                    onChange={(e) => setFPriority(e.target.value as TaskPriority)}
                    className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="relative">
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value as ProjectTaskStatus)}
                    className="w-full appearance-none rounded-md border border-border bg-input px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={fDueDate} onChange={(e) => setFDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <select
                  value={fAssigneeId ? `id:${fAssigneeId}` : (fAssignee ? `name:${fAssignee}` : "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.startsWith("id:")) {
                      const uid = v.slice(3);
                      setFAssigneeId(uid);
                      const m = teamMembers.find((tm) => tm.user_id === uid);
                      setFAssignee(uid === me?.id ? me.name : (m?.name ?? m?.email ?? ""));
                    } else if (v.startsWith("name:")) {
                      setFAssigneeId("");
                      setFAssignee(v.slice(5));
                    } else {
                      setFAssigneeId(""); setFAssignee("");
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
                >
                  <option value="">Unassigned</option>
                  {/* Assigning to a real account (Me, or a linked teammate) enables the
                      task to show in their "Assigned to me". Name-only invites are labels. */}
                  {me && <option value={`id:${me.id}`}>Me ({me.name})</option>}
                  {teamMembers.filter((m) => m.user_id !== me?.id).map((m) => (
                    <option key={m.id} value={m.user_id ? `id:${m.user_id}` : `name:${m.name ?? m.email}`}>
                      {m.name ?? m.email}{m.status === "pending" ? " (pending)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="gold" size="sm" onClick={handleSave} disabled={saving || !fTitle.trim()}>
              {saving ? "Saving…" : editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
