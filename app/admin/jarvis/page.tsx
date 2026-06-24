"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mic, Square, Activity, BarChart3 } from "lucide-react";

type JarvisState = "idle" | "listening" | "processing" | "speaking";
type ViewMode    = "voice" | "data";

interface ChatMessage {
  role: "user" | "jarvis";
  text: string;
  ts: Date;
  latencyMs?: number;
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

// ── Waveform bars ──────────────────────────────────────────────────────────────

const BAR_PATTERNS = [
  [3, 10, 5, 16, 7, 12, 4],
  [6, 2, 14, 8, 18, 3, 9],
  [10, 16, 4, 12, 6, 18, 8],
  [8, 12, 18, 4, 10, 6, 14],
  [5, 9, 3, 15, 11, 7, 16],
  [9, 5, 12, 7, 3, 15, 8],
  [4, 14, 8, 2, 16, 9, 5],
];
const BAR_DELAYS = [0, 0.1, 0.05, 0.15, 0.08, 0.2, 0.03];

function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 24 }}>
      {BAR_PATTERNS.map((kf, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ backgroundColor: color, width: 2 }}
          animate={active ? { height: kf.map(v => `${v}px`) } : { height: "2px" }}
          transition={
            active
              ? { duration: 0.7, repeat: Infinity, delay: BAR_DELAYS[i], ease: "easeInOut" }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Data Mode View ─────────────────────────────────────────────────────────────

const PLAN_META = [
  { key: "lifetime",   label: "LIFETIME",   color: "#d4a853" },
  { key: "enterprise", label: "ENTERPRISE", color: "#8b5cf6" },
  { key: "agency",     label: "AGENCY",     color: "#3b82f6" },
  { key: "studio",     label: "STUDIO",     color: "#10b981" },
  { key: "solo",       label: "SOLO",       color: "#f59e0b" },
];

function DataModeView({
  stats, messages, sessionActive, commandCount, sessionElapsed, avgLatency, state, c,
}: {
  stats: LiveStats | null;
  messages: ChatMessage[];
  sessionActive: boolean;
  commandCount: number;
  sessionElapsed: number;
  avgLatency: number | null;
  state: JarvisState;
  c: string;
}) {
  const convRate = stats ? Math.round((stats.paid / Math.max(stats.totalUsers, 1)) * 100) : null;

  const funnel = [
    { label: "REGISTERED",  value: stats?.totalUsers ?? 0,     color: "#e2e8f0" },
    { label: "ACTIVE / 7D", value: stats?.activeLastWeek ?? 0, color: "#10b981" },
    { label: "PAID",        value: stats?.paid ?? 0,           color: "#d4a853" },
    { label: "TRIALING",    value: stats?.trialing ?? 0,       color: "#8b5cf6" },
    { label: "EXPIRED",     value: stats?.expired ?? 0,        color: "#ef4444" },
  ];

  const metricTiles = [
    { label: "TOTAL USERS",  value: stats?.totalUsers?.toLocaleString() ?? "···",               sub: "registered",       gold: false },
    { label: "TODAY",        value: stats?.signupsToday?.toString() ?? "·",                     sub: "new signups",      gold: false },
    { label: "THIS WEEK",    value: stats?.signupsWeek?.toString() ?? "···",                    sub: "new signups",      gold: false },
    { label: "ACTIVE / 7D", value: stats?.activeLastWeek?.toLocaleString() ?? "···",            sub: "unique logins",    gold: false },
    { label: "MRR",         value: stats ? `$${stats.mrr.toLocaleString()}` : "···",            sub: "monthly recurring", gold: true },
    { label: "ARR",         value: stats ? `$${stats.arr.toLocaleString()}` : "···",            sub: "annual run rate",   gold: true },
    { label: "CONVERSION",  value: convRate !== null ? `${convRate}%` : "···",                  sub: `${stats?.paid ?? 0} paid accounts`, gold: true },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-3 p-4 overflow-hidden">

      {/* Row 1: metric tiles */}
      <div className="grid grid-cols-7 gap-2 shrink-0">
        {metricTiles.map(({ label, value, sub, gold }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
            className="group rounded-lg border border-white/[0.05] bg-white/[0.01] p-3 hover:border-white/[0.12] hover:bg-white/[0.025] transition-all cursor-default"
          >
            <p className="text-[5px] tracking-[0.5em] text-zinc-700 mb-1.5">{label}</p>
            <p className={`text-xl font-bold font-mono tabular-nums leading-none ${gold ? "text-[#d4a853]" : "text-white"}`}>
              {value}
            </p>
            <p className="text-[5px] text-zinc-800 mt-1.5 tracking-wider">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Row 2: charts */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

        {/* Plan distribution */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-700">PLAN DISTRIBUTION</p>
            <p className="text-[6px] font-mono text-zinc-800">{stats?.totalUsers ?? 0} TOTAL</p>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {PLAN_META.map(({ key, label, color }, i) => {
              const count = stats?.breakdown?.[key] ?? 0;
              const pct   = stats ? (count / Math.max(stats.totalUsers, 1)) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] tracking-widest text-zinc-600 uppercase">{label}</span>
                    <span className="text-[12px] font-mono font-bold" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}70` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${count > 0 ? Math.max(pct, 5) : 0}%` }}
                      transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 + i * 0.08 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* User funnel */}
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-700">USER FUNNEL</p>
            <motion.div
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {funnel.map(({ label, value, color }, i) => {
              const pct = stats ? (value / Math.max(stats.totalUsers, 1)) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] tracking-widest text-zinc-600">{label}</span>
                    <span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}70` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${value > 0 ? Math.max(pct, 5) : 0}%` }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.25 + i * 0.08 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Row 3: system status + command log */}
      <div className="grid grid-cols-2 gap-3 shrink-0" style={{ height: 150 }}>

        {/* System status */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col"
        >
          <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-3">SYSTEM STATUS</p>
          <div className="flex-1 flex flex-col justify-around">
            {[
              { label: "SUPABASE",   node: "US-EAST-1",  on: true,    dur: 2.3 },
              { label: "ANTHROPIC",  node: "API",         on: true,    dur: 3.1 },
              { label: "ELEVENLABS", node: "TTS STREAM",  on: !!stats, dur: 2.7 },
            ].map(({ label, node, on, dur }) => (
              <div key={label} className="flex items-center gap-2">
                <motion.div
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${on ? "bg-emerald-500" : "bg-zinc-700"}`}
                  animate={on ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: dur, repeat: Infinity }}
                />
                <span className="text-[8px] tracking-widest text-zinc-500 w-24">{label}</span>
                <div className="flex-1 border-b border-dashed border-white/[0.04]" />
                <span className="text-[7px] font-mono text-zinc-700">{on ? node : "OFFLINE"}</span>
              </div>
            ))}
          </div>
          {sessionActive && (
            <div className="pt-2.5 mt-2.5 border-t border-white/[0.04] flex items-center gap-4">
              {[
                { label: "SESSION",   val: fmtDuration(sessionElapsed) },
                { label: "CMDS",      val: String(commandCount) },
                ...(avgLatency !== null ? [{ label: "AVG LAT", val: `${avgLatency}s` }] : []),
              ].map(({ label, val }) => (
                <div key={label}>
                  <p className="text-[5px] tracking-widest text-zinc-800">{label}</p>
                  <p className="text-[10px] font-mono font-bold text-zinc-500">{val}</p>
                </div>
              ))}
              <div className="ml-auto">
                <p className="text-[5px] tracking-widest text-zinc-800">STATE</p>
                <p className="text-[10px] font-mono font-bold" style={{ color: c }}>{state.toUpperCase()}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Command log */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col"
        >
          <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-3">COMMAND LOG</p>
          <div className="flex-1 overflow-y-auto space-y-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.length === 0 ? (
              <p className="text-[8px] text-zinc-800 font-mono">// awaiting commands</p>
            ) : (
              messages.slice(-8).map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span
                    className="text-[9px] font-mono shrink-0 mt-0.5"
                    style={{ color: msg.role === "user" ? "#3b82f6" : "#d4a853" }}
                  >
                    {msg.role === "user" ? "›" : "‹"}
                  </span>
                  <p className={`text-[8px] font-mono leading-snug ${msg.role === "user" ? "text-zinc-600" : "text-zinc-400"}`}>
                    {msg.text.slice(0, 100)}{msg.text.length > 100 ? "…" : ""}
                  </p>
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

  const conversationActiveRef = useRef(false);
  const sessionStartRef       = useRef<number | null>(null);
  const recognitionRef        = useRef<any>(null);
  const audioRef              = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef        = useRef<MediaSource | null>(null);
  const streamReaderRef       = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const transcriptEndRef      = useRef<HTMLDivElement>(null);
  const sendCommandRef        = useRef<(cmd: string) => void>(() => {});

  // ── Stats load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/jarvis/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  // ── Auto-scroll transcript ───────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Live clock + session timer ───────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      if (sessionStartRef.current) setSessionElapsed(Date.now() - sessionStartRef.current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Streaming audio via MediaSource ─────────────────────────────────────────
  const playStreamingAudio = useCallback(async (response: Response, onEnd: () => void) => {
    if (!response.body) { onEnd(); return; }

    const useMediaSource =
      typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

    if (!useMediaSource) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd(); };
      audio.play().catch(onEnd);
      return;
    }

    const ms = new MediaSource();
    mediaSourceRef.current = ms;
    const url = URL.createObjectURL(ms);
    const audio = new Audio(url);
    audioRef.current = audio;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      audioRef.current = null;
      mediaSourceRef.current = null;
      onEnd();
    };
    audio.onended = cleanup;
    audio.onerror = cleanup;

    await new Promise<void>(resolve => ms.addEventListener("sourceopen", () => resolve(), { once: true }));

    let sb: SourceBuffer;
    try {
      sb = ms.addSourceBuffer("audio/mpeg");
    } catch {
      cleanup();
      return;
    }

    audio.play().catch(() => {});

    const reader = response.body.getReader();
    streamReaderRef.current = reader;

    const waitForUpdate = () =>
      new Promise<void>(r => sb.addEventListener("updateend", () => r(), { once: true }));

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          streamReaderRef.current = null;
          if (sb.updating) await waitForUpdate();
          if (ms.readyState === "open") ms.endOfStream();
          break;
        }
        if (sb.updating) await waitForUpdate();
        if (ms.readyState === "open") sb.appendBuffer(value);
      }
    } catch {
      streamReaderRef.current = null;
    }
  }, []);

  // ── Speech recognition ───────────────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    setState("listening");
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    let gotResult = false;

    rec.onresult = (e: any) => {
      gotResult = true;
      const text: string = e.results[0][0].transcript.trim();
      if (!text) {
        recognitionRef.current = null;
        if (conversationActiveRef.current) setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 200);
        return;
      }
      setLastTranscript(text);
      setCommandCount(c => c + 1);
      sendCommandRef.current(text);
    };

    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      recognitionRef.current = null;
      if (conversationActiveRef.current) {
        setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 400);
      } else {
        setState("idle");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!gotResult && conversationActiveRef.current) {
        setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 200);
      }
    };

    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      if (conversationActiveRef.current) {
        setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 600);
      } else {
        setState("idle");
      }
    }
  }, []);

  // ── Stop audio ───────────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    streamReaderRef.current?.cancel().catch(() => {});
    streamReaderRef.current = null;
    if (mediaSourceRef.current && mediaSourceRef.current.readyState === "open") {
      try { mediaSourceRef.current.endOfStream(); } catch {}
    }
    mediaSourceRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
  }, []);

  // ── sendCommand ──────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (command: string) => {
    const t0 = Date.now();
    setState("processing");
    setMessages(prev => [...prev, { role: "user", text: command, ts: new Date() }]);

    try {
      const res = await fetch("/api/admin/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });

      const latencyMs = Date.now() - t0;
      const contentType = res.headers.get("Content-Type") ?? "";

      if (contentType.includes("audio")) {
        const rawHeader = res.headers.get("X-Jarvis-Text") ?? "";
        const text = rawHeader ? decodeURIComponent(rawHeader) : "";

        if (text) {
          setMessages(prev => [...prev, { role: "jarvis", text, ts: new Date(), latencyMs }]);
          setLatencies(prev => [...prev, latencyMs]);
        }
        setState("speaking");

        await playStreamingAudio(res, () => {
          if (conversationActiveRef.current) {
            setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 350);
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
        if (conversationActiveRef.current) {
          setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 350);
        } else {
          setState("idle");
        }
      }
    } catch {
      if (conversationActiveRef.current) {
        setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 600);
      } else {
        setState("idle");
      }
    }
  }, [startRecognition, playStreamingAudio]);

  useEffect(() => { sendCommandRef.current = sendCommand; }, [sendCommand]);

  // ── Session toggle ───────────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (conversationActiveRef.current) {
      conversationActiveRef.current = false;
      setSessionActive(false);
      sessionStartRef.current = null;
      setSessionElapsed(0);
      setCommandCount(0);
      setLatencies([]);
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      stopAudio();
      setState("idle");
    } else {
      conversationActiveRef.current = true;
      setSessionActive(true);
      sessionStartRef.current = Date.now();
      setCommandCount(0);
      setLatencies([]);
      startRecognition();
    }
  }, [startRecognition, stopAudio]);

  // ── Interrupt ────────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopAudio();
    if (conversationActiveRef.current) {
      setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 150);
    } else {
      setState("idle");
    }
  }, [startRecognition, stopAudio]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const c = { idle: "#d4a853", listening: "#3b82f6", processing: "#8b5cf6", speaking: "#10b981" }[state];
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length / 100) / 10
    : null;
  const convRate = stats ? Math.round((stats.paid / Math.max(stats.totalUsers, 1)) * 100) : null;

  const corners = [
    "top-5 left-5 border-t border-l",
    "top-5 right-5 border-t border-r",
    "bottom-5 left-5 border-b border-l",
    "bottom-5 right-5 border-b border-r",
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black text-white select-none">

      {/* Hex grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.032,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3Cpolygon points='30,62 58,77 58,107 30,122 2,107 2,77' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 104px",
        }}
      />

      {/* Scanline */}
      <motion.div
        className="pointer-events-none absolute left-0 right-0 z-10 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${c}18, transparent)` }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 30%, rgba(0,0,0,0.72) 100%)" }}
      />

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center border-b border-white/[0.05] px-6 py-3">

        {/* Left */}
        <div className="flex items-center gap-4 w-56 shrink-0">
          <Link href="/admin" className="flex items-center gap-1.5 text-[9px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors">
            <ArrowLeft className="h-3 w-3" /> ADMIN
          </Link>
          <span className="text-zinc-800">|</span>
          <div className="flex items-center gap-1.5">
            <motion.div className="h-1 w-1 rounded-full bg-emerald-500" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.2, repeat: Infinity }} />
            <span className="text-[7px] tracking-[0.4em] text-zinc-700">ONLINE</span>
          </div>
        </div>

        {/* Center */}
        <div className="flex-1 text-center">
          <p className="text-lg font-bold tracking-[1em] text-white">J A R V I S</p>
          <p className="text-[6px] tracking-[0.6em] text-zinc-800 mt-0.5">CINEFLOW INTELLIGENCE SYSTEM</p>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4 w-56 shrink-0 justify-end">

          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded border border-white/[0.06] p-0.5">
            {(["voice", "data"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-[7px] tracking-widest font-medium transition-all ${
                  viewMode === mode
                    ? "bg-[#d4a853]/15 text-[#d4a853]"
                    : "text-zinc-700 hover:text-zinc-500"
                }`}
              >
                {mode === "voice"
                  ? <Mic className="h-2 w-2" />
                  : <BarChart3 className="h-2 w-2" />}
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {/* State indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: c }}
              animate={{ opacity: state === "idle" ? [0.3, 1, 0.3] : 1 }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <motion.span
              key={state}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[8px] tracking-[0.35em] font-medium"
              style={{ color: c }}
            >
              {state.toUpperCase()}
            </motion.span>
          </div>

          {/* Clock */}
          <div className="text-right">
            <p className="text-sm font-mono font-bold text-white tabular-nums tracking-wider">{clock}</p>
            <p className="text-[6px] tracking-widest text-zinc-700">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN ───────────────────────────────────────────────────────────── */}
      <div className="flex h-full w-full pt-[58px] pb-[62px]">
        <AnimatePresence mode="wait">
          {viewMode === "voice" ? (

            // ── VOICE MODE ──────────────────────────────────────────────────
            <motion.div
              key="voice"
              className="flex h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Left: metrics */}
              <div className="w-56 shrink-0 border-r border-white/[0.05] flex flex-col p-4 gap-2">
                <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-1">LIVE METRICS</p>

                {[
                  { label: "TOTAL USERS",   value: stats ? stats.totalUsers.toLocaleString() : "···" },
                  { label: "MRR",           value: stats ? `$${stats.mrr.toLocaleString()}` : "···" },
                  { label: "ARR",           value: stats ? `$${stats.arr.toLocaleString()}` : "···" },
                  { label: "PAID ACCOUNTS", value: stats ? stats.paid.toLocaleString() : "···" },
                  { label: "CONVERSION",    value: convRate !== null ? `${convRate}%` : "···" },
                  { label: "SIGNUPS TODAY", value: stats ? stats.signupsToday.toString() : "·" },
                  { label: "ACTIVE / 7D",   value: stats ? stats.activeLastWeek.toLocaleString() : "···" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                    <p className="text-[6px] tracking-[0.4em] text-zinc-700 mb-0.5">{label}</p>
                    <p className="text-lg font-bold font-mono text-white leading-none tabular-nums">{value}</p>
                  </div>
                ))}

                {/* Connections */}
                <div className="mt-auto pt-3 border-t border-white/[0.04] space-y-1.5">
                  <p className="text-[6px] tracking-[0.5em] text-zinc-800 mb-1">CONNECTIONS</p>
                  {[
                    { label: "SUPABASE",   on: true,    node: "US-EAST-1", dur: 2.3 },
                    { label: "ANTHROPIC",  on: true,    node: "API",       dur: 3.1 },
                    { label: "ELEVENLABS", on: !!stats, node: "TTS",       dur: 2.7 },
                  ].map(({ label, on, node, dur }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <motion.div
                        className={`h-1 w-1 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-800"}`}
                        animate={on ? { opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ duration: dur, repeat: Infinity }}
                      />
                      <span className="text-[6px] tracking-widest text-zinc-700">{label}</span>
                      <span className="ml-auto text-[6px] tracking-wider text-zinc-800">{on ? node : "OFFLINE"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: orb */}
              <div className="relative flex-1 flex flex-col items-center justify-center">
                {corners.map((cls, i) => (
                  <div key={i} className={`absolute ${cls} border-[#d4a853]/10 h-8 w-8`} />
                ))}

                {/* Crosshair */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[#d4a853]/04 to-transparent" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d4a853]/04 to-transparent" />
                </div>

                {/* ORB */}
                <div className="relative flex items-center justify-center">
                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${c}06 0%, transparent 70%)` }}
                    animate={{
                      width:  state === "listening" ? 460 : state === "speaking" ? 440 : 400,
                      height: state === "listening" ? 460 : state === "speaking" ? 440 : 400,
                    }}
                    transition={{ duration: 0.7, ease: "easeInOut" }}
                  />

                  <AnimatePresence>
                    {state === "listening" && [0, 0.65, 1.3].map((delay, i) => (
                      <motion.div
                        key={`l${i}`}
                        className="absolute rounded-full border pointer-events-none"
                        style={{ borderColor: `${c}35` }}
                        initial={{ width: 145, height: 145, opacity: 0.9 }}
                        animate={{ width: 400, height: 400, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.4, delay, repeat: Infinity, ease: "easeOut" }}
                      />
                    ))}
                    {state === "speaking" && [0, 0.5, 1.0].map((delay, i) => (
                      <motion.div
                        key={`s${i}`}
                        className="absolute rounded-full border pointer-events-none"
                        style={{ borderColor: `${c}28` }}
                        initial={{ width: 160, height: 160, opacity: 0.7 }}
                        animate={{ width: 380, height: 380, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2.0, delay, repeat: Infinity, ease: "easeOut" }}
                      />
                    ))}
                    {state === "processing" && (
                      <motion.div
                        key="proc"
                        className="absolute rounded-full border-2 pointer-events-none"
                        style={{ width: 205, height: 205, borderColor: `${c}40`, borderTopColor: "transparent", borderRightColor: "transparent" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </AnimatePresence>

                  <div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}06`, width: 272, height: 272 }} />

                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{ width: 226, height: 226, border: `1px dashed ${c}18` }}
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                  />

                  <motion.div
                    className="absolute rounded-full border pointer-events-none"
                    style={{ width: 180, height: 180, borderColor: `${c}22`, borderTopColor: "transparent", borderLeftColor: "transparent" }}
                    animate={{ rotate: [360, 0] }}
                    transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
                  />

                  <motion.div
                    className="absolute rounded-full border pointer-events-none"
                    style={{ borderColor: `${c}45` }}
                    animate={{
                      width:     sessionActive ? 148 : state === "idle" ? 130 : 146,
                      height:    sessionActive ? 148 : state === "idle" ? 130 : 146,
                      boxShadow: [`0 0 8px ${c}18`, `0 0 24px ${c}32`, `0 0 8px ${c}18`],
                    }}
                    transition={{ width: { duration: 0.4 }, height: { duration: 0.4 }, boxShadow: { duration: 2.5, repeat: Infinity } }}
                  />

                  <motion.div
                    className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
                    animate={{
                      width:  sessionActive ? 126 : state === "idle" ? 110 : 124,
                      height: sessionActive ? 126 : state === "idle" ? 110 : 124,
                    }}
                    transition={{ duration: 0.4 }}
                    style={{
                      background:  `radial-gradient(circle at 38% 32%, ${c}35 0%, ${c}10 50%, transparent 78%)`,
                      boxShadow:   `inset 0 0 28px ${c}10, 0 0 35px ${c}18`,
                    }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: `conic-gradient(from 0deg, transparent, ${c}20, transparent)`, opacity: 0.25 }}
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.div
                      className="relative z-10 rounded-full"
                      style={{ backgroundColor: c, boxShadow: `0 0 16px ${c}` }}
                      animate={{
                        width:   state === "speaking" ? 22 : state === "listening" ? 14 : sessionActive ? 10 : 8,
                        height:  state === "speaking" ? 22 : state === "listening" ? 14 : sessionActive ? 10 : 8,
                        opacity: state === "idle" && !sessionActive ? 0.4 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.div>
                </div>

                {/* Waveform + state label */}
                <div className="mt-10 flex flex-col items-center gap-3">
                  <WaveformBars active={state === "listening" || state === "speaking"} color={c} />

                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${state}-${sessionActive}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="text-[9px] font-semibold tracking-[0.6em]"
                      style={{ color: c }}
                    >
                      {state === "idle" && !sessionActive && "STANDBY"}
                      {state === "idle" && sessionActive  && "READY · · ·"}
                      {state === "listening"               && "LISTENING · · ·"}
                      {state === "processing"              && "PROCESSING REQUEST"}
                      {state === "speaking"                && "JARVIS SPEAKING"}
                    </motion.p>
                  </AnimatePresence>

                  <AnimatePresence>
                    {lastTranscript && (state === "processing" || state === "speaking") && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.35 }}
                        exit={{ opacity: 0 }}
                        className="text-[9px] font-mono text-zinc-600 max-w-xs text-center"
                      >
                        &ldquo;{lastTranscript}&rdquo;
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right: command log */}
              <div className="w-72 shrink-0 border-l border-white/[0.05] flex flex-col p-4">
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

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                      <div className="h-10 w-10 rounded-full border border-[#d4a853]/10 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-[#d4a853]/15" />
                      </div>
                      <div>
                        <p className="text-[7px] tracking-[0.5em] text-zinc-700 mb-4">START A SESSION TO BEGIN</p>
                        {[
                          '"How many users do we have?"',
                          '"What\'s our MRR right now?"',
                          '"Read me the latest feedback"',
                          '"Send a broadcast to all users"',
                          '"List all feature flags"',
                        ].map(ex => (
                          <p key={ex} className="text-[8px] font-mono text-zinc-800 mb-1.5 text-left">{ex}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: msg.role === "user" ? 8 : -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[6px] tracking-widest ${msg.role === "user" ? "text-zinc-700" : "text-[#d4a853]/40"}`}>
                            {msg.role === "user" ? "KENNY" : "JARVIS"}
                            {" · "}
                            {msg.ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                          </p>
                          {msg.role === "jarvis" && msg.latencyMs && (
                            <span className="text-[6px] font-mono text-zinc-800">
                              {(msg.latencyMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                        <div className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-white/[0.025] border border-white/[0.05] text-zinc-400"
                            : "bg-[#d4a853]/[0.04] border border-[#d4a853]/10 text-zinc-300"
                        }`}>
                          {msg.text}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            </motion.div>

          ) : (

            // ── DATA MODE ────────────────────────────────────────────────────
            <motion.div
              key="data"
              className="flex h-full w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <DataModeView
                stats={stats}
                messages={messages}
                sessionActive={sessionActive}
                commandCount={commandCount}
                sessionElapsed={sessionElapsed}
                avgLatency={avgLatency}
                state={state}
                c={c}
              />
            </motion.div>

          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM BAR ─────────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 border-t border-white/[0.05] px-6 py-3">

        {/* Session stats (left) */}
        {sessionActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute left-6 flex items-center gap-5"
          >
            {[
              { label: "SESSION",     val: fmtDuration(sessionElapsed) },
              { label: "COMMANDS",    val: String(commandCount) },
              ...(avgLatency !== null ? [{ label: "AVG LATENCY", val: `${avgLatency}s` }] : []),
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[6px] tracking-widest text-zinc-700">{label}</p>
                <p className="text-xs font-mono font-bold text-zinc-500 tabular-nums">{val}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Primary button */}
        <motion.button
          onClick={
            state === "speaking"
              ? interrupt
              : sessionActive
                ? (state === "idle" ? toggleSession : () => {})
                : toggleSession
          }
          className="flex items-center gap-2.5 rounded-full px-8 py-2.5 text-[10px] font-bold tracking-[0.35em] transition-colors"
          style={{
            backgroundColor: `${c}12`,
            border: `1px solid ${c}${sessionActive ? "55" : "28"}`,
            color: c,
            boxShadow: sessionActive ? `0 0 24px ${c}12` : "none",
          }}
          whileTap={{ scale: 0.97 }}
        >
          <AnimatePresence mode="wait">
            {!sessionActive && (
              <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}>
                <Mic className="h-3.5 w-3.5" />
              </motion.span>
            )}
            {sessionActive && state === "listening" && (
              <motion.div key="pulse" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }}
                animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />
            )}
            {sessionActive && state === "processing" && (
              <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" />
              </motion.div>
            )}
            {sessionActive && state === "speaking" && (
              <motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Square className="h-3 w-3 fill-current" />
              </motion.span>
            )}
            {sessionActive && state === "idle" && (
              <motion.div key="breathe" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }}
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
            )}
          </AnimatePresence>

          {!sessionActive                            && "START SESSION"}
          {sessionActive && state === "listening"    && "LISTENING · · ·"}
          {sessionActive && state === "processing"   && "PROCESSING · · ·"}
          {sessionActive && state === "speaking"     && "INTERRUPT"}
          {sessionActive && state === "idle"         && "SESSION ACTIVE"}
        </motion.button>

        {/* End session */}
        {sessionActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={toggleSession}
            className="flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[9px] font-bold tracking-widest text-zinc-700 border border-white/[0.06] hover:border-white/[0.12] hover:text-zinc-400 transition-colors"
          >
            <Square className="h-2.5 w-2.5" />
            END SESSION
          </motion.button>
        )}

      </div>
    </div>
  );
}
