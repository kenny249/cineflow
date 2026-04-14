"use client";

import { useEffect, useState } from "react";
import { Plus, Circle, Clock, CheckCircle2, Loader2, Trash2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ProjectTask, ProjectTaskStatus, TaskPriority } from "@/types";

const STATUS_CONFIG: Record<ProjectTaskStatus, { icon: React.ReactNode; label: string; color: string; next: ProjectTaskStatus }> = {
  todo:        { icon: <Circle className="h-4 w-4" />,        label: "To Do",       color: "text-muted-foreground", next: "in_progress" },
  in_progress: { icon: <Clock className="h-4 w-4" />,         label: "In Progress", color: "text-amber-400",        next: "done" },
  done:        { icon: <CheckCircle2 className="h-4 w-4" />,  label: "Done",        color: "text-emerald-400",      next: "todo" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "text-muted-foreground bg-muted/50" },
  medium: { label: "Medium", color: "text-amber-400 bg-amber-400/10" },
  high:   { label: "High",   color: "text-red-400 bg-red-400/10" },
};

interface ProjectTasksTabProps {
  projectId: string;
  canEdit: boolean;
}

export function ProjectTasksTab({ projectId, canEdit }: ProjectTasksTabProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-add form
  const [showForm, setShowForm] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fPriority, setFPriority] = useState<TaskPriority>("medium");
  const [fDue, setFDue] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (!error) setTasks((data ?? []) as ProjectTask[]);
      setLoading(false);
    }
    load();
  }, [projectId]);

  async function handleStatusCycle(task: ProjectTask) {
    const next = STATUS_CONFIG[task.status].next;
    const supabase = createClient();
    const { error } = await supabase
      .from("project_tasks")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) { toast.error("Failed to update"); return; }
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: next } : t));
  }

  async function handleCreate() {
    if (!fTitle.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        created_by: user?.id,
        project_id: projectId,
        title: fTitle.trim(),
        priority: fPriority,
        status: "todo",
        due_date: fDue || null,
        assignee_name: fAssignee.trim() || null,
      })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error("Failed to create task"); return; }
    setTasks((prev) => [...prev, data as ProjectTask]);
    setFTitle(""); setFPriority("medium"); setFDue(""); setFAssignee("");
    setShowForm(false);
    toast.success("Task added");
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("project_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const todo = tasks.filter((t) => t.status === "todo");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/30 border-t-[#d4a853]" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 py-4 space-y-5">
      {/* Stats + Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-medium text-foreground">{inProgress.length}</span> in progress
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Circle className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{todo.length}</span> to do
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium text-foreground">{done.length}</span> done
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </button>
        )}
      </div>

      {/* Quick-add form */}
      {showForm && canEdit && (
        <div className="rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.04] p-4 space-y-3">
          <input
            autoFocus
            value={fTitle}
            onChange={(e) => setFTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowForm(false); }}
            placeholder="Task title…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={fPriority}
                onChange={(e) => setFPriority(e.target.value as TaskPriority)}
                className="appearance-none rounded-lg border border-border bg-background pl-3 pr-7 py-1.5 text-xs text-foreground focus:outline-none"
              >
                <option value="low">Low priority</option>
                <option value="medium">Medium priority</option>
                <option value="high">High priority</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            </div>
            <input
              type="date"
              value={fDue}
              onChange={(e) => setFDue(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none"
            />
            <input
              value={fAssignee}
              onChange={(e) => setFAssignee(e.target.value)}
              placeholder="Assignee (optional)"
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none flex-1 min-w-[120px]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !fTitle.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {creating ? "Adding…" : "Add"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/20" />
          <div>
            <p className="font-display font-semibold text-foreground">No tasks yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add tasks to track what needs to get done for this project.</p>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((task) => {
            const s = STATUS_CONFIG[task.status];
            const p = PRIORITY_CONFIG[task.priority ?? "medium"];
            const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
            return (
              <div
                key={task.id}
                className={`group flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                  task.status === "done"
                    ? "border-border bg-card/30 opacity-60"
                    : "border-border bg-card hover:border-[#d4a853]/20"
                }`}
              >
                {/* Status cycle button */}
                <button
                  onClick={() => handleStatusCycle(task)}
                  className={`mt-0.5 shrink-0 transition-colors hover:opacity-70 ${s.color}`}
                  title={`Mark as ${STATUS_CONFIG[s.next].label}`}
                >
                  {s.icon}
                </button>

                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium text-foreground leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{task.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.color}`}>{p.label}</span>
                    {task.assignee_name && (
                      <span className="text-[11px] text-muted-foreground">{task.assignee_name}</span>
                    )}
                    {task.due_date && (
                      <span className={`text-[11px] ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
                        {isOverdue ? "⚠ " : ""}{new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
