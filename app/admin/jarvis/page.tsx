"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff, Square, Activity, BarChart3, Maximize2, Minimize2, SlidersHorizontal, Zap, Brain, Laugh, Clock, Minus, Trash2 } from "lucide-react";

type JarvisState = "idle" | "listening" | "processing" | "speaking";
type ViewMode    = "voice" | "data" | "history";

interface ChatMessage {
  role: "user" | "jarvis";
  text: string;
  ts: Date;
  latencyMs?: number;
}

interface PastSession {
  id: string;
  command_count: number;
  duration_ms: number | null;
  created_at: string;
  messages: Array<{ role: "user" | "jarvis"; text: string; ts: string }>;
}

interface LiveStats {
  totalUsers: number;
  signupsToday: number;
  signupsWeek: number;
  activeLastWeek: number;
  paid: number;
  trialing: number;
  expired: number;
  mrr: number;
  arr: number;
  breakdown: Record<string, number>;
}

// ── CountUp ────────────────────────────────────────────────────────────────────

function CountUp({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    let start: number | null = null;
    const duration = 1600;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(eased * to));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [to]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// ── Typewriter ─────────────────────────────────────────────────────────────────

function TypewriterText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <>{shown}</>;
}

// ── Waveform bars ──────────────────────────────────────────────────────────────

const BAR_PATTERNS = [
  [6,  22, 10, 40, 14, 30,  8, 44, 12, 26,  7],
  [12,  8, 36, 16, 48,  9, 28, 14, 42, 10, 20],
  [20, 38,  9, 30, 12, 44, 16, 36,  8, 24, 14],
  [16, 28, 42,  8, 24, 14, 38, 10, 32, 18, 44],
  [ 9, 18,  7, 34, 24, 14, 40, 22,  8, 36, 12],
  [18, 10, 30, 14,  6, 36, 16, 48, 12, 26, 42],
  [ 8, 32, 16,  5, 38, 20, 10, 44, 18, 28,  9],
  [24, 14, 46, 10, 28,  6, 40, 18, 34, 12, 22],
  [10, 26,  8, 42, 18, 36, 12, 30,  6, 20, 38],
  [14, 40, 20,  8, 44, 24, 10, 32, 46, 16,  6],
  [28,  8, 34, 12, 20, 46, 14, 38,  8, 30, 18],
];
const BAR_DELAYS = [0, 0.09, 0.05, 0.14, 0.07, 0.18, 0.03, 0.12, 0.01, 0.16, 0.08];

const WaveformBars = memo(function WaveformBars({
  active, listening, color, audioHeights,
}: { active: boolean; listening?: boolean; color: string; audioHeights?: number[] }) {
  // Listening state: 3 slow-pulse dots — signals "waiting for input", not audio activity
  if (listening && !active) {
    return (
      <div className="flex items-center justify-center gap-3" style={{ height: 52 }}>
        {[0, 0.28, 0.56].map((delay, i) => (
          <motion.div key={i} className="rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}, 0 0 20px ${color}60` }}
            animate={{ width: [5, 10, 5], height: [5, 10, 5], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.5, delay, repeat: Infinity, ease: "easeInOut" }} />
        ))}
      </div>
    );
  }
  if (active && audioHeights) {
    return (
      <div className="flex items-center justify-center gap-[3px]" style={{ height: 52 }}>
        {audioHeights.map((h, i) => (
          <div key={i} className="rounded-full" style={{ backgroundColor: color, width: 3, height: h, boxShadow: `0 0 10px ${color}, 0 0 22px ${color}70, 0 0 40px ${color}30`, transition: "height 0.04s linear" }} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 52 }}>
      {BAR_PATTERNS.map((kf, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ backgroundColor: color, width: 3, boxShadow: active ? `0 0 10px ${color}, 0 0 22px ${color}60` : "none" }}
          animate={active ? { height: kf.map(v => `${v}px`) } : { height: "3px" }}
          transition={
            active
              ? { duration: 1.8, repeat: Infinity, delay: BAR_DELAYS[i], ease: "easeInOut" }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── HUD Components ────────────────────────────────────────────────────────────

function RadarSweep({ c, active, r = 210 }: { c: string; active: boolean; r?: number }) {
  if (!active) return null;
  return (
    <motion.div className="absolute pointer-events-none rounded-full"
      style={{ width: r * 2, height: r * 2, left: -r, top: -r,
        background: `conic-gradient(from -8deg, transparent 0deg, ${c}05 6deg, ${c}18 20deg, ${c}06 38deg, transparent 65deg, transparent 360deg)`,
      }} animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} />
  );
}

function TickRing({ radius, count, c }: { radius: number; count: number; c: string }) {
  const ticks = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 360;
    const rad = (angle - 90) * (Math.PI / 180);
    const major = i % Math.round(count / 8) === 0;
    const inner = major ? radius - 11 : radius - 5;
    return { rad, inner, major };
  });
  return (
    <svg className="absolute pointer-events-none" style={{ width: radius * 2, height: radius * 2, left: -radius, top: -radius }} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
      {ticks.map(({ rad, inner, major }, i) => (
        <line key={i}
          x1={radius + Math.cos(rad) * inner} y1={radius + Math.sin(rad) * inner}
          x2={radius + Math.cos(rad) * radius} y2={radius + Math.sin(rad) * radius}
          stroke={major ? `${c}55` : `${c}22`} strokeWidth={major ? 1.5 : 0.75} />
      ))}
    </svg>
  );
}

const TELEMETRY_LINES = [
  "CF.NEURAL.CORE → NOMINAL",
  "MEM.HEAP: 0x7F2A4B08",
  "API.ANTHROPIC: 200 OK",
  "DB.SUPABASE: CONN.ACK",
  "TLS.CERT: VALID · 365d",
  "CRON.JOBS: 4 ACTIVE",
  "CACHE.HIT: 94.2%",
  "WEBHOOK.STRIPE: LISTEN",
  "VERCEL.EDGE: 3 REGIONS",
  "AUTH.JWT: VALID · HS256",
  "RATE.LIMIT: 0/100 REQ",
  "ENTROPY.POOL: 4096b",
  "QUEUE.DEPTH: 0 MSG",
  "SYS.LOAD: 0.12 0.09",
  "BUILD: PROD · NEXT.JS 15",
  "SSL.HANDSHAKE: DONE",
  "CF-J4RV1S: ◈ ONLINE",
];

function SystemTicker({ c }: { c: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % TELEMETRY_LINES.length), 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="overflow-hidden space-y-0.5">
      {[0, 1, 2, 3].map(off => (
        <p key={`${idx}-${off}`} className="text-[5px] font-mono truncate"
          style={{ color: off === 0 ? `${c}55` : `rgba(255,255,255,${Math.max(0.03, 0.09 - off * 0.025)})` }}>
          {TELEMETRY_LINES[(idx + off) % TELEMETRY_LINES.length]}
        </p>
      ))}
    </div>
  );
}

const FREQ_COUNT = 26;

function FrequencyBars({ c, active, heights }: { c: string; active: boolean; heights?: number[] }) {
  const [hs, setHs] = useState(() => Array.from({ length: FREQ_COUNT }, (_, i) => 4 + Math.abs(Math.sin(i * 0.7)) * 14));
  useEffect(() => {
    if (heights) return;
    const id = setInterval(() => {
      setHs(prev => prev.map(h => Math.max(2, Math.min(38, h + (Math.random() - 0.5) * (active ? 11 : 2.5)))));
    }, active ? 65 : 500);
    return () => clearInterval(id);
  }, [active, heights]);
  const display = heights ?? hs;
  const hasSignal = heights ? heights.some(h => h > 6) : false;
  return (
    <div className="flex items-end gap-px" style={{ height: 42, opacity: heights ? (hasSignal ? 0.8 : 0.25) : active ? 0.75 : 0.2, transition: "opacity 0.4s" }}>
      {display.map((h, i) => (
        <div key={i} style={{
          width: 3, height: Math.max(2, h),
          background: `linear-gradient(to top, ${c}, ${c}55)`,
          borderRadius: "1px 1px 0 0",
          transition: heights ? "height 30ms linear" : "height 65ms ease-out",
        }} />
      ))}
    </div>
  );
}

function OrbitingNodes({ stats, c, sessionActive }: { stats: LiveStats | null; c: string; sessionActive: boolean }) {
  // Diamond layout: equal spacing, max ±159px from center so nodes stay inside orb container
  const nodes = [
    { label: "USERS",   val: stats?.totalUsers,    angle: 45,  color: "#e2e8f0", prefix: "" },
    { label: "ARR",     val: stats?.arr,            angle: 90,  color: "#f59e0b", prefix: "$" },
    { label: "MRR",     val: stats?.mrr,            angle: 135, color: "#d4a853", prefix: "$" },
    { label: "ACTIVE",  val: stats?.activeLastWeek, angle: 180, color: "#3b82f6", prefix: "" },
    { label: "PAID",    val: stats?.paid,           angle: 225, color: "#10b981", prefix: "" },
    { label: "TRIAL",   val: stats?.trialing,       angle: 270, color: "#8b5cf6", prefix: "" },
    { label: "SIGNUPS", val: stats?.signupsWeek,    angle: 315, color: "#06b6d4", prefix: "" },
    { label: "EXPIRED", val: stats?.expired,        angle: 0,   color: "#ef4444", prefix: "" },
  ];
  const r = 240;

  // Pre-compute positions
  const positions = nodes.map(({ angle }) => {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r, rad };
  });

  return (
    <>
      {/* Neural network lines between nodes */}
      <svg className="absolute pointer-events-none" style={{ width: r * 2 + 100, height: r * 2 + 100, left: -(r + 50), top: -(r + 50), overflow: "visible" }}>
        {positions.map((a, i) =>
          positions.slice(i + 1).map((b, j) => (
            <motion.line key={`${i}-${j}`}
              x1={r + 50 + a.x} y1={r + 50 + a.y}
              x2={r + 50 + b.x} y2={r + 50 + b.y}
              stroke={`${c}18`} strokeWidth={0.75} strokeDasharray="4 6"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.15, 0.45, 0.15], strokeDashoffset: [0, -40] }}
              transition={{ opacity: { duration: 3 + i * 0.7, repeat: Infinity }, strokeDashoffset: { duration: 4, repeat: Infinity, ease: "linear" } }}
            />
          ))
        )}
        {/* Lines from center to each node */}
        {positions.map((pos, i) => (
          <motion.line key={`c${i}`}
            x1={r + 50} y1={r + 50}
            x2={r + 50 + Math.cos(pos.rad) * 152} y2={r + 50 + Math.sin(pos.rad) * 152}
            stroke={`${nodes[i].color}25`} strokeWidth={0.5} strokeDasharray="3 8"
            animate={{ opacity: [0.1, 0.35, 0.1], strokeDashoffset: [0, -22] }}
            transition={{ opacity: { duration: 2.5 + i * 0.5, repeat: Infinity, delay: i * 0.3 }, strokeDashoffset: { duration: 3, repeat: Infinity, ease: "linear" } }}
          />
        ))}
      </svg>

      {/* Data node labels */}
      {nodes.map(({ label, val, color, prefix }, idx) => {
        const { x, y } = positions[idx];
        return (
          <motion.div key={label} className="absolute pointer-events-none" style={{ left: "50%", top: "50%" }}
            initial={{ opacity: 0 }} animate={{ opacity: sessionActive ? 1 : 0.65 }} transition={{ duration: 0.8, delay: idx * 0.15 }}>
            <div className="absolute" style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
              <motion.div className="rounded px-2 py-1 text-center" style={{ border: `1px solid ${color}35`, background: "rgba(0,0,0,0.9)", minWidth: 48 }}
                animate={{ boxShadow: [`0 0 0px ${color}00`, `0 0 10px ${color}35`, `0 0 0px ${color}00`] }}
                transition={{ duration: 2.8, repeat: Infinity, delay: idx * 0.7 }}>
                <p className="text-[5px] tracking-[0.4em]" style={{ color: `${color}55` }}>{label}</p>
                <p className="text-[11px] font-bold font-mono leading-tight" style={{ color, textShadow: `0 0 10px ${color}` }}>
                  {val !== null && val !== undefined ? `${prefix}${val}` : "···"}
                </p>
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}

function HudReadout({ commandCount, sessionElapsed, state, c, sessionActive }: {
  commandCount: number; sessionElapsed: number; state: JarvisState; c: string; sessionActive: boolean;
}) {
  const [sig, setSig] = useState("98.7");
  useEffect(() => {
    if (!sessionActive) return;
    const id = setInterval(() => setSig((98 + Math.random() * 2).toFixed(1)), 2200);
    return () => clearInterval(id);
  }, [sessionActive]);
  return (
    <div className="flex items-center gap-5 mt-3 px-4 py-1.5 rounded" style={{ border: `1px solid ${c}12`, background: `${c}04` }}>
      {[
        { label: "SIG", val: `${sig} MHz`, col: `${c}70` },
        { label: "NODE", val: "CF-J4RV1S", col: "rgba(255,255,255,0.2)" },
        { label: "CMD", val: `#${String(commandCount).padStart(3, "0")}`, col: `${c}80` },
        { label: "UPTIME", val: fmtDuration(sessionElapsed), col: `${c}80` },
        { label: "STATUS", val: state.toUpperCase(), col: c },
      ].map(({ label, val, col }) => (
        <div key={label}>
          <p className="text-[4px] tracking-[0.5em] text-zinc-800">{label}</p>
          <p className="text-[7px] font-mono" style={{ color: col }}>{val}</p>
        </div>
      ))}
    </div>
  );
}

// ── Personality Panel ─────────────────────────────────────────────────────────

interface Personality { humor: number; energy: number; formality: number }

function PersonalityPanel({ value, onChange, c }: { value: Personality; onChange: (p: Personality) => void; c: string }) {
  const sliders = [
    { key: "humor"     as const, label: "HUMOR",     icon: Laugh,  lo: "DEADPAN",      hi: "WITTY"       },
    { key: "energy"    as const, label: "ENERGY",    icon: Zap,    lo: "CALM",         hi: "FIRED UP"    },
    { key: "formality" as const, label: "FORMALITY", icon: Brain,  lo: "CASUAL",       hi: "FORMAL"      },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }} transition={{ duration: 0.15 }}
      className="absolute top-full right-0 mt-2 z-50 p-4 w-72 rounded"
      style={{ background: "rgba(4,4,6,0.97)", border: `1px solid ${c}30`, boxShadow: `0 0 40px ${c}15` }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[7px] tracking-[0.5em] text-zinc-500">PERSONALITY DIALS</p>
        <p className="text-[6px] font-mono text-zinc-700">AFFECTS ALL RESPONSES</p>
      </div>
      <div className="space-y-4">
        {sliders.map(({ key, label, icon: Icon, lo, hi }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className="h-2.5 w-2.5" style={{ color: c }} />
                <span className="text-[7px] tracking-widest font-medium" style={{ color: c }}>{label}</span>
              </div>
              <span className="text-[7px] font-mono" style={{ color: `${c}80` }}>{value[key]}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[5px] tracking-wider text-zinc-700 w-10 text-right">{lo}</span>
              <div className="relative flex-1 h-1 rounded-full" style={{ background: `${c}15` }}>
                <motion.div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${value[key]}%`, background: `linear-gradient(90deg, ${c}60, ${c})`, boxShadow: `0 0 8px ${c}` }} />
                <input type="range" min={0} max={100} value={value[key]}
                  onChange={e => onChange({ ...value, [key]: Number(e.target.value) })}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer" style={{ height: "100%" }} />
              </div>
              <span className="text-[5px] tracking-wider text-zinc-700 w-10">{hi}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <button onClick={() => onChange({ humor: 50, energy: 50, formality: 50 })}
          className="text-[6px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">RESET TO DEFAULTS</button>
      </div>
    </motion.div>
  );
}


// ── History Mode ───────────────────────────────────────────────────────────────

function HistoryModeView({ sessions, loading, onDelete }: { sessions: PastSession[]; loading: boolean; onDelete: (id: string) => void }) {
  const [selected, setSelected] = useState<PastSession | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleting(id);
    fetch(`/api/admin/jarvis/sessions?id=${id}`, { method: "DELETE" })
      .then(r => {
        if (r.ok) {
          onDelete(id);
          if (selected?.id === id) setSelected(null);
        }
      })
      .finally(() => setDeleting(null));
  };

  return (
    <div className="flex h-full w-full">
      {/* Session list */}
      <div className="w-72 shrink-0 flex flex-col p-4" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[6px] tracking-[0.6em] text-zinc-600">SESSION LOG</p>
          <p className="text-[6px] font-mono text-zinc-700">{sessions.length} SESSIONS</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loading && <p className="text-[8px] font-mono text-zinc-700 py-4 text-center">Loading…</p>}
          {!loading && sessions.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-[8px] font-mono text-zinc-700">No past sessions yet.</p>
              <p className="text-[7px] text-zinc-800 mt-1">Sessions are saved when you end a session.</p>
            </div>
          )}
          {sessions.map(session => {
            const date = new Date(session.created_at);
            const preview = session.messages.find(m => m.role === "user")?.text ?? "";
            const isSel = selected?.id === session.id;
            const isDeleting = deleting === session.id;
            return (
              <div key={session.id} className="relative group">
                <button onClick={() => setSelected(session)}
                  className="w-full text-left rounded p-2.5 transition-all pr-7"
                  style={{ background: isSel ? "#d4a85310" : "rgba(255,255,255,0.02)", border: `1px solid ${isSel ? "#d4a85330" : "rgba(255,255,255,0.05)"}` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[7px] font-mono" style={{ color: isSel ? "#d4a853" : "#71717a" }}>
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                    <span className="text-[6px] font-mono text-zinc-700">{session.command_count} cmds</span>
                  </div>
                  {session.duration_ms != null && (
                    <p className="text-[6px] font-mono text-zinc-800">{fmtDuration(session.duration_ms)}</p>
                  )}
                  {preview && <p className="text-[7px] text-zinc-700 truncate mt-0.5">{preview.slice(0, 55)}</p>}
                </button>
                <button
                  onClick={e => handleDelete(e, session.id)}
                  disabled={isDeleting}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                  style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)" }}
                  title="Delete session">
                  <Trash2 size={9} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 flex flex-col p-4 min-w-0">
        {!selected ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[9px] font-mono text-zinc-800">← Select a session to read transcript</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-4 pb-3 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <p className="text-[6px] tracking-[0.5em] text-zinc-600">TRANSCRIPT</p>
              <p className="text-[7px] font-mono text-zinc-600">
                {new Date(selected.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                {selected.duration_ms != null ? ` · ${fmtDuration(selected.duration_ms)}` : ""}
                {` · ${selected.command_count} commands`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-text cursor-text">
              {selected.messages.map((msg, i) => (
                <div key={i}>
                  <p className="text-[6px] tracking-widest mb-1" style={{ color: msg.role === "user" ? "#3b82f650" : "#d4a85350" }}>
                    {msg.role === "user" ? "KENNY" : "JARVIS"}
                  </p>
                  <div className="rounded-lg p-2.5 text-[11px] leading-relaxed"
                    style={msg.role === "jarvis"
                      ? { backgroundColor: "#d4a85306", border: "1px solid #d4a85318", color: "#d4d4d8" }
                      : { backgroundColor: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", color: "#71717a" }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Data Mode ──────────────────────────────────────────────────────────────────

const PLAN_META = [
  { key: "lifetime",   label: "LIFETIME",   color: "#d4a853" },
  { key: "enterprise", label: "ENTERPRISE", color: "#8b5cf6" },
  { key: "agency",     label: "AGENCY",     color: "#3b82f6" },
  { key: "studio",     label: "STUDIO",     color: "#10b981" },
  { key: "solo",       label: "SOLO",       color: "#f59e0b" },
];

function GlowBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  return (
    <div className="h-[6px] rounded-full overflow-hidden" style={{ background: `${color}12` }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}cc, ${color})`, boxShadow: `0 0 14px ${color}, 0 0 28px ${color}60` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct > 0 ? Math.max(pct, 4) : 0}%` }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay }}
      />
    </div>
  );
}

function DataModeView({
  stats, messages, sessionActive, commandCount, sessionElapsed, avgLatency, state, c, elevenlabsOk,
}: {
  stats: LiveStats | null;
  messages: ChatMessage[];
  sessionActive: boolean;
  commandCount: number;
  sessionElapsed: number;
  avgLatency: number | null;
  state: JarvisState;
  c: string;
  elevenlabsOk: boolean;
}) {
  const total = stats?.totalUsers ?? 0;
  const convRate = stats ? Math.round((stats.paid / Math.max(total, 1)) * 100) : 0;

  const topTiles = [
    { label: "TOTAL USERS", value: total,           color: "#e2e8f0", prefix: "" as const, suffix: "" },
    { label: "MRR",         value: stats?.mrr ?? 0, color: "#d4a853", prefix: "$",         suffix: "" },
    { label: "ARR",         value: stats?.arr ?? 0, color: "#d4a853", prefix: "$",         suffix: "" },
    { label: "PAID",        value: stats?.paid ?? 0, color: "#10b981", prefix: "",          suffix: "" },
    { label: "CONVERSION",  value: convRate,         color: "#d4a853", prefix: "",          suffix: "%" },
  ];

  const funnel = [
    { label: "REGISTERED",  value: total,                     pct: 100,                                          color: "#e2e8f0" },
    { label: "ACTIVE / 7D", value: stats?.activeLastWeek ?? 0, pct: stats ? (stats.activeLastWeek / Math.max(total, 1)) * 100 : 0, color: "#10b981" },
    { label: "PAID",        value: stats?.paid ?? 0,           pct: stats ? (stats.paid / Math.max(total, 1)) * 100 : 0,           color: "#d4a853" },
    { label: "TRIALING",    value: stats?.trialing ?? 0,       pct: stats ? (stats.trialing / Math.max(total, 1)) * 100 : 0,       color: "#8b5cf6" },
    { label: "EXPIRED",     value: stats?.expired ?? 0,        pct: stats ? (stats.expired / Math.max(total, 1)) * 100 : 0,        color: "#ef4444" },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-3 p-4 overflow-hidden">

      {/* Top metric tiles */}
      <div className="grid grid-cols-5 gap-2 shrink-0">
        {topTiles.map(({ label, value, color, prefix, suffix }, idx) => (
          <motion.div key={label} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: idx * 0.07 }}
            className="relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${color}0a 0%, ${color}03 100%)`, border: `1px solid ${color}30` }}>
            {/* Chamfer top-right */}
            <div className="absolute top-0 right-0 w-4 h-4 pointer-events-none" style={{ background: `linear-gradient(225deg, ${color}35 50%, transparent 50%)` }} />
            {/* Scan shimmer */}
            <motion.div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${color}08, transparent)` }}
              animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.8, repeat: Infinity, delay: idx * 0.35, ease: "linear" }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}16 0%, transparent 70%)` }} />
            <div className="relative p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[5px] tracking-[0.55em]" style={{ color: `${color}65` }}>{label}</p>
                <motion.div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2 + idx * 0.2, repeat: Infinity }} />
              </div>
              <p className="text-3xl font-black font-mono tabular-nums leading-none" style={{ color, textShadow: `0 0 20px ${color}80, 0 0 40px ${color}40` }}>
                {stats ? <CountUp to={value} prefix={prefix} suffix={suffix} /> : "···"}
              </p>
            </div>
            <motion.div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}cc, transparent)` }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2.5 + idx * 0.3, repeat: Infinity }} />
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="relative p-5 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.3) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none" style={{ background: "linear-gradient(225deg, rgba(255,255,255,0.08) 50%, transparent 50%)" }} />
          <motion.div className="absolute left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} animate={{ top: ["0%", "100%"] }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} />
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-500">PLAN DISTRIBUTION</p>
            <div className="flex items-center gap-2">
              <motion.div className="h-1 w-1 rounded-full bg-emerald-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2.1, repeat: Infinity }} />
              <p className="text-[6px] font-mono text-zinc-600">{total} REGISTERED</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {PLAN_META.map(({ key, label, color }, i) => {
              const count = stats?.breakdown?.[key] ?? 0;
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                      <span className="text-[7px] tracking-widest font-medium" style={{ color: `${color}85` }}>{label}</span>
                    </div>
                    <motion.span className="text-xl font-black font-mono" style={{ color, textShadow: `0 0 14px ${color}` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
                      {stats ? <CountUp to={count} /> : "·"}
                    </motion.span>
                  </div>
                  <GlowBar pct={pct} color={color} delay={0.25 + i * 0.09} />
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
          className="relative p-5 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.3) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none" style={{ background: "linear-gradient(225deg, rgba(255,255,255,0.08) 50%, transparent 50%)" }} />
          <motion.div className="absolute left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} animate={{ top: ["100%", "0%"] }} transition={{ duration: 7, repeat: Infinity, ease: "linear" }} />
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-500">USER FUNNEL</p>
            <motion.span className="text-[6px] font-mono text-zinc-600 tracking-wider" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5, repeat: Infinity }}>● LIVE DATA</motion.span>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {funnel.map(({ label, value, pct, color }, i) => (
              <div key={label}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span className="text-[7px] tracking-widest font-medium" style={{ color: `${color}85` }}>{label}</span>
                  </div>
                  <motion.span className="text-xl font-black font-mono" style={{ color, textShadow: `0 0 14px ${color}` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
                    {stats ? <CountUp to={value} /> : "·"}
                  </motion.span>
                </div>
                <GlowBar pct={pct} color={color} delay={0.3 + i * 0.09} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom: system + log */}
      <div className="grid grid-cols-2 gap-3 shrink-0" style={{ height: 148 }}>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.35 }}
          className="relative p-4 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.3) 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none" style={{ background: "linear-gradient(225deg, rgba(255,255,255,0.1) 50%, transparent 50%)" }} />
          <div className="flex items-center justify-between mb-3">
            <p className="text-[6px] tracking-[0.6em] text-zinc-500">SYSTEM STATUS</p>
            <p className="text-[5px] font-mono text-zinc-700">{new Date().toLocaleTimeString("en-US", { hour12: false })}</p>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-2">
            {[
              { label: "SUPABASE",   node: "US-EAST-1",  on: true,         dur: 2.3, color: "#10b981" },
              { label: "ANTHROPIC",  node: "SONNET 4.6",  on: true,         dur: 3.1, color: "#8b5cf6" },
              { label: "ELEVENLABS", node: "TTS STREAM",  on: elevenlabsOk, dur: 2.7, color: "#3b82f6" },
            ].map(({ label, node, on, dur, color }) => (
              <div key={label} className="flex items-center gap-2 px-2 py-1.5" style={{ border: `1px solid ${on ? color + "18" : "rgba(255,255,255,0.04)"}`, background: on ? `${color}05` : "transparent" }}>
                <motion.div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: on ? color : "#27272a", boxShadow: on ? `0 0 6px ${color}` : "none" }} animate={on ? { opacity: [0.4, 1, 0.4] } : {}} transition={{ duration: dur, repeat: Infinity }} />
                <span className="text-[7px] tracking-widest text-zinc-500 flex-1">{label}</span>
                <span className="text-[6px] font-mono" style={{ color: on ? color : "#3f3f46" }}>{on ? node : "OFFLINE"}</span>
              </div>
            ))}
          </div>
          {sessionActive && (
            <div className="pt-2.5 mt-2.5 border-t border-white/[0.04] flex items-center gap-4">
              {[
                { label: "SESSION", val: fmtDuration(sessionElapsed), color: c },
                { label: "CMDS",    val: String(commandCount),         color: "#e2e8f0" },
                ...(avgLatency !== null ? [{ label: "AVG LAT", val: `${avgLatency}s`, color: "#10b981" }] : []),
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <p className="text-[5px] tracking-widest text-zinc-700">{label}</p>
                  <p className="text-[11px] font-mono font-bold" style={{ color }}>{val}</p>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <motion.div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.4, repeat: Infinity }} />
                <p className="text-[10px] font-mono font-bold tracking-widest" style={{ color: c }}>{state.toUpperCase()}</p>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.4 }}
          className="rounded-xl p-4 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[6px] tracking-[0.6em] text-zinc-600 mb-3">COMMAND LOG</p>
          <div className="flex-1 overflow-y-auto space-y-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.length === 0 ? (
              <p className="text-[8px] font-mono text-zinc-800">// awaiting commands</p>
            ) : (
              messages.slice(-8).map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[9px] font-mono shrink-0 mt-0.5" style={{ color: msg.role === "user" ? "#3b82f6" : "#d4a853" }}>{msg.role === "user" ? "›" : "‹"}</span>
                  <p className={`text-[8px] font-mono leading-snug ${msg.role === "user" ? "text-zinc-600" : "text-zinc-400"}`}>{msg.text.slice(0, 100)}{msg.text.length > 100 ? "…" : ""}</p>
                </div>
              ))
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function JarvisPage() {
  const [state, setState]               = useState<JarvisState>("idle");
  const [viewMode, setViewMode]         = useState<ViewMode>("voice");
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [stats, setStats]               = useState<LiveStats | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [clock, setClock]               = useState("");
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [latencies, setLatencies]       = useState<number[]>([]);
  const [elevenlabsOk, setElevenlabsOk] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barHeights, setBarHeights]     = useState<number[]>([6, 22, 10, 40, 14, 30, 8, 44, 12, 26, 7]);
  const [personality, setPersonality]   = useState<Personality>({ humor: 50, energy: 50, formality: 50 });
  const [showPersonality, setShowPersonality] = useState(false);
  const [activeTools, setActiveTools]   = useState<string[]>([]);
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<"" | "saved" | "error">("");
  const [muted, setMuted]               = useState(false);
  const [micFreqData, setMicFreqData]   = useState<number[]>(() => Array(26).fill(4));

  const containerRef          = useRef<HTMLDivElement>(null);
  const conversationActiveRef = useRef(false);
  const processingRef         = useRef(false);
  const speakingRef           = useRef(false);   // true only while audio is actively playing
  const sessionStartRef       = useRef<number | null>(null);
  const recognitionRef        = useRef<any>(null);
  const audioRef              = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef        = useRef<MediaSource | null>(null);
  const streamReaderRef       = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const audioCtxRef           = useRef<AudioContext | null>(null);
  const analyserRef           = useRef<AnalyserNode | null>(null);
  const animFrameRef          = useRef<number | null>(null);
  const micStreamRef          = useRef<MediaStream | null>(null);
  const micAudioCtxRef        = useRef<AudioContext | null>(null);
  const micAnalyserRef        = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef       = useRef<number | null>(null);
  const transcriptEndRef      = useRef<HTMLDivElement>(null);
  const sendCommandRef        = useRef<(cmd: string) => void>(() => {});
  const lastSpeechEndRef      = useRef(0);
  const pendingTextRef        = useRef("");                                  // accumulated speech segments
  const finalTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce timer
  const speechStartRef        = useRef(0); // timestamp when Jarvis started speaking (barge-in guard)
  const personalityRef        = useRef<Personality>({ humor: 50, energy: 50, formality: 50 });
  const messagesRef           = useRef<ChatMessage[]>([]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/jarvis/stats").then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      if (sessionStartRef.current) setSessionElapsed(Date.now() - sessionStartRef.current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Web Audio analyser ─────────────────────────────────────────────────────
  const stopAnalyser = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    analyserRef.current = null;
    setBarHeights([6, 22, 10, 40, 14, 30, 8, 44, 12, 26, 7]);
  }, []);

  const stopMicAnalyser = useCallback(() => {
    if (micAnimFrameRef.current) { cancelAnimationFrame(micAnimFrameRef.current); micAnimFrameRef.current = null; }
    micAnalyserRef.current = null;
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    setMicFreqData(Array(26).fill(4));
  }, []);

  const startMicAnalyser = useCallback(async () => {
    if (micStreamRef.current) return; // already running
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      if (!micAudioCtxRef.current || micAudioCtxRef.current.state === "closed") {
        micAudioCtxRef.current = new AudioContext();
      }
      const ctx = micAudioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      ctx.createMediaStreamSource(stream).connect(analyser); // don't connect to destination — no echo
      micAnalyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!micAnalyserRef.current) return;
        analyser.getByteFrequencyData(data);
        setMicFreqData(Array.from({ length: 26 }, (_, i) => {
          const bin = Math.floor((i / 26) * data.length);
          return Math.max(2, Math.min(38, (data[bin] / 255) * 38));
        }));
        micAnimFrameRef.current = requestAnimationFrame(tick);
      };
      micAnimFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // mic permission denied or unavailable — fall back to animated bars
    }
  }, []);

  const startAnalyser = useCallback((audioEl: HTMLAudioElement) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const heights = Array.from({ length: 11 }, (_, i) => {
          const bin = Math.floor((i / 11) * data.length);
          return Math.max(3, Math.min(52, (data[bin] / 255) * 52));
        });
        setBarHeights(heights);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);
    } catch {
      // Web Audio API unavailable — animated bars will be used instead
    }
  }, []);

  // ── Stop audio ─────────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    speakingRef.current = false;
    stopAnalyser();
    streamReaderRef.current?.cancel().catch(() => {});
    streamReaderRef.current = null;
    if (mediaSourceRef.current?.readyState === "open") { try { mediaSourceRef.current.endOfStream(); } catch {} }
    mediaSourceRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
  }, [stopAnalyser]);

  // ── Streaming audio ────────────────────────────────────────────────────────
  const playStreamingAudio = useCallback(async (response: Response, onEnd: () => void) => {
    if (!response.body) { onEnd(); return; }
    // Cancel any pending debounced command — Jarvis is about to respond
    if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
    pendingTextRef.current = "";

    const canMSE = typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

    if (!canMSE) {
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      speakingRef.current = true;
      speechStartRef.current = Date.now();
      startAnalyser(audio);
      audio.onended = () => { speakingRef.current = false; lastSpeechEndRef.current = Date.now(); stopAnalyser(); URL.revokeObjectURL(url); audioRef.current = null; onEnd(); };
      audio.play().catch(onEnd);
      return;
    }

    const ms  = new MediaSource();
    mediaSourceRef.current = ms;
    const url  = URL.createObjectURL(ms);
    const audio = new Audio(url);
    audioRef.current = audio;
    speakingRef.current = true;
    speechStartRef.current = Date.now();

    const cleanup = () => { speakingRef.current = false; lastSpeechEndRef.current = Date.now(); stopAnalyser(); URL.revokeObjectURL(url); audioRef.current = null; mediaSourceRef.current = null; onEnd(); };
    audio.onended = cleanup;
    audio.onerror = cleanup;

    await new Promise<void>(r => ms.addEventListener("sourceopen", () => r(), { once: true }));

    let sb: SourceBuffer;
    try { sb = ms.addSourceBuffer("audio/mpeg"); }
    catch { cleanup(); return; }

    startAnalyser(audio);
    audio.play().catch(() => {});

    const reader = response.body.getReader();
    streamReaderRef.current = reader;
    const waitUpdate = () => new Promise<void>(r => sb.addEventListener("updateend", () => r(), { once: true }));

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamReaderRef.current = null;
          if (sb.updating) await waitUpdate();
          if (ms.readyState === "open") ms.endOfStream();
          break;
        }
        if (sb.updating) await waitUpdate();
        if (ms.readyState === "open") sb.appendBuffer(value);
      }
    } catch {
      // Stream error — ensure cleanup fires so state resets and recognition restarts
      streamReaderRef.current = null;
      if (speakingRef.current) cleanup();
    }
  }, [startAnalyser, stopAnalyser]);

  // ── Speech recognition — continuous:true, barge-in support ────────────────
  const startRecognition = useCallback(() => {
    if (recognitionRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang            = "en-US";
    rec.continuous      = true;
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      const result = e.results[e.resultIndex];
      if (!result?.isFinal) return;
      const text: string = result[0].transcript.trim();
      if (!text) return;
      // Post-speech echo guard: ignore mic for 2.5s after Jarvis finishes speaking
      if (Date.now() - lastSpeechEndRef.current < 2500) return;
      // No voice barge-in during speaking — use the INTERRUPT button instead
      if (speakingRef.current) return;
      if (processingRef.current) return;

      // Semantic echo detection
      const normalizedInput = text.toLowerCase().replace(/[.,!?'"]/g, "").trim();
      const recentJarvis = messagesRef.current.filter(m => m.role === "jarvis").slice(-3);
      const isEcho = recentJarvis.some(m => {
        const jarvisStart = m.text.toLowerCase().replace(/[.,!?'"]/g, "").trim().slice(0, 50);
        return jarvisStart.length > 15 && (
          normalizedInput.startsWith(jarvisStart.slice(0, 30)) ||
          jarvisStart.startsWith(normalizedInput.slice(0, 30))
        );
      });
      if (isEcho) return;

      // Debounce + accumulate: the Web Speech API fires isFinal after any brief pause,
      // even mid-sentence. Accumulate segments and wait 750ms for the speaker to finish
      // before dispatching the command. This prevents "my name is" being sent before
      // Kenny says "Kenny Garcia".
      pendingTextRef.current = pendingTextRef.current
        ? `${pendingTextRef.current} ${text}`
        : text;
      if (finalTimerRef.current) clearTimeout(finalTimerRef.current);
      finalTimerRef.current = setTimeout(() => {
        finalTimerRef.current = null;
        const captured = pendingTextRef.current.trim();
        pendingTextRef.current = "";
        if (!captured) return;
        const words = captured.split(/\s+/).filter(Boolean).length;
        if (words < 2) return; // still require ≥2 words total
        if (speakingRef.current || processingRef.current) return;
        processingRef.current = true;
        setLastTranscript(captured);
        setCommandCount(c => c + 1);
        sendCommandRef.current(captured);
      }, 750);
    };

    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      recognitionRef.current = null;
      // Don't restart while Jarvis is speaking — playStreamingAudio's onEnd callback handles that
      if (!speakingRef.current && !processingRef.current && conversationActiveRef.current) {
        setTimeout(() => { if (!speakingRef.current && !processingRef.current && conversationActiveRef.current) startRecognition(); }, 400);
      } else if (!conversationActiveRef.current) {
        setState("idle");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      // Don't restart while Jarvis is speaking — visual state would flip to "listening" prematurely
      if (!speakingRef.current && !processingRef.current && conversationActiveRef.current) {
        setTimeout(() => { if (!speakingRef.current && !processingRef.current && conversationActiveRef.current) startRecognition(); }, 200);
      }
    };

    // Only update visual state if Jarvis isn't currently speaking
    if (!speakingRef.current) setState("listening");
    try { rec.start(); }
    catch { recognitionRef.current = null; setTimeout(() => { if (!processingRef.current && conversationActiveRef.current) startRecognition(); }, 600); }
  }, [stopAudio]);

  // ── sendCommand ────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (command: string) => {
    const t0 = Date.now();
    processingRef.current = true;
    setState("processing");
    setMessages(prev => [...prev, { role: "user", text: command, ts: new Date() }]);

    try {
      // Use refs so we always get the current values — sendCommand is a stable callback
      // and would otherwise capture stale personality/messages from mount time
      const history = messagesRef.current.slice(-10).map(m => ({
        role: m.role === "jarvis" ? "assistant" : "user",
        content: m.text,
      }));

      const res = await fetch("/api/admin/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, history, personality: personalityRef.current }),
      });

      const latencyMs = Date.now() - t0;
      const contentType = res.headers.get("Content-Type") ?? "";

      // Show which tools Jarvis used
      const toolsHeader = res.headers.get("X-Jarvis-Tools") ?? "";
      if (toolsHeader) setActiveTools(toolsHeader.split(",").filter(Boolean));

      if (contentType.includes("audio")) {
        setElevenlabsOk(true);
        const rawHeader = res.headers.get("X-Jarvis-Text") ?? "";
        const text = rawHeader ? decodeURIComponent(rawHeader) : "";
        if (text) {
          setMessages(prev => [...prev, { role: "jarvis", text, ts: new Date(), latencyMs }]);
          setLatencies(prev => [...prev, latencyMs]);
        }
        setState("speaking");

        await playStreamingAudio(res, () => {
          processingRef.current = false;
          setActiveTools([]);
          if (conversationActiveRef.current) {
            setState("listening");
            if (!recognitionRef.current) setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 300);
          } else {
            setState("idle");
          }
        });
      } else {
        const data = await res.json();
        const text: string = data.text ?? "";
        if (text) {
          setMessages(prev => [...prev, { role: "jarvis", text, ts: new Date(), latencyMs }]);
          setLatencies(prev => [...prev, latencyMs]);
        }
        processingRef.current = false;
        if (conversationActiveRef.current) {
          setState("listening");
          if (!recognitionRef.current) setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 300);
        } else {
          setState("idle");
        }
      }
    } catch {
      processingRef.current = false;
      if (conversationActiveRef.current) {
        setState("listening");
        if (!recognitionRef.current) setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 600);
      } else {
        setState("idle");
      }
    }
  }, [startRecognition, playStreamingAudio]);

  useEffect(() => { sendCommandRef.current = sendCommand; }, [sendCommand]);
  useEffect(() => { personalityRef.current = personality; }, [personality]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Fetch past sessions whenever the LOG tab opens
  useEffect(() => {
    if (viewMode !== "history") return;
    setSessionsLoading(true);
    fetch("/api/admin/jarvis/sessions")
      .then(r => r.json())
      .then(data => { setPastSessions(data.sessions ?? []); setSessionsLoading(false); })
      .catch(() => setSessionsLoading(false));
  }, [viewMode]);

  // ── Session toggle ─────────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (conversationActiveRef.current) {
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        const durationMs = sessionStartRef.current ? Date.now() - sessionStartRef.current : null;
        fetch("/api/admin/jarvis/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs.map(m => ({ role: m.role, text: m.text, ts: m.ts.toISOString() })),
            commandCount: msgs.filter(m => m.role === "user").length,
            durationMs,
          }),
        })
          .then(r => {
            setSaveFeedback(r.ok ? "saved" : "error");
            setTimeout(() => setSaveFeedback(""), 3000);
            if (r.ok) {
              fetch("/api/admin/jarvis/sessions")
                .then(res => res.json())
                .then(data => setPastSessions(data.sessions ?? []))
                .catch(() => {});
            }
          })
          .catch(() => { setSaveFeedback("error"); setTimeout(() => setSaveFeedback(""), 3000); });
      }
      if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
      pendingTextRef.current = "";
      conversationActiveRef.current = false;
      processingRef.current = false;
      speakingRef.current = false;
      setSessionActive(false);
      setMuted(false);
      sessionStartRef.current = null;
      setSessionElapsed(0);
      setCommandCount(0);
      setLatencies([]);
      setMessages([]);
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
      stopAudio();
      stopMicAnalyser();
      setState("idle");
    } else {
      conversationActiveRef.current = true;
      processingRef.current = false;
      setSessionActive(true);
      setMuted(false);
      sessionStartRef.current = Date.now();
      setCommandCount(0);
      setLatencies([]);
      setMessages([]);
      startMicAnalyser();
      startRecognition();
    }
  }, [startRecognition, stopAudio, startMicAnalyser, stopMicAnalyser]);

  // ── Interrupt ──────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => {
    if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
    pendingTextRef.current = "";
    processingRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
    stopAudio();
    if (conversationActiveRef.current) {
      setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 150);
    } else {
      setState("idle");
    }
  }, [startRecognition, stopAudio]);

  // ── Mute / Unmute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      startMicAnalyser();
      startRecognition();
    } else {
      setMuted(true);
      stopMicAnalyser();
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
      if (finalTimerRef.current) { clearTimeout(finalTimerRef.current); finalTimerRef.current = null; }
      pendingTextRef.current = "";
      if (!speakingRef.current) setState("idle");
    }
  }, [muted, startRecognition, startMicAnalyser, stopMicAnalyser]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const c = { idle: "#d4a853", listening: "#3b82f6", processing: "#8b5cf6", speaking: "#10b981" }[state];
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length / 100) / 10
    : null;
  const convRate = stats ? Math.round((stats.paid / Math.max(stats.totalUsers, 1)) * 100) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full overflow-hidden text-white select-none transition-all duration-1000 bg-black"
      style={{ background: sessionActive ? `radial-gradient(ellipse at 50% 38%, ${c}09 0%, #000 56%)` : "black" }}
    >
      {/* Hex grid */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ opacity: 0.055, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3Cpolygon points='30,62 58,77 58,107 30,122 2,107 2,77' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: "60px 104px" }} />

      {/* Scanlines */}
      <motion.div className="pointer-events-none absolute left-0 right-0 z-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}22, transparent)` }} animate={{ top: ["0%", "100%"] }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
      <motion.div className="pointer-events-none absolute left-0 right-0 z-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}0e, transparent)` }} animate={{ top: ["100%", "0%"] }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 28%, rgba(0,0,0,0.78) 100%)" }} />

      {/* Corner brackets */}
      {["top-4 left-4 border-t-2 border-l-2", "top-4 right-4 border-t-2 border-r-2", "bottom-4 left-4 border-b-2 border-l-2", "bottom-4 right-4 border-b-2 border-r-2"].map((cls, i) => (
        <motion.div key={i} className={`absolute ${cls} pointer-events-none z-50 h-10 w-10`} style={{ borderColor: `${c}35` }} animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.6 }} />
      ))}

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center px-6 py-3 transition-colors duration-700" style={{ borderBottom: `1px solid ${sessionActive ? c + "25" : "rgba(255,255,255,0.05)"}` }}>
        <div className="flex items-center gap-4 w-64 shrink-0">
          <Link href="/admin" className="flex items-center gap-1.5 text-[9px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">
            <ArrowLeft className="h-3 w-3" /> ADMIN
          </Link>
          <span className="text-zinc-800">|</span>
          <div className="flex items-center gap-1.5">
            <motion.div className="h-1 w-1 rounded-full bg-emerald-500" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }} />
            <span className="text-[7px] tracking-[0.4em] text-zinc-700">ONLINE</span>
          </div>
        </div>

        <div className="flex-1 text-center">
          <p className="text-lg font-bold tracking-[1em] text-white">J A R V I S</p>
          <p className="text-[6px] tracking-[0.6em] text-zinc-800 mt-0.5">CINEFLOW INTELLIGENCE SYSTEM</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 justify-end">
          {/* Live stats ticker */}
          {stats && (
            <div className="hidden lg:flex items-center gap-3 overflow-hidden max-w-[220px]">
              {[
                { label: "USR", val: stats.totalUsers, color: "#e2e8f0" },
                { label: "MRR", val: `$${stats.mrr}`,  color: "#d4a853" },
                { label: "ACT", val: stats.activeLastWeek, color: "#10b981" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-[5px] tracking-widest" style={{ color: `${color}50` }}>{label}</span>
                  <span className="text-[8px] font-mono font-bold" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-0.5 rounded border border-white/[0.06] p-0.5">
            {([
              { id: "voice" as ViewMode, Icon: Mic, label: "VOICE" },
              { id: "data"  as ViewMode, Icon: BarChart3, label: "DATA" },
              { id: "history" as ViewMode, Icon: Clock, label: "LOG" },
            ]).map(({ id, Icon, label }) => (
              <button key={id} onClick={() => setViewMode(id)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-[7px] tracking-widest font-medium transition-all ${viewMode === id ? "bg-[#d4a853]/15 text-[#d4a853]" : "text-zinc-700 hover:text-zinc-500"}`}>
                <Icon className="h-2 w-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Personality panel toggle */}
          <div className="relative">
            <button onClick={() => setShowPersonality(v => !v)}
              className="p-1.5 rounded border transition-colors"
              style={{ borderColor: showPersonality ? `${c}50` : "rgba(255,255,255,0.06)", color: showPersonality ? c : "#52525b" }}
              title="Personality dials">
              <SlidersHorizontal className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showPersonality && (
                <PersonalityPanel value={personality} onChange={setPersonality} c="#d4a853" />
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setIsCompact(v => !v)} title={isCompact ? "Show command log" : "Hide command log"}
            className={`p-1.5 rounded border transition-colors ${isCompact ? "border-white/[0.12] text-zinc-400" : "border-white/[0.06] text-zinc-700 hover:text-zinc-400 hover:border-white/[0.12]"}`}>
            <Minus className="h-3 w-3" />
          </button>

          <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-1.5 rounded border border-white/[0.06] text-zinc-700 hover:text-zinc-400 hover:border-white/[0.12] transition-colors">
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>

          <AnimatePresence>
            {saveFeedback && (
              <motion.div key={saveFeedback} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-[7px] tracking-widest font-mono px-2 py-1 rounded"
                style={{ color: saveFeedback === "saved" ? "#10b981" : "#ef4444", border: `1px solid ${saveFeedback === "saved" ? "#10b98130" : "#ef444430"}`, background: saveFeedback === "saved" ? "#10b98108" : "#ef444408" }}>
                {saveFeedback === "saved" ? "SESSION SAVED" : "SAVE FAILED"}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <motion.div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} animate={{ opacity: state === "idle" ? [0.3, 1, 0.3] : 1, scale: state === "listening" ? [1, 1.4, 1] : 1 }} transition={{ duration: 1.5, repeat: Infinity }} />
            <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[8px] tracking-[0.35em] font-medium" style={{ color: c }}>
              {state.toUpperCase()}
            </motion.span>
          </div>

          <div className="text-right">
            <p className="text-sm font-mono font-bold text-white tabular-nums tracking-wider">{clock}</p>
            <p className="text-[6px] tracking-widest text-zinc-700">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className="flex h-full w-full pt-[58px] pb-[62px]">
        <AnimatePresence mode="wait">
          {viewMode === "voice" ? (
            <motion.div key="voice" className="relative flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Left metrics — HUD panel; floats as overlay in compact so orb can center in full viewport */}
              <div className={`${isCompact ? "absolute left-0 top-0 bottom-0 z-10 w-56" : "w-56 shrink-0"} flex flex-col p-4 gap-1.5 overflow-hidden`} style={{ borderRight: `1px solid ${sessionActive ? c + "20" : "rgba(255,255,255,0.05)"}`, background: isCompact ? "rgba(0,0,0,0.85)" : "transparent" }}>
                {/* Panel scan line */}
                <motion.div className="pointer-events-none absolute left-0 w-56 h-px z-10" style={{ background: `linear-gradient(90deg, transparent, ${c}30, transparent)` }} animate={{ top: ["8%", "92%"] }} transition={{ duration: 6, repeat: Infinity, ease: "linear", repeatType: "reverse" }} />

                <div className="flex items-center justify-between mb-1">
                  <p className="text-[6px] tracking-[0.6em] text-zinc-700">LIVE METRICS</p>
                  <motion.div className="text-[5px] font-mono tracking-wider" style={{ color: `${c}50` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, repeat: Infinity }}>◈ LIVE</motion.div>
                </div>

                {[
                  { label: "TOTAL USERS",   val: stats?.totalUsers ?? null,     n: stats?.totalUsers ?? 0,     color: "#e2e8f0", prefix: "" },
                  { label: "MRR",           val: stats?.mrr ?? null,            n: stats?.mrr ?? 0,            color: "#d4a853", prefix: "$" },
                  { label: "ARR",           val: stats?.arr ?? null,            n: stats?.arr ?? 0,            color: "#d4a853", prefix: "$" },
                  { label: "PAID",          val: stats?.paid ?? null,           n: stats?.paid ?? 0,           color: "#10b981", prefix: "" },
                  { label: "CONVERSION",    val: convRate,                      n: convRate ?? 0,              color: "#d4a853", prefix: "", suffix: "%" },
                  { label: "SIGNUPS TODAY", val: stats?.signupsToday ?? null,   n: stats?.signupsToday ?? 0,   color: "#3b82f6", prefix: "" },
                  { label: "ACTIVE / 7D",   val: stats?.activeLastWeek ?? null, n: stats?.activeLastWeek ?? 0, color: "#10b981", prefix: "" },
                ].map(({ label, val, n, color, prefix, suffix }, idx) => (
                  <div key={label} className="relative px-3 py-1.5 overflow-hidden" style={{ border: `1px solid ${color}20`, background: `linear-gradient(135deg, ${color}08 0%, transparent 100%)` }}>
                    {/* Chamfer corner */}
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 pointer-events-none" style={{ background: `linear-gradient(225deg, ${color}25 50%, transparent 50%)` }} />
                    <p className="text-[5px] tracking-[0.45em] mb-0.5" style={{ color: `${color}55` }}>{label}</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-base font-black font-mono leading-none tabular-nums" style={{ color, textShadow: `0 0 14px ${color}70` }}>
                        {val !== null ? <CountUp to={n} prefix={prefix} suffix={suffix ?? ""} /> : "···"}
                      </p>
                      {/* Mini bar */}
                      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
                    </div>
                    {idx % 3 === 0 && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${color}06, transparent)` }} animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.4, ease: "linear" }} />}
                  </div>
                ))}

                <div className="mt-auto pt-2 border-t border-white/[0.04] space-y-1.5">
                  <p className="text-[5px] tracking-[0.5em] text-zinc-800 mb-1">NETWORK NODES</p>
                  {[
                    { label: "SUPABASE",   on: true,         dur: 2.3, color: "#10b981", node: "DB" },
                    { label: "ANTHROPIC",  on: true,         dur: 3.1, color: "#8b5cf6", node: "AI" },
                    { label: "ELEVENLABS", on: elevenlabsOk, dur: 2.7, color: "#3b82f6", node: "TTS" },
                  ].map(({ label, on, dur, color, node }) => (
                    <div key={label} className="flex items-center gap-1.5 px-1">
                      <motion.div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: on ? color : "#27272a", boxShadow: on ? `0 0 5px ${color}` : "none" }} animate={on ? { opacity: [0.4, 1, 0.4] } : {}} transition={{ duration: dur, repeat: Infinity }} />
                      <span className="text-[6px] tracking-widest text-zinc-700 flex-1">{label}</span>
                      <span className="text-[5px] font-mono px-1 rounded" style={{ color: on ? color : "#3f3f46", border: `1px solid ${on ? color + "30" : "transparent"}` }}>{on ? node : "OFF"}</span>
                    </div>
                  ))}
                  <div className="mt-3 pt-2 border-t border-white/[0.03]">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[5px] tracking-[0.5em] text-zinc-800">SYS TELEMETRY</p>
                      <motion.span className="text-[5px] font-mono" style={{ color: `${c}35` }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.9, repeat: Infinity }}>▶ LIVE</motion.span>
                    </div>
                    <SystemTicker c={c} />
                  </div>
                </div>
              </div>

              {/* Center orb — absolute inset in compact so it spans full viewport width */}
              <div className={`${isCompact ? "absolute inset-0" : "relative flex-1"} flex flex-col items-center justify-center`}>
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
                  {/* Center-area corner HUDs */}
                  <div className="absolute top-3 left-3" style={{ borderLeft: `1px solid ${c}18`, borderTop: `1px solid ${c}18`, paddingLeft: 7, paddingTop: 5, width: 145 }}>
                    <p className="text-[5px] tracking-[0.5em] mb-1" style={{ color: `${c}35`, fontFamily: "monospace" }}>SYS.CORE</p>
                    <p className="text-[7px] font-mono mb-0.5" style={{ color: `${c}65` }}>J4RV1S-ALPHA</p>
                    <p className="text-[5px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>claude-sonnet-4-6</p>
                    <p className="text-[5px] font-mono" style={{ color: "rgba(255,255,255,0.08)" }}>VERCEL · NEXT.JS 15</p>
                  </div>
                  <div className="absolute top-3 right-3 flex flex-col items-end" style={{ borderRight: `1px solid ${c}18`, borderTop: `1px solid ${c}18`, paddingRight: 7, paddingTop: 5, width: 145 }}>
                    <p className="text-[5px] tracking-[0.5em] mb-1" style={{ color: `${c}35`, fontFamily: "monospace" }}>NETWORK</p>
                    <p className="text-[6px] font-mono" style={{ color: "#10b981" }}>◈ SUPABASE.DB</p>
                    <p className="text-[6px] font-mono" style={{ color: "#8b5cf6" }}>◈ ANTHROPIC.AI</p>
                    <p className="text-[6px] font-mono" style={{ color: elevenlabsOk ? "#3b82f6" : "#52525b" }}>{elevenlabsOk ? "◈" : "○"} ELEVENLABS.TTS</p>
                  </div>
                  <div className="absolute bottom-14 left-3" style={{ borderLeft: `1px solid ${c}18`, borderBottom: `1px solid ${c}18`, paddingLeft: 7, paddingBottom: 5, width: 145 }}>
                    <p className="text-[5px] tracking-[0.5em] mb-1" style={{ color: `${c}35`, fontFamily: "monospace" }}>SESSION</p>
                    <p className="text-[8px] font-bold font-mono" style={{ color: c }}>{sessionActive ? fmtDuration(sessionElapsed) : "--:--:--"}</p>
                    <p className="text-[5px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>CMD #{String(commandCount).padStart(3,"0")} · {state.toUpperCase()}</p>
                  </div>
                  <div className="absolute bottom-14 right-3 flex flex-col items-end" style={{ borderRight: `1px solid ${c}18`, borderBottom: `1px solid ${c}18`, paddingRight: 7, paddingBottom: 5, width: 145 }}>
                    <p className="text-[5px] tracking-[0.5em] mb-1" style={{ color: `${c}35`, fontFamily: "monospace" }}>PERFORMANCE</p>
                    <p className="text-[8px] font-bold font-mono" style={{ color: "#10b981" }}>{avgLatency !== null ? `${avgLatency}s` : "---"}</p>
                    <p className="text-[5px] font-mono" style={{ color: "rgba(255,255,255,0.15)" }}>AVG LATENCY · LIVE</p>
                  </div>
                </div>

                {/* Signal spectrum above orb — driven by real mic FFT when session active */}
                <div className="mb-2 flex flex-col items-center gap-1.5 pointer-events-none">
                  <p className="text-[5px] tracking-[0.6em]" style={{ color: `${c}25` }}>MIC · INPUT</p>
                  <FrequencyBars c={c} active={sessionActive} heights={sessionActive && !muted ? micFreqData : undefined} />
                </div>

                <div className="relative flex items-center justify-center">
                  {/* Ambient glow */}
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${c}0a 0%, transparent 68%)` }}
                    animate={{ width: state === "listening" ? 560 : state === "speaking" ? 530 : 460, height: state === "listening" ? 560 : state === "speaking" ? 530 : 460 }} transition={{ duration: 0.7 }} />

                  {/* Radar sweep */}
                  <RadarSweep c={c} active={sessionActive} r={250} />

                  {/* Outer tick ring */}
                  <TickRing radius={220} count={72} c={c} />

                  {/* Outer static ring */}
                  <div className="absolute rounded-full pointer-events-none" style={{ width: 440, height: 440, border: `1px solid ${c}08` }} />

                  {/* Second tick ring */}
                  <TickRing radius={170} count={36} c={c} />

                  {/* Listening / speaking ripples */}
                  <AnimatePresence>
                    {state === "listening" && [0, 0.8, 1.6].map((delay, i) => (
                      <motion.div key={`l${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}45` }}
                        animate={{ width: [150, 460], height: [150, 460], opacity: [0, 0.72, 0] }}
                        transition={{ duration: 2.6, delay, repeat: Infinity, ease: "easeOut", times: [0, 0.08, 1] }} />
                    ))}
                    {state === "speaking" && [0, 0.5, 1.0].map((delay, i) => (
                      <motion.div key={`s${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}38` }}
                        animate={{ width: [165, 430], height: [165, 430], opacity: [0, 0.82, 0] }}
                        transition={{ duration: 1.7, delay, repeat: Infinity, ease: "easeOut", times: [0, 0.08, 1] }} />
                    ))}
                    {state === "processing" && (
                      <>
                        <motion.div key="proc1" className="absolute rounded-full border-2 pointer-events-none" style={{ width: 230, height: 230, borderColor: `${c}50`, borderTopColor: "transparent", borderRightColor: "transparent" }} animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />
                        <motion.div key="proc2" className="absolute rounded-full border pointer-events-none" style={{ width: 260, height: 260, borderColor: `${c}20`, borderBottomColor: "transparent", borderLeftColor: "transparent" }} animate={{ rotate: -360 }} transition={{ duration: 3.8, repeat: Infinity, ease: "linear" }} />
                      </>
                    )}
                  </AnimatePresence>

                  {/* Large slow outer rings */}
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 540, height: 540, border: `1px solid ${c}05` }} animate={{ rotate: 360 }} transition={{ duration: 80, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 500, height: 500, border: `0.5px dashed ${c}06` }} animate={{ rotate: -360 }} transition={{ duration: 55, repeat: Infinity, ease: "linear" }} />
                  {/* Degree markers */}
                  {[0, 90, 180, 270].map(angle => {
                    const rad = (angle - 90) * Math.PI / 180;
                    const dist = 274;
                    return (
                      <div key={angle} className="absolute pointer-events-none" style={{ left: "50%", top: "50%", transform: `translate(calc(-50% + ${Math.cos(rad) * dist}px), calc(-50% + ${Math.sin(rad) * dist}px))` }}>
                        <p className="text-[5px] font-mono text-center" style={{ color: `${c}20` }}>{["000°","090°","180°","270°"][angle/90]}</p>
                      </div>
                    );
                  })}
                  {/* Rotating arcs */}
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 270, height: 270, border: `1px dashed ${c}20` }} animate={{ rotate: [0, 360] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ width: 218, height: 218, borderColor: `${c}30`, borderTopColor: "transparent", borderLeftColor: "transparent" }} animate={{ rotate: [360, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 182, height: 182, border: `1px dashed ${c}14` }} animate={{ rotate: [0, -360] }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} />
                  {/* Fast inner arc */}
                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ width: 168, height: 168, borderColor: `${c}22`, borderRightColor: "transparent", borderBottomColor: "transparent" }} animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />

                  {/* Orbiting data nodes */}
                  <OrbitingNodes stats={stats} c={c} sessionActive={sessionActive} />

                  {/* Glowing border ring — always breathes */}
                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}60` }}
                    animate={{ width: sessionActive ? 192 : 168, height: sessionActive ? 192 : 168, boxShadow: sessionActive ? [`0 0 16px ${c}35`, `0 0 50px ${c}65`, `0 0 16px ${c}35`] : [`0 0 8px ${c}15`, `0 0 26px ${c}35`, `0 0 8px ${c}15`] }}
                    transition={{ width: { duration: 0.4 }, height: { duration: 0.4 }, boxShadow: { duration: sessionActive ? 1.8 : 3.5, repeat: Infinity } }} />

                  {/* Core sphere — breathes in idle too */}
                  <motion.div className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
                    animate={{ width: sessionActive ? 170 : 148, height: sessionActive ? 170 : 148, scale: state === "idle" ? [1, 1.03, 1] : 1 }}
                    transition={{ width: { duration: 0.4 }, height: { duration: 0.4 }, scale: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
                    style={{ background: `radial-gradient(circle at 36% 28%, ${c}50 0%, ${c}16 48%, transparent 75%)`, boxShadow: `inset 0 0 50px ${c}18, 0 0 70px ${c}35, 0 0 130px ${c}12` }}>
                    <motion.div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, ${c}35, transparent)`, opacity: 0.4 }} animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="relative z-10 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 28px ${c}, 0 0 60px ${c}90` }}
                      animate={{ width: state === "speaking" ? 36 : state === "listening" ? 22 : sessionActive ? 15 : 10, height: state === "speaking" ? 36 : state === "listening" ? 22 : sessionActive ? 15 : 10, opacity: state === "idle" && !sessionActive ? [0.25, 0.55, 0.25] : 1 }} transition={{ duration: state === "idle" ? 3.5 : 0.2, repeat: state === "idle" ? Infinity : 0 }} />
                  </motion.div>
                </div>

                {/* Perspective grid floor */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none overflow-hidden" style={{ width: 900, height: 220 }}>
                  <div style={{ perspective: "320px", width: "100%", height: "100%" }}>
                    <motion.div style={{ width: "100%", height: "220%", transformOrigin: "top center", transform: "rotateX(64deg)",
                      backgroundImage: `linear-gradient(${c}12 1px, transparent 1px), linear-gradient(90deg, ${c}12 1px, transparent 1px)`,
                      backgroundSize: "80px 80px" }}
                      animate={{ backgroundPosition: ["0px 0px", "0px 80px"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
                  </div>
                  {/* Fade mask at top */}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, black 0%, transparent 40%)" }} />
                </div>

                <div className="mt-8 flex flex-col items-center gap-2.5">
                  <div className="flex items-center justify-center">
                    <WaveformBars active={state === "speaking"} listening={state === "listening"} color={c} audioHeights={state === "speaking" ? barHeights : undefined} />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.p key={`${state}-${sessionActive}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                      className="text-[9px] font-semibold tracking-[0.6em]" style={{ color: c }}>
                      {!sessionActive                          && "STANDBY"}
                      {sessionActive && state === "idle"       && "READY · · ·"}
                      {state === "listening"                   && "LISTENING · · ·"}
                      {state === "processing"                  && "PROCESSING REQUEST"}
                      {state === "speaking"                    && "JARVIS SPEAKING"}
                    </motion.p>
                  </AnimatePresence>

                  {/* Tool indicator — shows which Jarvis tool is running */}
                  <AnimatePresence>
                    {state === "processing" && activeTools.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded" style={{ border: `1px solid ${c}20`, background: `${c}06` }}>
                        <motion.div className="h-1 w-1 rounded-full" style={{ backgroundColor: c }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.6, repeat: Infinity }} />
                        <span className="text-[6px] font-mono tracking-widest" style={{ color: `${c}80` }}>
                          ↗ {activeTools[0].replace(/_/g, " ").toUpperCase()}
                        </span>
                      </motion.div>
                    )}
                    {lastTranscript && (state === "processing" || state === "speaking") && activeTools.length === 0 && (
                      <motion.p key="transcript" initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }} className="text-[9px] font-mono text-zinc-500 max-w-xs text-center">
                        &ldquo;{lastTranscript}&rdquo;
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <HudReadout commandCount={commandCount} sessionElapsed={sessionElapsed} state={state} c={c} sessionActive={sessionActive} />
                </div>
              </div>

              {/* Right command log */}
              <div className={`w-72 shrink-0 flex flex-col p-4 ${isCompact ? "hidden" : ""}`} style={{ borderLeft: `1px solid ${sessionActive ? c + "18" : "rgba(255,255,255,0.05)"}` }}>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/[0.04]">
                  <p className="text-[6px] tracking-[0.5em] text-zinc-700">COMMAND LOG</p>
                  {sessionActive && (
                    <div className="flex items-center gap-3">
                      {[
                        { label: "SESSION", val: fmtDuration(sessionElapsed) },
                        { label: "CMDS",    val: String(commandCount) },
                        ...(avgLatency !== null ? [{ label: "AVG", val: `${avgLatency}s` }] : []),
                      ].map(({ label, val }) => (
                        <div key={label} className="text-right">
                          <p className="text-[9px] font-mono font-bold text-white tabular-nums">{val}</p>
                          <p className="text-[6px] tracking-widest text-zinc-700">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-text">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                      <div className="h-10 w-10 rounded-full border border-[#d4a853]/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-[#d4a853]/15" />
                      </div>
                      <div>
                        <p className="text-[7px] tracking-[0.5em] text-zinc-700 mb-4">START A SESSION TO BEGIN</p>
                        {['"Brief me on current status"', '"What should I focus on?"', '"How many users do we have?"', '"What\'s our MRR?"', '"Send a broadcast"'].map(ex => (
                          <p key={ex} className="text-[8px] font-mono text-zinc-800 mb-1.5 text-left">{ex}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: msg.role === "user" ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[6px] tracking-widest ${msg.role === "user" ? "text-zinc-700" : "text-[#d4a853]/50"}`}>
                            {msg.role === "user" ? "KENNY" : "JARVIS"}{" · "}{msg.ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                          </p>
                          {msg.role === "jarvis" && msg.latencyMs && <span className="text-[6px] font-mono text-zinc-800">{(msg.latencyMs / 1000).toFixed(1)}s</span>}
                        </div>
                        <div className="rounded-lg p-2.5 text-[11px] leading-relaxed"
                          style={msg.role === "jarvis"
                            ? { backgroundColor: `${c}06`, border: `1px solid ${c}18`, color: "#d4d4d8" }
                            : { backgroundColor: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", color: "#71717a" }}>
                          {msg.role === "jarvis" && i === messages.length - 1 ? <TypewriterText text={msg.text} /> : msg.text}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </motion.div>

          ) : viewMode === "data" ? (
            <motion.div key="data" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DataModeView stats={stats} messages={messages} sessionActive={sessionActive} commandCount={commandCount} sessionElapsed={sessionElapsed} avgLatency={avgLatency} state={state} c={c} elevenlabsOk={elevenlabsOk} />
            </motion.div>
          ) : (
            <motion.div key="history" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <HistoryModeView sessions={pastSessions} loading={sessionsLoading} onDelete={id => setPastSessions(prev => prev.filter(s => s.id !== id))} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 px-6 py-3 transition-colors duration-700"
        style={{ borderTop: `1px solid ${sessionActive ? c + "20" : "rgba(255,255,255,0.05)"}` }}>
        {sessionActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute left-6 flex items-center gap-5">
            {[
              { label: "SESSION",  val: fmtDuration(sessionElapsed), col: c },
              { label: "COMMANDS", val: String(commandCount),         col: "#e2e8f0" },
              ...(avgLatency !== null ? [{ label: "AVG LATENCY", val: `${avgLatency}s`, col: "#10b981" }] : []),
            ].map(({ label, val, col }) => (
              <div key={label}>
                <p className="text-[6px] tracking-widest text-zinc-700">{label}</p>
                <p className="text-xs font-mono font-bold tabular-nums" style={{ color: col }}>{val}</p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.button
          onClick={
            state === "speaking" ? interrupt :
            sessionActive && (state === "listening" || muted) ? toggleMute :
            !sessionActive ? toggleSession :
            () => {}
          }
          className="flex items-center gap-2.5 rounded-full px-8 py-2.5 text-[10px] font-bold tracking-[0.35em] transition-all"
          style={{ backgroundColor: `${c}12`, border: `1px solid ${c}${sessionActive ? "60" : "30"}`, color: muted ? "#ef4444" : c, boxShadow: sessionActive ? `0 0 28px ${c}18, inset 0 0 8px ${c}08` : "none" }}
          whileTap={{ scale: 0.97 }}>
          <AnimatePresence mode="wait">
            {!sessionActive                                       && <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><Mic className="h-3.5 w-3.5" /></motion.span>}
            {sessionActive && muted                               && <motion.span key="muted" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><MicOff className="h-3.5 w-3.5" /></motion.span>}
            {sessionActive && !muted && state === "listening"     && <motion.div key="pulse" className="h-3 w-3 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />}
            {sessionActive && !muted && state === "processing"    && <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}><div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" /></motion.div>}
            {sessionActive && !muted && state === "speaking"      && <motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }}><Square className="h-3 w-3 fill-current" /></motion.span>}
            {sessionActive && !muted && state === "idle"          && <motion.div key="breathe" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />}
          </AnimatePresence>
          {!sessionActive                                     && "START SESSION"}
          {sessionActive && muted                             && "MUTED · CLICK TO UNMUTE"}
          {sessionActive && !muted && state === "listening"   && "LISTENING · CLICK TO MUTE"}
          {sessionActive && !muted && state === "processing"  && "PROCESSING · · ·"}
          {sessionActive && !muted && state === "speaking"    && "INTERRUPT"}
          {sessionActive && !muted && state === "idle"        && "SESSION ACTIVE"}
        </motion.button>

        {sessionActive && (
          <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={toggleMute}
            className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[9px] font-bold tracking-widest border transition-colors"
            style={muted
              ? { color: "#ef4444", borderColor: "#ef444430", background: "#ef444408" }
              : { color: "#52525b", borderColor: "rgba(255,255,255,0.06)", background: "transparent" }}
            title={muted ? "Unmute mic" : "Mute mic"}>
            {muted ? <MicOff className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
            {muted ? "UNMUTE" : "MUTE"}
          </motion.button>
        )}

        {sessionActive && (
          <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={toggleSession}
            className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[9px] font-bold tracking-widest text-zinc-700 border border-white/[0.06] hover:border-white/[0.12] hover:text-zinc-400 transition-colors">
            <Square className="h-2.5 w-2.5" />
            END SESSION
          </motion.button>
        )}
      </div>
    </div>
  );
}
