"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useState } from "react";
import {
  Circle, Clock, CheckCircle2, Plus, GripVertical,
  Calendar, User, Tag, Pencil, Trash2, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project, ProjectTask, ProjectTaskStatus, TaskPriority, ProjectTaskType } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type Column = {
  id: ProjectTaskStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
  headerBg: string;
  accent: string;
  dot: string;
};

const COLUMNS: Column[] = [
  {
    id: "todo",
    label: "To Do",
    icon: <Circle className="h-4 w-4" />,
    color: "text-zinc-400",
    headerBg: "bg-zinc-900/60",
    accent: "border-zinc-700",
    dot: "bg-zinc-500",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: <Clock className="h-4 w-4" />,
    color: "text-amber-400",
    headerBg: "bg-amber-950/30",
    accent: "border-amber-800/50",
    dot: "bg-amber-400",
  },
  {
    id: "done",
    label: "Done",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "text-emerald-400",
    headerBg: "bg-emerald-950/30",
    accent: "border-emerald-800/50",
    dot: "bg-emerald-400",
  },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; border: string; bg: string }> = {
  high:   { label: "High",   color: "text-red-400",   border: "border-l-red-500",   bg: "bg-red-500/8" },
  medium: { label: "Medium", color: "text-amber-400",  border: "border-l-amber-500", bg: "bg-amber-500/8" },
  low:    { label: "Low",    color: "text-blue-400",   border: "border-l-blue-500",  bg: "bg-blue-500/8" },
};

const TYPE_LABELS: Record<ProjectTaskType, string> = {
  general: "General", pre_production: "Pre-Prod", production: "Production",
  post_production: "Post-Prod", admin: "Admin",
};

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusCycle,
  isDragging = false,
  isOverlay = false,
}: {
  task: ProjectTask;
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (t: ProjectTask) => void;
  isDragging?: boolean;
  isOverlay?: boolean;
}) {
  const pri = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();
  const isDone = task.status === "done";

  const initials = task.assignee_name
    ? task.assignee_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : null;

  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  const projectTitle = (task.project as { title?: string } | null)?.title;

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-l-[3px] bg-card transition-all duration-150",
        pri.border,
        isDragging && "opacity-40 scale-[0.98]",
        isOverlay && "rotate-1 shadow-2xl shadow-black/50 ring-1 ring-[#d4a853]/30 scale-105",
        !isDragging && !isOverlay && "hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5",
        isDone && "opacity-60"
      )}
    >
      <div className="p-3.5">
        {/* Top row: grip + title + actions */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0 cursor-grab text-zinc-700 opacity-0 group-hover:opacity-100 active:cursor-grabbing transition-opacity">
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-sm font-medium leading-snug",
              isDone ? "line-through text-muted-foreground" : "text-foreground"
            )}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Metadata row */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {projectTitle && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#d4a853]/20 bg-[#d4a853]/8 px-2 py-0.5 text-[10px] font-medium text-[#d4a853]/80">
              {projectTitle}
            </span>
          )}
          {task.type !== "general" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
              <Tag className="h-2.5 w-2.5" />
              {TYPE_LABELS[task.type]}
            </span>
          )}
        </div>

        {/* Bottom row: assignee + due date + priority */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {initials ? (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-300">
                {initials}
              </div>
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-zinc-700">
                <User className="h-2.5 w-2.5 text-zinc-600" />
              </div>
            )}
            {task.assignee_name && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{task.assignee_name}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dueLabel && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium",
                isOverdue ? "text-red-400" : "text-muted-foreground"
              )}>
                {isOverdue && <AlertCircle className="h-2.5 w-2.5" />}
                <Calendar className="h-2.5 w-2.5" />
                {dueLabel}
              </span>
            )}
            <span className={cn("text-[10px] font-semibold", pri.color)}>
              {pri.label}
            </span>
          </div>
        </div>
      </div>

      {/* Status cycle click target (bottom strip) */}
      <button
        onClick={() => onStatusCycle(task)}
        className="absolute bottom-0 left-3 right-3 h-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
        title="Click to advance status"
      />
    </div>
  );
}

// ─── Sortable Card Wrapper ────────────────────────────────────────────────────

function SortableCard({
  task,
  onEdit,
  onDelete,
  onStatusCycle,
}: {
  task: ProjectTask;
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (t: ProjectTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusCycle={onStatusCycle}
        isDragging={isDragging}
      />
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  tasks,
  onEdit,
  onDelete,
  onStatusCycle,
  onAddInColumn,
  isOver,
}: {
  column: Column;
  tasks: ProjectTask[];
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (t: ProjectTask) => void;
  onAddInColumn: (status: ProjectTaskStatus) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: column.id });

  return (
    <div className="flex w-80 shrink-0 flex-col lg:w-auto lg:flex-1 min-h-0">
      {/* Column header */}
      <div className={cn(
        "mb-3 flex shrink-0 items-center gap-2.5 rounded-xl border px-4 py-3",
        column.headerBg,
        column.accent
      )}>
        <span className={column.color}>{column.icon}</span>
        <h3 className={cn("text-sm font-semibold", column.color)}>{column.label}</h3>
        <span className={cn(
          "ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
          column.id === "todo" ? "bg-zinc-800 text-zinc-400" :
          column.id === "in_progress" ? "bg-amber-900/50 text-amber-300" :
          "bg-emerald-900/50 text-emerald-300"
        )}>
          {tasks.length}
        </span>
      </div>

      {/* Drop zone — scrollable card area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto rounded-xl border-2 border-dashed p-2 transition-all duration-200 min-h-[120px]",
          isOver
            ? column.id === "todo" ? "border-zinc-500 bg-zinc-800/30" :
              column.id === "in_progress" ? "border-amber-500/50 bg-amber-900/10" :
              "border-emerald-500/50 bg-emerald-900/10"
            : "border-transparent"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusCycle={onStatusCycle}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && !isOver && (
          <div className="flex h-full min-h-[80px] flex-col items-center justify-center text-center">
            <p className="text-xs text-muted-foreground/40">No tasks</p>
          </div>
        )}
      </div>

      {/* Add task button — always pinned below drop zone */}
      <button
        onClick={() => onAddInColumn(column.id)}
        className={cn(
          "mt-2.5 shrink-0 flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs font-medium transition-all",
          "border-border text-muted-foreground hover:border-[#d4a853]/40 hover:text-[#d4a853] hover:bg-[#d4a853]/5"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

export function KanbanBoard({
  tasks,
  projects,
  onEdit,
  onDelete,
  onStatusCycle,
  onStatusChange,
  onAddInColumn,
}: {
  tasks: ProjectTask[];
  projects: Project[];
  onEdit: (t: ProjectTask) => void;
  onDelete: (id: string) => void;
  onStatusCycle: (t: ProjectTask) => void;
  onStatusChange: (taskId: string, newStatus: ProjectTaskStatus) => void;
  onAddInColumn: (status: ProjectTaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<ProjectTask | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const tasksByStatus = (status: ProjectTaskStatus) =>
    tasks.filter((t) => t.status === status);

  function getColumnId(taskId: string): ProjectTaskStatus | null {
    for (const col of COLUMNS) {
      if (tasks.find((t) => t.id === taskId && t.status === col.id)) return col.id;
    }
    return null;
  }

  function isColumnId(id: string): id is ProjectTaskStatus {
    return ["todo", "in_progress", "done"].includes(id);
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }, [tasks]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Dropped over a column ID (empty column)
    if (isColumnId(overId)) {
      const task = tasks.find((t) => t.id === activeTaskId);
      if (task && task.status !== overId) {
        onStatusChange(activeTaskId, overId);
      }
      return;
    }

    // Dropped over another card — find its column
    const targetColumn = getColumnId(overId);
    const sourceColumn = getColumnId(activeTaskId);

    if (!targetColumn || !sourceColumn) return;

    if (sourceColumn !== targetColumn) {
      onStatusChange(activeTaskId, targetColumn);
    }
  }, [tasks, onStatusChange]);

  const overColumnId = overId
    ? isColumnId(overId)
      ? overId
      : getColumnId(overId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 gap-4 overflow-x-auto pb-4 px-6 pt-4 items-stretch">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus(col.id)}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusCycle={onStatusCycle}
            onAddInColumn={onAddInColumn}
            isOver={overColumnId === col.id}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTask && (
          <TaskCard
            task={activeTask}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusCycle={onStatusCycle}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
