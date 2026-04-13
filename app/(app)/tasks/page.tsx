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
  Flame,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCompletionBurst, BurstRenderer } from "@/components/shared/CompletionBurst";
import { getTasks, createTask as dbCreateTask, updateTask as dbUpdateTask, deleteTask as dbDeleteTask, type DbTask } from "@/lib/supabase/queries";

type Task = DbTask;

const PRIORITY_CONFIG = {
  high:   { label: "High",   dot: "bg-red-400",   active: "bg-red-400/15 border-red-400/40 text-red-400" },
  medium: { label: "Medium", dot: "bg-amber-400",  active: "bg-amber-400/15 border-amber-400/40 text-amber-400" },
  low:    { label: "Low",    dot: "bg-blue-400",   active: "bg-blue-400/15 border-blue-400/40 text-blue-400" },
};

const SOUND_KEY = "cf_tasks_sound_enabled";
const QUOTE_SEED_KEY = "cf_tasks_quote_seed";

const MOTIVATIONAL_QUOTES = [
  "Keep going. You are building real momentum.",
  "One task at a time. Big wins are stacked small wins.",
  "Progress beats perfection every single day.",
  "Locked in beats lucky.",
  "Done is your new superpower.",
  "Small steps today. Big results soon.",
  "Stay in motion. Finish strong.",
  "You are closer than you think.",
  "Focus now. Flex later.",
  "Execution is the edge.",
  "Your future self will thank you for this session.",
  "Momentum is earned. You are earning it.",
  "Make this hour count.",
  "Discipline is freedom in disguise.",
  "Build the habit. The results will follow.",
  "No overthinking. Next task.",
  "You do not need more time, just one more push.",
  "Turn pressure into progress.",
  "Consistency is your competitive advantage.",
  "You are not behind. You are in motion.",
  "Today is for execution.",
  "The work you finish today changes tomorrow.",
  "Get in, get it done, get ahead.",
  "Action creates clarity.",
  "Keep the promise you made to yourself.",
  "Momentum loves completed tasks.",
  "Stay sharp. Stay moving.",
  "The hard part is starting. You already did that.",
  "Win this block. Win this day.",
  "You are capable of more than you think.",
  "No noise, just progress.",
  "Energy follows action.",
  "You are building proof, not just plans.",
  "Crush the next thing in front of you.",
  "The grind is where confidence is built.",
  "Keep the streak alive.",
  "Less talk. More shipped.",
  "Your standards are showing. Keep going.",
  "Task by task, you are becoming unstoppable.",
  "Finish what matters first.",
];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledIndices(length: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getOrCreateQuoteSeed(): string {
  const existing = localStorage.getItem(QUOTE_SEED_KEY);
  if (existing) return existing;
  const seed = `seed_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  localStorage.setItem(QUOTE_SEED_KEY, seed);
  return seed;
}

function getDailyQuote(dateKey: string): string {
  const seed = getOrCreateQuoteSeed();
  const cycle = shuffledIndices(MOTIVATIONAL_QUOTES.length, hashString(seed));
  const dayIndex = Math.floor(new Date(`${dateKey}T12:00:00`).getTime() / 86400000);
  const idx = cycle[Math.abs(dayIndex) % cycle.length];
  return MOTIVATIONAL_QUOTES[idx];
}

function computeStreak(tasks: Task[]): number {
  let streak = 0;
  let day = subDays(new Date(), 1);
  for (let i = 0; i < 90; i++) {
    const ds = format(day, "yyyy-MM-dd");
    const dt = tasks.filter((t) => t.date === ds);
    if (dt.length === 0 || !dt.every((t) => t.done)) break;
    streak++;
    day = subDays(day, 1);
  }
  return streak;
}

// ── Ambient particle canvas ───────────────────────────────────────────────────
type Particle = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean; o: number };

function TasksCanvas({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const pts = useRef<Particle[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    pts.current = Array.from({ length: 60 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r:  0.6 + Math.random() * 1.3,
      gold: Math.random() < 0.2,
      o:  0.03 + Math.random() * 0.07,
    }));

    const REPEL = 95, ATTRACT = 230, CONNECT = 105;

    const draw = () => {
      const { width: W, height: H } = canvas;
      ctx.clearRect(0, 0, W, H);
      const { x: mx, y: my } = mouse.current;

      if (mx > -500) {
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, 260);
        g.addColorStop(0,   "rgba(212,168,83,0.025)");
        g.addColorStop(0.5, "rgba(212,168,83,0.007)");
        g.addColorStop(1,   "rgba(212,168,83,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      const p = pts.current;
      for (const pt of p) {
        const dx = pt.x - mx, dy = pt.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < REPEL && d > 0) {
          const f = ((REPEL - d) / REPEL) * 0.5;
          pt.vx += (dx / d) * f; pt.vy += (dy / d) * f;
        } else if (d < ATTRACT && d > REPEL) {
          const f = ((ATTRACT - d) / (ATTRACT - REPEL)) * 0.05;
          pt.vx -= (dx / d) * f; pt.vy -= (dy / d) * f;
        }
        pt.vx *= 0.975; pt.vy *= 0.975;
        const spd = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
        if (spd > 1.8) { pt.vx = (pt.vx / spd) * 1.8; pt.vy = (pt.vy / spd) * 1.8; }
        pt.x += pt.vx; pt.y += pt.vy;
        if (pt.x < -10) pt.x = W + 10;
        if (pt.x > W + 10) pt.x = -10;
        if (pt.y < -10) pt.y = H + 10;
        if (pt.y > H + 10) pt.y = -10;
      }

      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const a = (1 - d / CONNECT) * 0.05;
            ctx.beginPath();
            ctx.moveTo(p[i].x, p[i].y);
            ctx.lineTo(p[j].x, p[j].y);
            ctx.strokeStyle = (p[i].gold || p[j].gold) ? `rgba(212,168,83,${a})` : `rgba(229,231,235,${a * 0.55})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      for (const pt of p) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = pt.gold ? `rgba(212,168,83,${pt.o})` : `rgba(229,231,235,${pt.o * 0.65})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" aria-hidden />;
}

// ── Animated check button ─────────────────────────────────────────────────────
function CheckButton({
  done,
  completing,
  onClick,
}: {
  done: boolean;
  completing: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative shrink-0 flex items-center justify-center w-6 h-6 group/cb"
      aria-label={done ? "Mark incomplete" : "Mark complete"}
    >
      <AnimatePresence>
        {completing && (
          <motion.span
            key="ring"
            className="absolute inset-0 rounded-full border-2 border-[#d4a853]"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.55, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      <motion.div
        animate={completing ? { scale: [1, 1.4, 1] } : {}}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ duration: 0.22, ease: "backOut" }}
            >
              <CheckCircle2 className="h-5 w-5 text-[#d4a853]" />
            </motion.div>
          ) : (
            <motion.div
              key="undone"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Circle className="h-5 w-5 text-border group-hover/cb:text-[#d4a853]/50 transition-colors" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </button>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewDate, setViewDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [showAdd, setShowAdd] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [completingIds, setCompletingIds] = useState<string[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dailyQuote, setDailyQuote] = useState("");
  const [sessionCompletedCount, setSessionCompletedCount] = useState(0);
  const [showCompletionGlow, setShowCompletionGlow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { fire, particles } = useCompletionBurst();

  // Load all tasks from DB on mount (no date filter — needed for streak computation)
  useEffect(() => {
    getTasks().then(setTasks).catch(() => {});
    const rawSound = localStorage.getItem(SOUND_KEY);
    setSoundEnabled(rawSound !== "false");
    setDailyQuote(getDailyQuote(format(new Date(), "yyyy-MM-dd")));
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    setSessionCompletedCount(0);
    setDailyQuote(getDailyQuote(viewDate));
  }, [viewDate]);

  const dayTasks     = tasks.filter((t) => t.date === viewDate);
  const doneTasks    = dayTasks.filter((t) => t.done);
  const pendingTasks = dayTasks.filter((t) => !t.done);
  const progress     = dayTasks.length > 0 ? doneTasks.length / dayTasks.length : 0;
  const isViewToday  = viewDate === format(new Date(), "yyyy-MM-dd");
  const streak       = computeStreak(tasks);
  const allDoneToday = dayTasks.length > 0 && dayTasks.every((t) => t.done);

  // No-op kept for streak recomputation after viewDate change — data comes from DB
  const refreshTasks = useCallback(() => {
    getTasks().then(setTasks).catch(() => {});
  }, []);

  const playCompletionSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const t = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(680, t);
      osc1.frequency.exponentialRampToValueAtTime(920, t + 0.09);
      gain1.gain.setValueAtTime(0.0001, t);
      gain1.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.14);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1040, t + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(1240, t + 0.11);
      gain2.gain.setValueAtTime(0.0001, t + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.045, t + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(t + 0.02);
      osc2.stop(t + 0.15);
    } catch {
      // No-op on unsupported browsers.
    }
  }, [soundEnabled]);

  const playAllDoneSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AC();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const t = ctx.currentTime;

      const note1 = ctx.createOscillator();
      const note1Gain = ctx.createGain();
      note1.type = "triangle";
      note1.frequency.setValueAtTime(740, t);
      note1Gain.gain.setValueAtTime(0.0001, t);
      note1Gain.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
      note1Gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      note1.connect(note1Gain).connect(ctx.destination);
      note1.start(t);
      note1.stop(t + 0.18);

      const note2 = ctx.createOscillator();
      const note2Gain = ctx.createGain();
      note2.type = "sine";
      note2.frequency.setValueAtTime(988, t + 0.09);
      note2Gain.gain.setValueAtTime(0.0001, t + 0.09);
      note2Gain.gain.exponentialRampToValueAtTime(0.055, t + 0.11);
      note2Gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      note2.connect(note2Gain).connect(ctx.destination);
      note2.start(t + 0.09);
      note2.stop(t + 0.3);

      const note3 = ctx.createOscillator();
      const note3Gain = ctx.createGain();
      note3.type = "triangle";
      note3.frequency.setValueAtTime(1318, t + 0.2);
      note3Gain.gain.setValueAtTime(0.0001, t + 0.2);
      note3Gain.gain.exponentialRampToValueAtTime(0.045, t + 0.22);
      note3Gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      note3.connect(note3Gain).connect(ctx.destination);
      note3.start(t + 0.2);
      note3.stop(t + 0.42);
    } catch {
      // No-op on unsupported browsers.
    }
  }, [soundEnabled]);

  const addTask = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setNewTitle("");
    try {
      const created = await dbCreateTask({ title: trimmed, priority: newPriority, date: viewDate });
      setTasks((prev) => [...prev, created]);
    } catch { /* silent — DB save failed */ }
    inputRef.current?.focus();
  };

  const toggleTask = (id: string, e: React.MouseEvent) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const completing = !task.done;
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: completing } : t));
    setTasks(updated);
    dbUpdateTask(id, { done: completing }).catch(() => {});

    if (completing) {
      setCompletingIds((prev) => [...prev, id]);
      setTimeout(() => setCompletingIds((prev) => prev.filter((x) => x !== id)), 750);
      fire(e.clientX, e.clientY);
      setSessionCompletedCount((c) => c + 1);
      const vdt = updated.filter((t) => t.date === viewDate);
      if (vdt.length > 0 && vdt.every((t) => t.done)) {
        playAllDoneSound();
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        setCelebrating(true);
        celebrateTimer.current = setTimeout(() => setCelebrating(false), 4500);
        if (glowTimer.current) clearTimeout(glowTimer.current);
        setShowCompletionGlow(true);
        glowTimer.current = setTimeout(() => setShowCompletionGlow(false), 2000);
      } else {
        playCompletionSound();
      }
    }
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    dbDeleteTask(id).catch(() => {});
  };
  // Keep refreshTasks available for future use
  void refreshTasks;
  const prevDay  = () => setViewDate((d) => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"));
  const nextDay  = () => setViewDate((d) => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"));
  const goToday  = () => setViewDate(format(new Date(), "yyyy-MM-dd"));
  const openAdd  = () => { setShowAdd(true); setTimeout(() => inputRef.current?.focus(), 50); };
  const closeAdd = () => { setShowAdd(false); setNewTitle(""); };

  return (
    <div ref={containerRef} className="relative flex h-full flex-col overflow-hidden bg-background">

      {/* Ambient particle layer */}
      <TasksCanvas containerRef={containerRef as React.RefObject<HTMLDivElement>} />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-[#d4a853]" />
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground">Tasks</h1>
            <AnimatePresence>
              {streak >= 2 && (
                <motion.div
                  key="streak"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="flex items-center gap-0.5 rounded-full border border-orange-400/25 bg-orange-400/10 px-2 py-0.5 text-[11px] font-bold text-orange-400"
                  title={`${streak}-day streak`}
                >
                  <Flame className="h-3 w-3" />
                  {streak}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {sessionCompletedCount >= 2 && (
                <motion.div
                  key="momentum"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="hidden sm:flex items-center gap-1 rounded-full border border-[#d4a853]/30 bg-[#d4a853]/10 px-2 py-0.5 text-[11px] font-bold text-[#d4a853]"
                  title="Tasks completed in this session"
                >
                  <Sparkles className="h-3 w-3" />
                  Locked in: {sessionCompletedCount}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/70 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-[#d4a853]/30 transition-all"
              title={soundEnabled ? "Turn completion sound off" : "Turn completion sound on"}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Sound {soundEnabled ? "On" : "Off"}</span>
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#c49843] active:scale-95 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Task
            </button>
          </div>
        </div>

        {/* Date nav + progress */}
        <div className="shrink-0 border-b border-border px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={prevDay}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-90 transition-all"
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
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground active:scale-90 transition-all"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <motion.p
            key={dailyQuote}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="text-center text-xs text-muted-foreground italic"
          >
            {dailyQuote}
          </motion.p>

          <AnimatePresence>
            {!isViewToday && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onClick={goToday}
                className="block w-full overflow-hidden text-center text-[11px] text-[#d4a853] hover:underline"
              >
                Back to Today
              </motion.button>
            )}
          </AnimatePresence>

          {dayTasks.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-medium text-muted-foreground">
                  {doneTasks.length} of {dayTasks.length} completed
                </span>
                <motion.span
                  key={Math.round(progress * 100)}
                  initial={{ opacity: 0.5, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-bold text-foreground"
                >
                  {Math.round(progress * 100)}%
                </motion.span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-border">
                <motion.div
                  className="h-full rounded-full"
                  initial={false}
                  animate={{
                    width: `${progress * 100}%`,
                    background: progress === 1
                      ? "linear-gradient(90deg, #34d399, #059669)"
                      : "linear-gradient(90deg, #d4a853, #e8c06e)",
                    boxShadow: progress === 1
                      ? "0 0 8px rgba(52,211,153,0.6)"
                      : "none",
                  }}
                  transition={{ type: "spring", stiffness: 130, damping: 22 }}
                />
                {progress === 1 && showCompletionGlow && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)" }}
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 0.8, ease: "easeInOut", repeat: 2, repeatDelay: 0.1 }}
                  />
                )}
              </div>
              <AnimatePresence>
                {allDoneToday && (
                  <motion.p
                    key="all-done-inline"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.2 }}
                    className="mt-2 text-center text-[11px] font-semibold text-[#d4a853]"
                  >
                    You cleared the board. Keep that energy.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Wrap banner */}
          <AnimatePresence>
            {celebrating && (
              <motion.div
                initial={{ opacity: 0, y: -14, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="mb-4 flex items-center gap-3 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10 px-4 py-3"
              >
                <Sparkles className="h-5 w-5 shrink-0 text-[#d4a853]" />
                <div>
                  <p className="text-sm font-bold text-foreground">That&apos;s a wrap.</p>
                  <p className="text-xs text-muted-foreground">All tasks done for the day.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {dayTasks.length === 0 && !showAdd && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.3, ease: "backOut" }}
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-border"
              >
                <CheckCircle2 className="h-7 w-7 text-muted-foreground/25" />
              </motion.div>
              <p className="font-semibold text-foreground">
                No tasks for {isViewToday ? "today" : "this day"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Add tasks to stay on top of your day.</p>
              <button
                onClick={openAdd}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#d4a853]/20 bg-[#d4a853]/10 px-4 py-2 text-sm font-medium text-[#d4a853] hover:bg-[#d4a853]/15 active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" /> Add first task
              </button>
            </div>
          )}

          {/* Pending */}
          <AnimatePresence mode="popLayout">
            {pendingTasks.map((task, i) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: 0.2, delay: i * 0.04, layout: { duration: 0.2 } }}
                className="group mb-2 flex items-center gap-3 rounded-xl border border-border bg-card/75 backdrop-blur-sm px-4 py-3 hover:border-[#d4a853]/25 transition-colors"
              >
                <CheckButton
                  done={task.done}
                  completing={completingIds.includes(task.id)}
                  onClick={(e) => toggleTask(task.id, e)}
                />
                <p className="flex-1 min-w-0 text-sm font-medium text-foreground truncate">{task.title}</p>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_CONFIG[task.priority].dot}`}
                  title={`${PRIORITY_CONFIG[task.priority].label} priority`}
                />
                <button
                  onClick={() => deleteTask(task.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground/25 opacity-0 group-hover:opacity-100 hover:text-red-400 active:scale-90 transition-all"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Completed */}
          {doneTasks.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Completed</p>
              <AnimatePresence mode="popLayout">
                {doneTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, layout: { duration: 0.2 } }}
                    className="group mb-2 flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3"
                  >
                    <CheckButton
                      done={task.done}
                      completing={false}
                      onClick={(e) => toggleTask(task.id, e)}
                    />
                    <p className="flex-1 min-w-0 text-sm text-muted-foreground/50 line-through truncate">
                      {task.title}
                    </p>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="shrink-0 rounded p-1 text-muted-foreground/25 opacity-0 group-hover:opacity-100 hover:text-red-400 active:scale-90 transition-all"
                      aria-label="Delete"
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
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="mt-2 rounded-xl border border-[#d4a853]/35 bg-card/85 backdrop-blur-sm px-4 py-3 shadow-[0_0_20px_rgba(212,168,83,0.06)]"
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
                  className="w-full border-0 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/35 outline-none"
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
                    className="rounded-lg bg-[#d4a853] px-3 py-1 text-xs font-semibold text-black hover:bg-[#c49843] disabled:opacity-40 active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <BurstRenderer particles={particles} />
    </div>
  );
}

