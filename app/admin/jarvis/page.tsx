"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mic, Square, Activity, BarChart3, Maximize2, Minimize2 } from "lucide-react";

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
  [4, 14, 6, 22, 8, 18, 5],
  [8, 3, 20, 10, 26, 4, 12],
  [14, 22, 5, 18, 8, 24, 10],
  [10, 18, 24, 5, 14, 8, 20],
  [6, 12, 4, 20, 16, 9, 22],
  [12, 6, 18, 9, 4, 20, 10],
  [5, 20, 10, 3, 22, 12, 6],
];
const BAR_DELAYS = [0, 0.1, 0.05, 0.15, 0.08, 0.2, 0.03];

const WaveformBars = memo(function WaveformBars({
  active, color, audioHeights,
}: { active: boolean; color: string; audioHeights?: number[] }) {
  if (active && audioHeights) {
    return (
      <div className="flex items-center justify-center gap-[3px]" style={{ height: 32 }}>
        {audioHeights.map((h, i) => (
          <div key={i} className="rounded-full" style={{ backgroundColor: color, width: 3, height: h, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}60`, transition: "height 0.04s linear" }} />
        ))}
      </div>
    );
  }
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
              ? { duration: 1.6, repeat: Infinity, delay: BAR_DELAYS[i], ease: "easeInOut" }
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
          <motion.div
            key={label}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.06 }}
            className="relative rounded-xl overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${color}08 0%, ${color}03 100%)`, border: `1px solid ${color}28` }}
          >
            <div className="absolute inset-0 rounded-xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}14 0%, transparent 65%)` }} />
            <div className="relative p-4">
              <p className="text-[5px] tracking-[0.55em] mb-3" style={{ color: `${color}70` }}>{label}</p>
              <p className="text-3xl font-black font-mono tabular-nums leading-none" style={{ color, textShadow: `0 0 20px ${color}80, 0 0 40px ${color}40` }}>
                {stats ? <CountUp to={value} prefix={prefix} suffix={suffix} /> : "···"}
              </p>
            </div>
            <motion.div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
              animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2.5 + idx * 0.3, repeat: Infinity }} />
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="rounded-xl p-5 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-600">PLAN DISTRIBUTION</p>
            <div className="flex items-center gap-1.5">
              <motion.div className="h-1 w-1 rounded-full bg-emerald-500" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2.1, repeat: Infinity }} />
              <p className="text-[6px] font-mono text-zinc-700">{total} TOTAL</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-4">
            {PLAN_META.map(({ key, label, color }, i) => {
              const count = stats?.breakdown?.[key] ?? 0;
              const pct   = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[8px] tracking-widest font-medium" style={{ color: `${color}90` }}>{label}</span>
                    <motion.span className="text-xl font-black font-mono" style={{ color, textShadow: `0 0 12px ${color}` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
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
          className="rounded-xl p-5 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[6px] tracking-[0.6em] text-zinc-600">USER FUNNEL</p>
            <span className="text-[6px] font-mono text-zinc-700 tracking-wider">LIVE DATA</span>
          </div>
          <div className="flex-1 flex flex-col justify-around gap-4">
            {funnel.map(({ label, value, pct, color }, i) => (
              <div key={label}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[8px] tracking-widest font-medium" style={{ color: `${color}90` }}>{label}</span>
                  <motion.span className="text-xl font-black font-mono" style={{ color, textShadow: `0 0 12px ${color}` }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }}>
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
          className="rounded-xl p-4 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[6px] tracking-[0.6em] text-zinc-600 mb-3">SYSTEM STATUS</p>
          <div className="flex-1 flex flex-col justify-around">
            {[
              { label: "SUPABASE",   node: "US-EAST-1",  on: true,         dur: 2.3, color: "#10b981" },
              { label: "ANTHROPIC",  node: "API",         on: true,         dur: 3.1, color: "#8b5cf6" },
              { label: "ELEVENLABS", node: "TTS STREAM",  on: elevenlabsOk, dur: 2.7, color: "#3b82f6" },
            ].map(({ label, node, on, dur, color }) => (
              <div key={label} className="flex items-center gap-2">
                <motion.div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: on ? color : "#27272a", boxShadow: on ? `0 0 6px ${color}` : "none" }} animate={on ? { opacity: [0.4, 1, 0.4] } : {}} transition={{ duration: dur, repeat: Infinity }} />
                <span className="text-[8px] tracking-widest text-zinc-600 w-24">{label}</span>
                <div className="flex-1 border-b border-dashed" style={{ borderColor: on ? `${color}18` : "rgba(255,255,255,0.04)" }} />
                <span className="text-[7px] font-mono" style={{ color: on ? color : "#3f3f46" }}>{on ? node : "OFFLINE"}</span>
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
                  <p className="text-[5px] tracking-widest text-zinc-800">{label}</p>
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
  const [barHeights, setBarHeights]     = useState<number[]>([4, 14, 6, 22, 8, 18, 5]);

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
  const transcriptEndRef      = useRef<HTMLDivElement>(null);
  const sendCommandRef        = useRef<(cmd: string) => void>(() => {});

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
    setBarHeights([4, 14, 6, 22, 8, 18, 5]);
  }, []);

  const startAnalyser = useCallback((audioEl: HTMLAudioElement) => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const heights = Array.from({ length: 7 }, (_, i) => {
          const bin = Math.floor((i / 7) * data.length);
          return Math.max(3, Math.min(30, (data[bin] / 255) * 30));
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

    const canMSE = typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");

    if (!canMSE) {
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      speakingRef.current = true;
      startAnalyser(audio);
      audio.onended = () => { speakingRef.current = false; stopAnalyser(); URL.revokeObjectURL(url); audioRef.current = null; onEnd(); };
      audio.play().catch(onEnd);
      return;
    }

    const ms  = new MediaSource();
    mediaSourceRef.current = ms;
    const url  = URL.createObjectURL(ms);
    const audio = new Audio(url);
    audioRef.current = audio;
    speakingRef.current = true;

    const cleanup = () => { speakingRef.current = false; stopAnalyser(); URL.revokeObjectURL(url); audioRef.current = null; mediaSourceRef.current = null; onEnd(); };
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
      streamReaderRef.current = null;
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
      if (!text || text.length < 2) return;

      if (speakingRef.current) {
        // Barge-in: user spoke while Jarvis was talking — stop audio and process new command
        stopAudio();
        setTimeout(() => {
          if (conversationActiveRef.current) {
            processingRef.current = true;
            setLastTranscript(text);
            setCommandCount(c => c + 1);
            sendCommandRef.current(text);
          }
        }, 250);
        return;
      }

      if (processingRef.current) return;

      processingRef.current = true;
      setLastTranscript(text);
      setCommandCount(c => c + 1);
      sendCommandRef.current(text);
    };

    rec.onerror = (e: any) => {
      if (e.error === "aborted") return;
      recognitionRef.current = null;
      if (!processingRef.current && conversationActiveRef.current) {
        setTimeout(() => { if (!processingRef.current && conversationActiveRef.current) startRecognition(); }, 400);
      } else if (!conversationActiveRef.current) {
        setState("idle");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!processingRef.current && conversationActiveRef.current) {
        setTimeout(() => { if (!processingRef.current && conversationActiveRef.current) startRecognition(); }, 200);
      }
    };

    setState("listening");
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
      // Pass conversation history so Jarvis has full session memory
      const history = messages.slice(-20).map(m => ({
        role: m.role === "jarvis" ? "assistant" : "user",
        content: m.text,
      }));

      const res = await fetch("/api/admin/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, history }),
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

  // ── Session toggle ─────────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (conversationActiveRef.current) {
      conversationActiveRef.current = false;
      processingRef.current = false;
      speakingRef.current = false;
      setSessionActive(false);
      sessionStartRef.current = null;
      setSessionElapsed(0);
      setCommandCount(0);
      setLatencies([]);
      if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
      stopAudio();
      setState("idle");
    } else {
      conversationActiveRef.current = true;
      processingRef.current = true;
      setSessionActive(true);
      sessionStartRef.current = Date.now();
      setCommandCount(0);
      setLatencies([]);
      startRecognition();
      setTimeout(() => { if (conversationActiveRef.current) sendCommandRef.current("Brief me on current status."); }, 500);
    }
  }, [startRecognition, stopAudio]);

  // ── Interrupt ──────────────────────────────────────────────────────────────
  const interrupt = useCallback(() => {
    processingRef.current = false;
    if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
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

        <div className="flex items-center gap-3 w-64 shrink-0 justify-end">
          <div className="flex items-center gap-0.5 rounded border border-white/[0.06] p-0.5">
            {(["voice", "data"] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-[7px] tracking-widest font-medium transition-all ${viewMode === mode ? "bg-[#d4a853]/15 text-[#d4a853]" : "text-zinc-700 hover:text-zinc-500"}`}>
                {mode === "voice" ? <Mic className="h-2 w-2" /> : <BarChart3 className="h-2 w-2" />}
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-1.5 rounded border border-white/[0.06] text-zinc-700 hover:text-zinc-400 hover:border-white/[0.12] transition-colors">
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>

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
            <motion.div key="voice" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Left metrics */}
              <div className="w-56 shrink-0 flex flex-col p-4 gap-2" style={{ borderRight: `1px solid ${sessionActive ? c + "18" : "rgba(255,255,255,0.05)"}` }}>
                <p className="text-[6px] tracking-[0.6em] text-zinc-700 mb-1">LIVE METRICS</p>
                {[
                  { label: "TOTAL USERS",   val: stats?.totalUsers ?? null,     n: stats?.totalUsers ?? 0,     color: "#e2e8f0", prefix: "" },
                  { label: "MRR",           val: stats?.mrr ?? null,            n: stats?.mrr ?? 0,            color: "#d4a853", prefix: "$" },
                  { label: "ARR",           val: stats?.arr ?? null,            n: stats?.arr ?? 0,            color: "#d4a853", prefix: "$" },
                  { label: "PAID",          val: stats?.paid ?? null,           n: stats?.paid ?? 0,           color: "#10b981", prefix: "" },
                  { label: "CONVERSION",    val: convRate,                      n: convRate ?? 0,              color: "#d4a853", prefix: "", suffix: "%" },
                  { label: "SIGNUPS TODAY", val: stats?.signupsToday ?? null,   n: stats?.signupsToday ?? 0,   color: "#3b82f6", prefix: "" },
                  { label: "ACTIVE / 7D",   val: stats?.activeLastWeek ?? null, n: stats?.activeLastWeek ?? 0, color: "#10b981", prefix: "" },
                ].map(({ label, val, n, color, prefix, suffix }) => (
                  <div key={label} className="rounded-lg px-3 py-2" style={{ border: `1px solid ${color}18`, background: `linear-gradient(135deg, ${color}06 0%, transparent 100%)` }}>
                    <p className="text-[6px] tracking-[0.4em] mb-0.5" style={{ color: `${color}60` }}>{label}</p>
                    <p className="text-lg font-bold font-mono leading-none tabular-nums" style={{ color, textShadow: `0 0 12px ${color}60` }}>
                      {val !== null ? <CountUp to={n} prefix={prefix} suffix={suffix ?? ""} /> : "···"}
                    </p>
                  </div>
                ))}
                <div className="mt-auto pt-3 border-t border-white/[0.04] space-y-2">
                  <p className="text-[6px] tracking-[0.5em] text-zinc-800 mb-1">CONNECTIONS</p>
                  {[
                    { label: "SUPABASE",   on: true,         dur: 2.3, color: "#10b981" },
                    { label: "ANTHROPIC",  on: true,         dur: 3.1, color: "#8b5cf6" },
                    { label: "ELEVENLABS", on: elevenlabsOk, dur: 2.7, color: "#3b82f6" },
                  ].map(({ label, on, dur, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <motion.div className="h-1 w-1 rounded-full" style={{ backgroundColor: on ? color : "#27272a", boxShadow: on ? `0 0 4px ${color}` : "none" }} animate={on ? { opacity: [0.5, 1, 0.5] } : {}} transition={{ duration: dur, repeat: Infinity }} />
                      <span className="text-[6px] tracking-widest text-zinc-700">{label}</span>
                      <span className="ml-auto text-[6px] tracking-wider" style={{ color: on ? color : "#3f3f46" }}>{on ? "●" : "○"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center orb */}
              <div className="relative flex-1 flex flex-col items-center justify-center">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/[0.02] to-transparent" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
                </div>

                <div className="relative flex items-center justify-center">
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${c}08 0%, transparent 70%)` }}
                    animate={{ width: state === "listening" ? 520 : state === "speaking" ? 500 : 430, height: state === "listening" ? 520 : state === "speaking" ? 500 : 430 }} transition={{ duration: 0.6 }} />

                  <AnimatePresence>
                    {state === "listening" && [0, 0.7, 1.4].map((delay, i) => (
                      <motion.div key={`l${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}40` }} initial={{ width: 150, height: 150, opacity: 1 }} animate={{ width: 440, height: 440, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2.4, delay, repeat: Infinity, ease: "easeOut" }} />
                    ))}
                    {state === "speaking" && [0, 0.55, 1.1].map((delay, i) => (
                      <motion.div key={`s${i}`} className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}35` }} initial={{ width: 165, height: 165, opacity: 0.8 }} animate={{ width: 410, height: 410, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.6, delay, repeat: Infinity, ease: "easeOut" }} />
                    ))}
                    {state === "processing" && (
                      <motion.div key="proc" className="absolute rounded-full border-2 pointer-events-none" style={{ width: 215, height: 215, borderColor: `${c}45`, borderTopColor: "transparent", borderRightColor: "transparent" }} animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    )}
                  </AnimatePresence>

                  <div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}08`, width: 290, height: 290 }} />
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 245, height: 245, border: `1px dashed ${c}18` }} animate={{ rotate: [0, 360] }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ width: 198, height: 198, borderColor: `${c}28`, borderTopColor: "transparent", borderLeftColor: "transparent" }} animate={{ rotate: [360, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "linear" }} />
                  <motion.div className="absolute rounded-full pointer-events-none" style={{ width: 164, height: 164, border: `1px dashed ${c}12` }} animate={{ rotate: [0, -360] }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} />

                  <motion.div className="absolute rounded-full border pointer-events-none" style={{ borderColor: `${c}55` }}
                    animate={{ width: sessionActive ? 152 : 132, height: sessionActive ? 152 : 132, boxShadow: [`0 0 10px ${c}20`, `0 0 32px ${c}40`, `0 0 10px ${c}20`] }}
                    transition={{ width: { duration: 0.4 }, height: { duration: 0.4 }, boxShadow: { duration: 2.2, repeat: Infinity } }} />

                  <motion.div className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
                    animate={{ width: sessionActive ? 130 : 112, height: sessionActive ? 130 : 112 }} transition={{ duration: 0.4 }}
                    style={{ background: `radial-gradient(circle at 36% 30%, ${c}40 0%, ${c}12 50%, transparent 78%)`, boxShadow: `inset 0 0 30px ${c}12, 0 0 40px ${c}22, 0 0 80px ${c}10` }}>
                    <motion.div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from 0deg, transparent, ${c}25, transparent)`, opacity: 0.3 }} animate={{ rotate: [0, 360] }} transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }} />
                    <motion.div className="relative z-10 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 20px ${c}, 0 0 40px ${c}80` }}
                      animate={{ width: state === "speaking" ? 26 : state === "listening" ? 16 : sessionActive ? 11 : 8, height: state === "speaking" ? 26 : state === "listening" ? 16 : sessionActive ? 11 : 8, opacity: state === "idle" && !sessionActive ? 0.35 : 1 }} transition={{ duration: 0.25 }} />
                  </motion.div>
                </div>

                <div className="mt-10 flex flex-col items-center gap-3">
                  <WaveformBars active={state === "listening" || state === "speaking"} color={c} audioHeights={state === "speaking" ? barHeights : undefined} />
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
                  <AnimatePresence>
                    {lastTranscript && (state === "processing" || state === "speaking") && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }} className="text-[9px] font-mono text-zinc-500 max-w-xs text-center">
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

          ) : (
            <motion.div key="data" className="flex h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <DataModeView stats={stats} messages={messages} sessionActive={sessionActive} commandCount={commandCount} sessionElapsed={sessionElapsed} avgLatency={avgLatency} state={state} c={c} elevenlabsOk={elevenlabsOk} />
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
          onClick={state === "speaking" ? interrupt : sessionActive ? (() => {}) : toggleSession}
          className="flex items-center gap-2.5 rounded-full px-8 py-2.5 text-[10px] font-bold tracking-[0.35em] transition-all"
          style={{ backgroundColor: `${c}12`, border: `1px solid ${c}${sessionActive ? "60" : "30"}`, color: c, boxShadow: sessionActive ? `0 0 28px ${c}18, inset 0 0 8px ${c}08` : "none" }}
          whileTap={{ scale: 0.97 }}>
          <AnimatePresence mode="wait">
            {!sessionActive                          && <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.1 }}><Mic className="h-3.5 w-3.5" /></motion.span>}
            {sessionActive && state === "listening"  && <motion.div key="pulse" className="h-3 w-3 rounded-full" style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}` }} animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 0.5, repeat: Infinity }} />}
            {sessionActive && state === "processing" && <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}><div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" /></motion.div>}
            {sessionActive && state === "speaking"   && <motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }}><Square className="h-3 w-3 fill-current" /></motion.span>}
            {sessionActive && state === "idle"       && <motion.div key="breathe" className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />}
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
