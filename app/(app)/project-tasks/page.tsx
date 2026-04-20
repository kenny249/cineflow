"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus, Trash2, CheckCircle2, Circle, Clock, ChevronDown,
  ClipboardList, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getProjects, getTeamMembers, createNotification } from "@/lib/supabase/queries";
import type { Project, ProjectTask, ProjectTaskType, TaskPriority, ProjectTaskStatus, TeamMember } from "@/types";
import { formatDate } from "@/lib/utils";

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

export default function ProjectTasksPage() {
  const supabase = createClient();
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ProjectTaskStatus | "all">("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterType, setFilterType] = useState<ProjectTaskType | "all">("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fTitle, setFTitle] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fProject, setFProject] = useState("");
  const [fType, setFType] = useState<ProjectTaskType>("general");
  const [fPriority, setFPriority] = useState<TaskPriority>("medium");
  const [fStatus, setFStatus] = useState<ProjectTaskStatus>("todo");
  const [fDueDate, setFDueDate] = useState("");
  const [fAssignee, setFAssignee] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [projs, members, { data: { user } }] = await Promise.all([
          getProjects(),
          getTeamMembers(),
          supabase.auth.getUser(),
        ]);
        setProjects(projs || []);
        setTeamMembers(members);
        if (!user) return;
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

  function openNew() {
    setEditingTask(null);
    setFTitle(""); setFDescription(""); setFProject(""); setFType("general");
    setFPriority("medium"); setFStatus("todo"); setFDueDate(""); setFAssignee("");
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
        updated_at: new Date().toISOString(),
      };

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
        if (fAssignee.trim()) {
          createNotification({
            user_id: user.id,
            type: "task_assigned",
            title: `Task assigned to ${fAssignee.trim()}`,
            description: fTitle.trim(),
            href: "/project-tasks",
          });
        }
      }
      setDialogOpen(false);
    } catch {
      toast.error("Failed to save task");
    } finally {
      setSaving(false);
    }
  }, [fTitle, fDescription, fProject, fType, fPriority, fStatus, fDueDate, fAssignee, editingTask]);

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
        <Button variant="gold" size="sm" className="h-9 gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-2.5">
        {(["todo", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
              filterStatus === s ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={STATUS_CONFIG[s].color}>{STATUS_CONFIG[s].icon}</span>
            {STATUS_CONFIG[s].label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-2">
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

      {/* Task list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
              <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-display font-semibold text-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground">Create your first project task to get organized.</p>
            <Button variant="gold" size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
           <div className="min-w-[620px]">
            {/* Column headers */}
            <div className="grid grid-cols-[1.5rem_1fr_120px_80px_90px_100px_auto] items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
              {["", "Task", "Project", "Type", "Priority", "Due Date", ""].map((h, i) => (
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
                  className={`grid grid-cols-[1.5rem_1fr_120px_80px_90px_100px_auto] items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 ${
                    task.status === "done" ? "bg-muted/20" : "bg-card hover:bg-accent/30"
                  }`}
                >
                  {/* Status toggle */}
                  <button
                    onClick={() => handleStatusCycle(task)}
                    title={`Status: ${st.label} — click to advance`}
                    className={`flex items-center justify-center transition-colors ${st.color} hover:scale-110`}
                  >
                    {st.icon}
                  </button>

                  {/* Title + description */}
                  <div className="min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                    <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="truncate text-[11px] text-muted-foreground mt-0.5">{task.description}</p>
                    )}
                    {task.assignee_name && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">→ {task.assignee_name}</p>
                    )}
                  </div>

                  {/* Project */}
                  <span className="truncate text-xs text-muted-foreground">
                    {(task.project as any)?.title || "—"}
                  </span>

                  {/* Type */}
                  <span className="text-xs text-muted-foreground">
                    {TYPE_LABELS[task.type]}
                  </span>

                  {/* Priority */}
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pri.bg} ${pri.color}`}>
                    {pri.label}
                  </span>

                  {/* Due date */}
                  <span className={`text-xs tabular-nums ${isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                    {task.due_date ? formatDate(task.due_date) : "—"}
                  </span>

                  {/* Actions */}
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
                {teamMembers.length > 0 ? (
                  <select
                    value={fAssignee}
                    onChange={(e) => setFAssignee(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-[#d4a853]/50 focus:outline-none focus:ring-1 focus:ring-[#d4a853]/30"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.name ?? m.email}>
                        {m.name ?? m.email}{m.status === "pending" ? " (pending)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} placeholder="Name or team member" />
                )}
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
