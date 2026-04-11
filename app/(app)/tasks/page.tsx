"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format, addDays, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useCompletionBurst, BurstRenderer } from "@/components/shared/CompletionBurst";

interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: "high" | "medium" | "low";
  date: string; // YYYY-MM-DD
  createdAt: string;
}

const PRIORITY_CONFIG = {
  high:   { label: "High",   dot: "bg-red-400",   active: "bg-red-400/15 border-red-400/40 text-red-400" },
  medium: { label: "Medium", dot: "bg-amber-400",  active: "bg-amber-400/15 border-amber-400/40 text-amber-400" },
  low:    { label: "Low",    dot: "bg-blue-400",   active: "bg-blue-400/15 border-blue-400/40 text-blue-400" },
};

const STORAGE_KEY = "cf_daily_tasks";

function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* noop */
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewDate, setViewDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [showAdd, setShowAdd] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fire, particles } = useCompletionBurst();

  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  // Compute derived values
  const dayTasks = tasks.filter((t) => t.date === viewDate);
  const doneTasks = dayTasks.filter((t) => t.done);
  const pendingTasks = dayTasks.filter((t) => !t.done);
  const progress = dayTasks.length > 0 ? doneTasks.length / dayTasks.length : 0;
  const isViewToday = viewDate === format(new Date(), "yyyy-MM-dd");

  const updateTasks = useCallback((updated: Task[]) => {
    setTasks(updated);
    saveTasks(updated);
  }, []);

  const addTask = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      done: false,
      priority: newPriority,
      date: viewDate,
      createdAt: new Date().toISOString(),
    };
    updateTasks([...tasks, task]);
    setNewTitle("");
    inputRef.current?.focus();
  };

  const toggleTask = (id: string, e: React.MouseEvent) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const completing = !task.done;
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: completing } : t));
    updateTasks(updated);

    if (completing) {
      fire(e.clientX, e.clientY);
      const viewDayTasks = updated.filter((t) => t.date === viewDate);
      const allDone = viewDayTasks.length > 0 && viewDayTasks.every((t) => t.done);
      if (allDone) {
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        setCelebrating(true);
        celebrateTimer.current = setTimeout(() => setCelebrating(false), 4200);
      }
    }
  };

  const deleteTask = (id: string) => {
    updateTasks(tasks.filter((t) => t.id !== id));
  };

  const prevDay = () =>
    setViewDate((d) => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"));
  const nextDay = () =>
    setViewDate((d) => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"));
  const goToday = () => setViewDate(format(new Date(), "yyyy-MM-dd"));

  const openAdd = () => {
    setShowAdd(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeAdd = () => {
    setShowAdd(false);
    setNewTitle("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#d4a853]" />
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Tasks</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Task
        </button>
      </div>

      {/* Date nav + progress */}
      <div className="shrink-0 border-b border-border px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={prevDay}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-display text-base font-bold text-foreground">
              {isViewToday ? "Today" : format(new Date(viewDate + "T12:00:00"), "EEEE")}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(viewDate + "T12:00:00"), "MMMM d, yyyy")}
            </p>
          </div>
          <button
            onClick={nextDay}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {!isViewToday && (
          <button
            onClick={goToday}
            className="block w-full text-center text-[11px] text-[#d4a853] hover:underline"
          >
            Back to Today
          </button>
        )}

        {dayTasks.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-muted-foreground">
                {doneTasks.length} of {dayTasks.length} completed
              </span>
              <span className="font-bold text-foreground">{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full rounded-full bg-[#d4a853]"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* All-done celebration banner */}
        <AnimatePresence>
          {celebrating && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="mb-4 flex items-center gap-3 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10 px-4 py-3"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-[#d4a853]" />
              <div>
                <p className="text-sm font-bold text-foreground">All done! 🎬</p>
                <p className="text-xs text-muted-foreground">Wrap time. Great work today.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {dayTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="font-semibold text-foreground">
              No tasks for {isViewToday ? "today" : "this day"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Add tasks to stay on top of your day.</p>
            <button
              onClick={openAdd}
              className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/10 px-4 py-2 text-sm font-medium text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add first task
            </button>
          </div>
        )}

        {/* Pending */}
        <AnimatePresence mode="popLayout">
          {pendingTasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="group mb-2 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-[#d4a853]/20 transition-colors"
            >
              <button
                onClick={(e) => toggleTask(task.id, e)}
                className="shrink-0"
                aria-label="Complete task"
              >
                <Circle className="h-5 w-5 text-border group-hover:text-[#d4a853]/60 transition-colors" />
              </button>
              <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{task.title}</p>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_CONFIG[task.priority].dot}`}
                title={`${PRIORITY_CONFIG[task.priority].label} priority`}
              />
              <button
                onClick={() => deleteTask(task.id)}
                className="shrink-0 rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Completed */}
        {doneTasks.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Completed
            </p>
            <AnimatePresence mode="popLayout">
              {doneTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="group mb-2 flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3"
                >
                  <button
                    onClick={(e) => toggleTask(task.id, e)}
                    className="shrink-0"
                    aria-label="Undo task"
                  >
                    <CheckCircle2 className="h-5 w-5 text-[#d4a853]" />
                  </button>
                  <p className="flex-1 min-w-0 text-sm text-muted-foreground line-through truncate">
                    {task.title}
                  </p>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 rounded p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Add task form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="mt-2 rounded-xl border border-[#d4a853]/30 bg-card px-4 py-3"
            >
              <input
                ref={inputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTask();
                  if (e.key === "Escape") closeAdd();
                }}
                placeholder="What needs to get done?"
                className="w-full border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex gap-1">
                  {(["high", "medium", "low"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                        newPriority === p
                          ? PRIORITY_CONFIG[p].active
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  onClick={closeAdd}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addTask}
                  disabled={!newTitle.trim()}
                  className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BurstRenderer particles={particles} />
    </div>
  );
}
