"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mic, Square } from "lucide-react";

type JarvisState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  role: "user" | "jarvis";
  text: string;
  ts: Date;
}

interface LiveStats {
  totalUsers: number;
  signupsToday: number;
  activeLastWeek: number;
  paid: number;
  mrr: number;
}

export default function JarvisPage() {
  const [state, setState] = useState<JarvisState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [lastTranscript, setLastTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/jarvis/stats")
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendCommand = useCallback(async (command: string) => {
    setState("processing");
    setMessages(prev => [...prev, { role: "user", text: command, ts: new Date() }]);

    try {
      const res = await fetch("/api/admin/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      const text: string = data.text;
      if (!text) { setState("idle"); return; }

      setMessages(prev => [...prev, { role: "jarvis", text, ts: new Date() }]);
      setState("speaking");

      const audioRes = await fetch("/api/admin/jarvis/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (audioRes.ok) {
        const blob = await audioRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setState("idle"); URL.revokeObjectURL(url); };
        audio.play().catch(() => setState("idle"));
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }, []);

  const startListening = useCallback(() => {
    if (state !== "idle") return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice recognition requires Chrome or Edge.");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setState("listening");
    recognition.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript;
      setLastTranscript(text);
      recognition.stop();
      sendCommand(text);
    };
    recognition.onerror = () => setState("idle");
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };

    recognition.start();
  }, [state, sendCommand]);

  const interrupt = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
  }, []);

  const c = {
    idle:       "#d4a853",
    listening:  "#3b82f6",
    processing: "#8b5cf6",
    speaking:   "#10b981",
  }[state];

  const label = {
    idle:       "AWAITING COMMAND",
    listening:  "LISTENING · · ·",
    processing: "PROCESSING REQUEST",
    speaking:   "JARVIS SPEAKING",
  }[state];

  const btnLabel = {
    idle:       "ACTIVATE JARVIS",
    listening:  "STOP LISTENING",
    processing: "PROCESSING",
    speaking:   "INTERRUPT",
  }[state];

  const corners = [
    "top-6 left-6 border-t border-l",
    "top-6 right-6 border-t border-r",
    "bottom-6 left-6 border-b border-l",
    "bottom-6 right-6 border-b border-r",
  ];

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black text-white select-none">

      {/* Hex grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='104'%3E%3Cpolygon points='30,2 58,17 58,47 30,62 2,47 2,17' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3Cpolygon points='30,62 58,77 58,107 30,122 2,107 2,77' fill='none' stroke='%23d4a853' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "60px 104px",
        }}
      />

      {/* Scanline */}
      <motion.div
        className="pointer-events-none absolute left-0 right-0 z-10 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${c}20, transparent)` }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,0,0.65) 100%)" }}
      />

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-white/[0.05] px-8 py-4">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-[10px] tracking-widest text-zinc-700 transition-colors hover:text-zinc-400"
        >
          <ArrowLeft className="h-3 w-3" />
          ADMIN
        </Link>

        <div className="text-center">
          <p className="text-xl font-bold tracking-[0.8em] text-white">J A R V I S</p>
          <p className="text-[7px] tracking-[0.5em] text-zinc-700 mt-0.5">CINEFLOW INTELLIGENCE SYSTEM</p>
        </div>

        <div className="flex items-center gap-2">
          <motion.div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }}
            animate={{ opacity: state === "idle" ? [0.4, 1, 0.4] : 1 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.span
            key={state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[9px] tracking-[0.4em] font-medium tabular-nums"
            style={{ color: c }}
          >
            {state.toUpperCase()}
          </motion.span>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex h-full w-full pt-[64px] pb-[72px]">

        {/* Left: metrics */}
        <div className="w-60 shrink-0 border-r border-white/[0.05] flex flex-col p-5 gap-2.5">
          <p className="text-[7px] tracking-[0.6em] text-zinc-700 mb-1">LIVE METRICS</p>

          {[
            { label: "TOTAL USERS",     value: stats ? stats.totalUsers.toLocaleString()  : "···" },
            { label: "MONTHLY REVENUE", value: stats ? `$${stats.mrr.toLocaleString()}`   : "···" },
            { label: "PAID ACCOUNTS",   value: stats ? stats.paid.toLocaleString()         : "···" },
            { label: "SIGNUPS TODAY",   value: stats ? stats.signupsToday.toString()       : "·" },
            { label: "ACTIVE / 7 DAYS", value: stats ? stats.activeLastWeek.toLocaleString() : "···" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
              <p className="text-[6px] tracking-[0.5em] text-zinc-700 mb-1">{label}</p>
              <p className="text-xl font-bold font-mono text-white leading-none">{value}</p>
            </div>
          ))}

          <div className="mt-auto pt-4 border-t border-white/[0.05] space-y-2">
            {[
              { label: "SUPABASE",   on: true },
              { label: "ANTHROPIC",  on: true },
              { label: "ELEVENLABS", on: !!stats },
            ].map(({ label, on }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`h-1 w-1 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-800"}`} />
                <span className="text-[7px] tracking-widest text-zinc-700">{label}</span>
                <span className="ml-auto text-[6px] tracking-widest text-zinc-800">{on ? "ONLINE" : "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: orb */}
        <div className="relative flex-1 flex flex-col items-center justify-center">
          {corners.map((cls, i) => (
            <div key={i} className={`absolute ${cls} border-[#d4a853]/10 h-10 w-10`} />
          ))}

          {/* Reticle lines */}
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-[#d4a853]/05 to-transparent" />
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#d4a853]/05 to-transparent" />

          {/* ORB */}
          <div className="relative flex items-center justify-center">

            {/* Ambient glow */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${c}07 0%, transparent 70%)` }}
              animate={{
                width:  state === "listening" ? 440 : state === "speaking" ? 420 : 380,
                height: state === "listening" ? 440 : state === "speaking" ? 420 : 380,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            {/* Pulse rings */}
            <AnimatePresence>
              {state === "listening" && [0, 0.6, 1.2].map((delay, i) => (
                <motion.div
                  key={`l${i}`}
                  className="absolute rounded-full border pointer-events-none"
                  style={{ borderColor: `${c}35` }}
                  initial={{ width: 150, height: 150, opacity: 0.9 }}
                  animate={{ width: 380, height: 380, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.2, delay, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
              {state === "speaking" && [0, 0.45, 0.9].map((delay, i) => (
                <motion.div
                  key={`s${i}`}
                  className="absolute rounded-full border pointer-events-none"
                  style={{ borderColor: `${c}28` }}
                  initial={{ width: 170, height: 170, opacity: 0.7 }}
                  animate={{ width: 360, height: 360, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, delay, repeat: Infinity, ease: "easeOut" }}
                />
              ))}
              {state === "processing" && (
                <motion.div
                  key="proc-ring"
                  className="absolute rounded-full border-2 pointer-events-none"
                  style={{
                    width: 210, height: 210,
                    borderColor: `${c}40`,
                    borderTopColor: "transparent",
                    borderRightColor: "transparent",
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
              )}
            </AnimatePresence>

            {/* Ring: outermost static */}
            <div
              className="absolute rounded-full border pointer-events-none"
              style={{ borderColor: `${c}06`, width: 270, height: 270 }}
            />

            {/* Ring: slow clockwise dash */}
            <motion.div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 220, height: 220,
                border: `1px dashed ${c}18`,
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />

            {/* Ring: faster counter-clockwise solid */}
            <motion.div
              className="absolute rounded-full border pointer-events-none"
              style={{
                width: 178, height: 178,
                borderColor: `${c}22`,
                borderTopColor: "transparent",
                borderLeftColor: "transparent",
              }}
              animate={{ rotate: [360, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />

            {/* Inner glow ring */}
            <motion.div
              className="absolute rounded-full border pointer-events-none"
              style={{ borderColor: `${c}45` }}
              animate={{
                width:  state === "idle" ? 132 : 148,
                height: state === "idle" ? 132 : 148,
                boxShadow: [`0 0 8px ${c}18`, `0 0 22px ${c}30`, `0 0 8px ${c}18`],
              }}
              transition={{
                width:     { duration: 0.4 },
                height:    { duration: 0.4 },
                boxShadow: { duration: 2.5, repeat: Infinity },
              }}
            />

            {/* Core sphere */}
            <motion.div
              className="relative z-10 rounded-full flex items-center justify-center overflow-hidden"
              animate={{
                width:  state === "idle" ? 112 : 128,
                height: state === "idle" ? 112 : 128,
              }}
              transition={{ duration: 0.4 }}
              style={{
                background: `radial-gradient(circle at 38% 32%, ${c}35 0%, ${c}10 50%, transparent 78%)`,
                boxShadow: `inset 0 0 28px ${c}10, 0 0 35px ${c}18`,
              }}
            >
              {/* Shimmer sweep */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(from 0deg, transparent, ${c}22, transparent)`, opacity: 0.25 }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              />

              {/* Core dot */}
              <motion.div
                className="relative z-10 rounded-full"
                style={{ backgroundColor: c, boxShadow: `0 0 14px ${c}` }}
                animate={{
                  width:   state === "speaking" ? 20 : state === "listening" ? 14 : 8,
                  height:  state === "speaking" ? 20 : state === "listening" ? 14 : 8,
                  opacity: state === "idle" ? 0.45 : 1,
                }}
                transition={{ duration: 0.35 }}
              />
            </motion.div>
          </div>

          {/* State label */}
          <div className="mt-14 flex h-10 flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={state}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-[10px] font-semibold tracking-[0.6em]"
                style={{ color: c }}
              >
                {label}
              </motion.p>
            </AnimatePresence>

            <AnimatePresence>
              {lastTranscript && state !== "idle" && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  className="mt-2 text-[10px] font-mono text-zinc-600 max-w-xs text-center"
                >
                  &ldquo;{lastTranscript}&rdquo;
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: transcript */}
        <div className="w-72 shrink-0 border-l border-white/[0.05] flex flex-col p-5">
          <p className="text-[7px] tracking-[0.6em] text-zinc-700 mb-4">COMMAND LOG</p>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
                <div className="h-10 w-10 rounded-full border border-[#d4a853]/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-[#d4a853]/15" />
                </div>
                <div>
                  <p className="text-[8px] tracking-[0.4em] text-zinc-700 mb-3">SAMPLE COMMANDS</p>
                  {[
                    '"How many users do we have?"',
                    '"What\'s our MRR right now?"',
                    '"Read me the latest feedback"',
                    '"Send a broadcast to all users"',
                    '"List all feature flags"',
                  ].map(ex => (
                    <p key={ex} className="text-[9px] font-mono text-zinc-800 mb-1.5">{ex}</p>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === "user" ? 8 : -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className={`text-[7px] tracking-widest mb-1 ${msg.role === "user" ? "text-zinc-700" : "text-[#d4a853]/40"}`}>
                    {msg.role === "user" ? "KENNY" : "JARVIS"}{" · "}
                    {msg.ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <div
                    className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-white/[0.025] border border-white/[0.05] text-zinc-400"
                        : "bg-[#d4a853]/[0.04] border border-[#d4a853]/10 text-zinc-300"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center border-t border-white/[0.05] px-8 py-4">
        <motion.button
          onClick={state === "idle" ? startListening : interrupt}
          disabled={state === "processing"}
          className="flex items-center gap-3 rounded-full px-10 py-3 text-[11px] font-bold tracking-[0.35em] transition-colors disabled:pointer-events-none disabled:opacity-30"
          style={{
            backgroundColor: `${c}12`,
            border: `1px solid ${c}${state !== "idle" ? "55" : "28"}`,
            color: c,
            boxShadow: state !== "idle" ? `0 0 28px ${c}14` : "none",
          }}
          whileTap={{ scale: 0.97 }}
        >
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.span key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.12 }}>
                <Mic className="h-4 w-4" />
              </motion.span>
            )}
            {state === "listening" && (
              <motion.div
                key="pulse"
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: c }}
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
            {state === "processing" && (
              <motion.div key="spin" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}>
                <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
              </motion.div>
            )}
            {state === "speaking" && (
              <motion.span key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.12 }}>
                <Square className="h-3.5 w-3.5 fill-current" />
              </motion.span>
            )}
          </AnimatePresence>
          {btnLabel}
        </motion.button>

        <p className="absolute right-8 text-[7px] tracking-widest text-zinc-800">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}
