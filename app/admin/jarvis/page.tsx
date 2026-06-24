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
  [4, 14, 6, 22, 8, 18, 5],
  [8, 3, 20, 10, 26, 4, 12],
  [14, 22, 5, 18, 8, 24, 10],
  [10, 18, 24, 5, 14, 8, 20],
  [6, 12, 4, 20, 16, 9, 22],
  [12, 6, 18, 9, 4, 20, 10],
  [5, 20, 10, 3, 22, 12, 6],
];
const BAR_DELAYS = [0, 0.1, 0.05, 0.15, 0.08, 0.2, 0.03];

function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 32 }}>
      {BAR_PATTERNS.map((kf, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ backgroundColor: color, width: 3, boxShadow: active ? `0 0 6px ${color}` : "none" }}
          animate={active ? { height: kf.map(v => `${v}px`) } : { height: "3px" }}
          transition={
            active
              ? { duration: 0.65, repeat: Infinity, delay: BAR_DELAYS[i], ease: "easeInOut" }
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

// ── Data Mode ──────────────────────────────────────────────────────────────────

const PLAN_META = [
  { key: "lifetime",   label: "LIFETIME",   color: "#d4a853" },
  { key: "enterprise", label: "ENTERPRISE", color: "#8b5cf6" },
  { key: "agency",     label: "AGENCY",     color: "#3b82f6" },
  { key: "studio",     label: "STUDIO",     color: "#10b981" },
  { key: "solo",       label: "SOLO",       color: "#f59e0b" },
];

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
  const convRate = stats ? Math.round((stats.paid / Math.max(stats.totalUsers, 1)) * 100) : null;

  const funnel = [
    { label: "REGISTERED",  value: stats?.totalUsers ?? 0,     color: "#e2e8f0" },
    { label: "ACTIVE / 7D", value: stats?.activeLastWeek ?? 0, color: "#10b981" },
    { label: "PAID",        value: stats?.paid ?? 0,           color: "#d4a853" },
    { label: "TRIALING",    value: stats?.trialing ?? 0,       color: "#8b5cf6" },
    { label: "EXPIRED",     value: stats?.expired ?? 0,        color: "#ef4444" },
  ];

  const tiles = [
    { label: "TOTAL USERS",  value: stats?.totalUsers?.toLocaleString() ?? "···",          sub: "registered",       accent: "#e2e8f0" },
    { label: "TODAY",        value: stats?.signupsToday?.toString() ?? "·",                sub: "new signups",      accent: "#3b82f6" },
    { label: "THIS WEEK",    value: stats?.signupsWeek?.toString() ?? "···",               sub: "new signups",      accent: "#3b82f6" },
    { label: "ACTIVE / 7D",  value: stats?.activeLastWeek?.toLocaleString() ?? "···",      sub: "unique logins",    accent: "#10b981" },
    { label: "MRR",          value: stats ? `$${stats.mrr.toLocaleString()}` : "···",      sub: "monthly recurring", accent: "#d4a853" },
    { label: "ARR",          value: stats ? `$${stats.arr.toLocaleString()}` : "···",      sub: "annual run rate",   accent: "#d4a853" },
    { label: "CONVERSION",   value: convRate !== null ? `${convRate}%` : "···",            sub: `${stats?.paid ?? 0} paid`, accent: "#d4a853" },
  ];

  return (
    <div className="flex flex-col w-full h-full gap-3 p-4 overflow-hidden">

      {/* Metric tiles */}
      <div className="grid grid-cols-7 gap-2 shrink-0">
        {tiles.map(({ label, value, sub, accent }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 hover:bg-white/[0.03] transition-colors cursor-default"
            style={{ borderColor: `${accent}18` }}
          >
            <p className="text-[5px] tracking-[0.5em] text-zinc-700 mb-1.5">{label}</p>
            <p className="text-xl font-bold font-mono tabular-nums leading-none" style={{ color: accent }}>{value}</p>
            <p className="text-[5px] text-zinc-800 mt-1.5 tracking-wider">{sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

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
                    <span className="text-[13px] font-mono font-bold" style={{ color }}>{count}</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}80` }}
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

        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-5 flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-700">USER FUNNEL</p>
            <motion.div className="h-1.5 w-1.5 rounded-full bg-emerald-500" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />
          </div>
          <div className="flex-1 flex flex-col justify-around gap-3">
            {funnel.map(({ label, value, color }, i) => {
              const pct = stats ? (value / Math.max(stats.totalUsers, 1)) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[8px] tracking-widest text-zinc-600">{label}</span>
                    <span className="text-[13px] font-mono font-bold" style={{ color }}>{value}</span>
                  </div>
                  <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}80` }}
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

      {/* System + log */}
      <div className="grid grid-cols-2 gap-3 shrink-0" style={{ height: 150 }}>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-lg border border-white/[0.05] bg-white/[0.01] p-4 flex flex-col"
        >
          <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-3">SYSTEM STATUS</p>
          <div className="flex-1 flex flex-col justify-around">
            {[
              { label: "SUPABASE",   node: "US-EAST-1",  on: true,         dur: 2.3 },
              { label: "ANTHROPIC",  node: "API",         on: true,         dur: 3.1 },
              { label: "ELEVENLABS", node: "TTS STREAM",  on: elevenlabsOk, dur: 2.7 },
            ].map(({ label, node, on, dur }) => (
              <div key={label} className="flex items-center gap-2">
                <motion.div
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${on ? "bg-emerald-500" : "bg-zinc-700"}`}
                  animate={on ? { opacity: [0.4, 1, 0.4] } : {}}
                  transition={{ duration: dur, repeat: Infinity }}
                />
                <span className="text-[8px] tracking-widest text-zinc-500 w-24">{label}</span>
                <div className="flex-1 border-b border-dashed border-white/[0.04]" />
                <span className="text-[7px] font-mono text-zinc-700">{on ? node : "NOT CONNECTED"}</span>
              </div>
            ))}
          </div>
          {sessionActive && (
            <div className="pt-2.5 mt-2.5 border-t border-white/[0.04] flex items-center gap-4">
              {[
                { label: "SESSION", val: fmtDuration(sessionElapsed) },
                { label: "CMDS",    val: String(commandCount) },
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
                  <span className="text-[9px] font-mono shrink-0 mt-0.5" style={{ color: msg.role === "user" ? "#3b82f6" : "#d4a853" }}>
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
  const [state, setState]             = useState<JarvisState>("idle");
  const [viewMode, setViewMode]       = useState<ViewMode>("voice");
  const [sessionActive, setSessionActive] = useState(false);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [stats, setStats]             = useState<LiveStats | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const [clock, setClock]             = useState("");
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [latencies, setLatencies]     = useState<number[]>([]);
  const [elevenlabsOk, setElevenlabsOk] = useState(false);

  const conversationActiveRef = useRef(false);
  const processingRef         = useRef(false);   // true while API call or audio is in-flight
  const sessionStartRef       = useRef<number | null>(null);
  const recognitionRef        = useRef<any>(null);
  const audioRef              = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef        = useRef<MediaSource | null>(null);
  const streamReaderRef       = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const transcriptEndRef      = useRef<HTMLDivElement>(null);
  const sendCommandRef        = useRef<(cmd: string) => void>(() => {});

  // ── Stats ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/admin/jarvis/stats").then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Clock + session timer ──────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      if (sessionStartRef.current) setSessionElapsed(Date.now() - sessionStartRef.current);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Streaming audio ────────────────────────────────────────────────────────
  const playStreamingAudio = useCallback(async (response: Response, onEnd: () => void) => {
    if (!response.body) { onEnd(); return; }

    const canMSE = typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

    if (!canMSE) {
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd(); };
      audio.play().catch(onEnd);
      return;
    }

    const ms  = new MediaSource();
    mediaSourceRef.current = ms;
    const url  = URL.createObjectURL(ms);
    const audio = new Audio(url);
    audioRef.current = audio;

    const cleanup = () => { URL.revokeObjectURL(url); audioRef.current = null; mediaSourceRef.current = null; onEnd(); };
    audio.onended = cleanup;
    audio.onerror = cleanup;

    await new Promise<void>(r => ms.addEventListener("sourceopen", () => r(), { once: true }));

    let sb: SourceBuffer;
    try { sb = ms.addSourceBuffer("audio/mpeg"); }
    catch { cleanup(); return; }

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
      streamReaderRef.current = null;
    }
  }, []);

  // ── Speech recognition — continuous:true, ONE instance per session ─────────
  // continuous:true means the browser grants the mic ONCE per session.
  // With continuous:false every restart is a new OS-level mic grant → indicator flashes.
  const startRecognition = useCallback(() => {
    // If an instance is already live, leave it — it's still listening
    if (recognitionRef.current) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang            = "en-US";
    rec.continuous      = true;   // single mic grant for entire session
    rec.interimResults  = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;

    rec.onresult = (e: any) => {
      if (processingRef.current) return; // Jarvis is busy — ignore
      const result = e.results[e.resultIndex];
      if (!result?.isFinal) return;
      const text: string = result[0].transcript.trim();
      if (!text) return;
      processingRef.current = true;
      setLastTranscript(text);
      setCommandCount(c => c + 1);
      sendCommandRef.current(text);
    };

    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      recognitionRef.current = null;
      if (!processingRef.current && conversationActiveRef.current) {
        setTimeout(() => {
          if (!processingRef.current && conversationActiveRef.current) startRecognition();
        }, 400);
      } else if (!conversationActiveRef.current) {
        setState("idle");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      // continuous:true only fires onend on explicit stop/abort or browser error
      // If not processing, restart so the mic stays live
      if (!processingRef.current && conversationActiveRef.current) {
        setTimeout(() => {
          if (!processingRef.current && conversationActiveRef.current) startRecognition();
        }, 200);
      }
    };

    setState("listening");
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setTimeout(() => { if (!processingRef.current && conversationActiveRef.current) startRecognition(); }, 600);
    }
  }, []);

  // ── Stop audio ─────────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    streamReaderRef.current?.cancel().catch(() => {});
    streamReaderRef.current = null;
    if (mediaSourceRef.current?.readyState === "open") { try { mediaSourceRef.current.endOfStream(); } catch {} }
    mediaSourceRef.current = null;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
  }, []);

  // ── sendCommand ────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (command: string) => {
    const t0 = Date.now();
    processingRef.current = true;
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
          if (conversationActiveRef.current) {
            setState("listening");
            // If recognition ended while we were processing/speaking, restart it
            if (!recognitionRef.current) {
              setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 300);
            }
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

  // ── Session toggle ─────────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (conversationActiveRef.current) {
      // End session
      conversationActiveRef.current = false;
      processingRef.current = false;
      setSessionActive(false);
      sessionStartRef.current = null;
      setSessionElapsed(0);
      setCommandCount(0);
      setLatencies([]);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
        recognitionRef.current = null;
      }
      stopAudio();
      setState("idle");
    } else {
      // Start session
      conversationActiveRef.current = true;
      processingRef.current = true; // block recognition until auto-brief is done
      setSessionActive(true);
      sessionStartRef.current = Date.now();
      setCommandCount(0);
      setLatencies([]);
      startRecognition();
      // Auto-brief: Jarvis opens with a live status summary
      setTimeout(() => {
        if (conversationActiveRef.current) sendCommandRef.current("Brief me on current status.");
      }, 500);
    }
  }, [startRecognition, stopAudio]);

  // ── Interrupt ──────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => {
    processingRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    stopAudio();
    if (conversationActiveRef.current) {
      setTimeout(() => { if (conversationActiveRef.current) startRecognition(); }, 150);
    } else {
      setState("idle");
    }
  }, [startRecognition, stopAudio]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const c = { idle: "#d4a853", listening: "#3b82f6", processing: "#8b5cf6", speaking: "#10b981" }[state];
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length / 100) / 10
    : null;
  const convRate = stats ? Math.round((stats.paid / Math.max(stats.totalUsers, 1)) * 100) : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative flex h-screen w-full overflow-hidden text-white select-none transition-all duration-1000"
      style={{
        background: sessionActive
          ? `radial-gradient(ellipse at 50% 38%, ${c}0a 0%, #000 58%)`
          : "black",
      }}
    >

      {/* Hex grid */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          opacity: 0.055,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3Cpolygon points='30,62 58,77 58,107 30,122 2,107 2,77' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 104px",
        }}
      />

      {/* Scanline 1 — slow, top-to-bottom */}
      <motion.div
        className="pointer-events-none absolute left-0 right-0 z-10 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${c}22, transparent)` }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Scanline 2 — fast, bottom-to-top, dimmer */}
      <motion.div
        className="pointer-events-none absolute left-0 right-0 z-10 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${c}10, transparent)` }}
        animate={{ top: ["100%", "0%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 28%, rgba(0,0,0,0.75) 100%)" }} />

      {/* Full-viewport corner brackets */}
      {[
        "top-4 left-4 border-t-2 border-l-2",
        "top-4 right-4 border-t-2 border-r-2",
        "bottom-4 left-4 border-b-2 border-l-2",
        "bottom-4 right-4 border-b-2 border-r-2",
      ].map((cls, i) => (
        <motion.div
          key={i}
          className={`absolute ${cls} pointer-events-none z-50 h-10 w-10`}
          style={{ borderColor: `${c}35` }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.6 }}
        />
      ))}

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex items-center px-6 py-3 transition-colors duration-700"
        style={{ borderBottom: `1px solid ${sessionActive ? c + "28" : "rgba(255,255,255,0.05)"}` }}
      >
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

        <div className="flex items-center gap-4 w-64 shrink-0 justify-end">
          {/* View toggle */}
          <div className="flex items-center gap-0.5 rounded border border-white/[0.06] p-0.5">
            {(["voice", "data"] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-[7px] tracking-widest font-medium transition-all ${
                  viewMode === mode ? "bg-[#d4a853]/15 text-[#d4a853]" : "text-zinc-700 hover:text-zinc-500"
                }`}
              >
                {mode === "voice" ? <Mic className="h-2 w-2" /> : <BarChart3 className="h-2 w-2" />}
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {/* State indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: c }}
              animate={{ opacity: state === "idle" ? [0.3, 1, 0.3] : 1, scale: state === "listening" ? [1, 1.4, 1] : 1 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.span key={state} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[8px] tracking-[0.35em] font-medium" style={{ color: c }}>
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

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className="flex h-full w-full pt-[58px] pb-[62px]">
        <AnimatePresence mode="wait">
          {viewMode === "voice" ? (

            // ── VOICE MODE ────────────────────────────────────────────────
            <motion.div key="voice" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Left metrics */}
              <div className="w-56 shrink-0 flex flex-col p-4 gap-2" style={{ borderRight: `1px solid ${sessionActive ? c + "18" : "rgba(255,255,255,0.05)"}` }}>
                <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-1">LIVE METRICS</p>
                {[
                  { label: "TOTAL USERS",   value: stats ? stats.totalUsers.toLocaleString() : "···",          color: "#e2e8f0" },
                  { label: "MRR",           value: stats ? `$${stats.mrr.toLocaleString()}` : "···",           color: "#d4a853" },
                  { label: "ARR",           value: stats ? `$${stats.arr.toLocaleString()}` : "···",           color: "#d4a853" },
                  { label: "PAID ACCOUNTS", value: stats ? stats.paid.toLocaleString() : "···",               color: "#10b981" },
                  { label: "CONVERSION",    value: convRate !== null ? `${convRate}%` : "···",                 color: "#d4a853" },
                  { label: "SIGNUPS TODAY", value: stats ? stats.signupsToday.toString() : "·",               color: "#3b82f6" },
                  { label: "ACTIVE / 7D",   value: stats ? stats.activeLastWeek.toLocaleString() : "···",     color: "#10b981" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded border border-white/[0.04] bg-white/[0.015] px-3 py-2">
                    <p className="text-[6px] tracking-[0.4em] text-zinc-700 mb-0.5">{label}</p>
                    <p className="text-lg font-bold font-mono leading-none tabular-nums" style={{ color }}>{value}</p>
                  </div>
                ))}

                {/* Connections */}
                <div className="mt-auto pt-3 border-t border-white/[0.04] space-y-2">
                  <p className="text-[6px] tracking-[0.5em] text-zinc-800 mb-1">CONNECTIONS</p>
                  {[
                    { label: "SUPABASE",   on: true,         node: "US-EAST-1", dur: 2.3 },
                    { label: "ANTHROPIC",  on: true,         node: "API",       dur: 3.1 },
                    { label: "ELEVENLABS", on: elevenlabsOk, node: "TTS",       dur: 2.7 },
                  ].map(({ label, on, node, dur }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <motion.div
                        className={`h-1 w-1 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-800"}`}
                        animate={on ? { opacity: [0.5, 1, 0.5] } : {}}
                        transition={{ duration: dur, repeat: Infinity }}
                      />
                      <span className="text-[6px] tracking-widest text-zinc-700">{label}</span>
                      <span className="ml-auto text-[6px] tracking-wider text-zinc-800">{on ? node : "···"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center orb */}
              <div className="relative flex-1 flex flex-col items-center justify-center">
                {/* Crosshair */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
                </div>

                {/* ORB */}
                <div className="relative flex items-center justify-center">
                  {/* Ambient glow */}
                  <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${c}09 0%, transparent 70%)` }}
                    animate={{ width: state === "listening" ? 500 : state === "speaking" ? 480 : 420, height: state === "listening" ? 500 : state === "speaking" ? 480 : 420 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />

                  {/* Pulse rings */}
                  <AnimatePresence>
                    {state === "listening" && [0, 0.7, 1.4].map((delay, i) => (
                      <motion.div key={`l${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}40` }}
                        initial={{ width: 150, height: 150, opacity: 1 }} animate={{ width: 430, height: 430, opacity: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 2.2, delay, repeat: Infinity, ease: "easeOut" }} />
                    ))}
                    {state === "speaking" && [0, 0.55, 1.1].map((delay, i) => (
                      <motion.div key={`s${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}30` }}
                        initial={{ width: 165, height: 165, opacity: 0.8 }} animate={{ width: 400, height: 400, opacity: 0 }} exit={{ opacity: 0 }}
                        transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }} />
                    ))}
                    {state === "processing" && (
                      <motion.div key="proc" className="absolute rounded-full border-2 pointer-events-none"
                        style={{ width: 215, height: 215, borderColor: `${c}45`, borderTopColor: "transparent", borderRightColor: "transparent" }}
                        animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    )}
                  </AnimatePresence>

                  {/* Static rings */}
                  <div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}08`, width: 290, height: 290 }} />
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 242, height: 242, border: `1px dashed ${c}20` }}
                    animate={{ rotate: [0, 360] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full border pointer-events-none"
                    style={{ width: 195, height: 195, borderColor: `${c}28`, borderTopColor: "transparent", borderLeftColor: "transparent" }}
                    animate={{ rotate: [360, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "linear" }} />
                  {/* Extra inner ring */}
                  <motion.div className="absolute rounded-full pointer-events-none"
                    style={{ width: 162, height: 162, border: `1px dashed ${c}15` }}
                    animate={{ rotate: [0, -360] }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} />

                  {/* Inner glow ring */}
                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}55` }}
                    animate={{
                      width:     sessionActive ? 152 : state === "idle" ? 132 : 150,
                      height:    sessionActive ? 152 : state === "idle" ? 132 : 150,
                      boxShadow: [`0 0 10px ${c}20`, `0 0 30px ${c}38`, `0 0 10px ${c}20`],
                    }}
                    transition={{ width: { duration: 0.4 }, height: { duration: 0.4 }, boxShadow: { duration: 2.2, repeat: Infinity } }}
                  />

                  {/* Core sphere */}
                  <motion.div
                    className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
                    animate={{ width: sessionActive ? 130 : state === "idle" ? 112 : 128, height: sessionActive ? 130 : state === "idle" ? 112 : 128 }}
                    transition={{ duration: 0.4 }}
                    style={{ background: `radial-gradient(circle at 36% 30%, ${c}40 0%, ${c}12 50%, transparent 78%)`, boxShadow: `inset 0 0 30px ${c}12, 0 0 40px ${c}22` }}
                  >
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ background: `conic-gradient(from 0deg, transparent, ${c}25, transparent)`, opacity: 0.3 }}
                      animate={{ rotate: [0, 360] }} transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="relative z-10 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 20px ${c}` }}
                      animate={{
                        width:   state === "speaking" ? 26 : state === "listening" ? 16 : sessionActive ? 11 : 8,
                        height:  state === "speaking" ? 26 : state === "listening" ? 16 : sessionActive ? 11 : 8,
                        opacity: state === "idle" && !sessionActive ? 0.35 : 1,
                      }}
                      transition={{ duration: 0.25 }} />
                  </motion.div>
                </div>

                {/* Waveform + label */}
                <div className="mt-10 flex flex-col items-center gap-3">
                  <WaveformBars active={state === "listening" || state === "speaking"} color={c} />
                  <AnimatePresence mode="wait">
                    <motion.p key={`${state}-${sessionActive}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                      className="text-[9px] font-semibold tracking-[0.6em]" style={{ color: c }}>
                      {state === "idle" && !sessionActive && "STANDBY"}
                      {state === "idle" && sessionActive  && "READY · · ·"}
                      {state === "listening"               && "LISTENING · · ·"}
                      {state === "processing"              && "PROCESSING REQUEST"}
                      {state === "speaking"                && "JARVIS SPEAKING"}
                    </motion.p>
                  </AnimatePresence>
                  <AnimatePresence>
                    {lastTranscript && (state === "processing" || state === "speaking") && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} exit={{ opacity: 0 }} className="text-[9px] font-mono text-zinc-600 max-w-xs text-center">
                        &ldquo;{lastTranscript}&rdquo;
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right command log */}
              <div className="w-72 shrink-0 flex flex-col p-4" style={{ borderLeft: `1px solid ${sessionActive ? c + "18" : "rgba(255,255,255,0.05)"}` }}>
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
                        {['"How many users do we have?"', '"What\'s our MRR?"', '"Read the latest feedback"', '"Send a broadcast"', '"What should I focus on?"'].map(ex => (
                          <p key={ex} className="text-[8px] font-mono text-zinc-800 mb-1.5 text-left">{ex}</p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: msg.role === "user" ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[6px] tracking-widest ${msg.role === "user" ? "text-zinc-700" : "text-[#d4a853]/50"}`}>
                            {msg.role === "user" ? "KENNY" : "JARVIS"}{" · "}
                            {msg.ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                          </p>
                          {msg.role === "jarvis" && msg.latencyMs && (
                            <span className="text-[6px] font-mono text-zinc-800">{(msg.latencyMs / 1000).toFixed(1)}s</span>
                          )}
                        </div>
                        <div className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${
                          msg.role === "user"
                            ? "bg-white/[0.025] border border-white/[0.05] text-zinc-400"
                            : "border text-zinc-300"
                        }`} style={msg.role === "jarvis" ? { backgroundColor: `${c}06`, borderColor: `${c}18` } : {}}>
                          {msg.role === "jarvis" && i === messages.length - 1
                            ? <TypewriterText text={msg.text} />
                            : msg.text}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

            </motion.div>

          ) : (

            // ── DATA MODE ──────────────────────────────────────────────────
            <motion.div key="data" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DataModeView
                stats={stats} messages={messages} sessionActive={sessionActive}
                commandCount={commandCount} sessionElapsed={sessionElapsed}
                avgLatency={avgLatency} state={state} c={c} elevenlabsOk={elevenlabsOk}
              />
            </motion.div>

          )}
        </AnimatePresence>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center gap-3 px-6 py-3 transition-colors duration-700"
        style={{ borderTop: `1px solid ${sessionActive ? c + "20" : "rgba(255,255,255,0.05)"}` }}
      >
        {sessionActive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute left-6 flex items-center gap-5">
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

        <motion.button
          onClick={state === "speaking" ? interrupt : sessionActive ? (state === "idle" ? toggleSession : () => {}) : toggleSession}
          className="flex items-center gap-2.5 rounded-full px-8 py-2.5 text-[10px] font-bold tracking-[0.35em] transition-all"
          style={{
            backgroundColor: `${c}12`,
            border:     `1px solid ${c}${sessionActive ? "60" : "30"}`,
            color:      c,
            boxShadow:  sessionActive ? `0 0 28px ${c}18, inset 0 0 8px ${c}08` : "none",
          }}
          whileTap={{ scale: 0.97 }}
        >
          <AnimatePresence mode="wait">
            {!sessionActive && (<motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><Mic className="h-3.5 w-3.5" /></motion.span>)}
            {sessionActive && state === "listening"  && (<motion.div key="pulse" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />)}
            {sessionActive && state === "processing" && (<motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}><div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" /></motion.div>)}
            {sessionActive && state === "speaking"   && (<motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }}><Square className="h-3 w-3 fill-current" /></motion.span>)}
            {sessionActive && state === "idle"       && (<motion.div key="breathe" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />)}
          </AnimatePresence>
          {!sessionActive                          && "START SESSION"}
          {sessionActive && state === "listening"  && "LISTENING · · ·"}
          {sessionActive && state === "processing" && "PROCESSING · · ·"}
          {sessionActive && state === "speaking"   && "INTERRUPT"}
          {sessionActive && state === "idle"       && "SESSION ACTIVE"}
        </motion.button>

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
