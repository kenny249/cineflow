"use client";

import { useState, useCallback } from "react";
import { ArrowLeftRight, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Frame rate config ─────────────────────────────────────────────────────────

const FRAME_RATES = [
  { label: "23.976", fps: 23.976, nominal: 24, df: false },
  { label: "24",     fps: 24,     nominal: 24, df: false },
  { label: "25",     fps: 25,     nominal: 25, df: false },
  { label: "29.97",  fps: 29.97,  nominal: 30, df: false },
  { label: "29.97df",fps: 29.97,  nominal: 30, df: true  },
  { label: "30",     fps: 30,     nominal: 30, df: false },
  { label: "50",     fps: 50,     nominal: 50, df: false },
  { label: "59.94",  fps: 59.94,  nominal: 60, df: false },
  { label: "60",     fps: 60,     nominal: 60, df: false },
] as const;

type FpsKey = typeof FRAME_RATES[number]["label"];

// ── Timecode math ─────────────────────────────────────────────────────────────

function tcToFrames(tc: string, nominal: number, df: boolean): number {
  const parts = tc.replace(/[;,]/g, ":").split(":");
  const [hh, mm, ss, ff] = parts.map((p) => parseInt(p, 10) || 0);

  if (!df) {
    return ((hh * 3600 + mm * 60 + ss) * nominal) + ff;
  }
  // Drop-frame: 2 frames dropped per minute except every 10th
  const dropPerMin = nominal === 30 ? 2 : 4;
  const totalMins = 60 * hh + mm;
  return (
    nominal * 3600 * hh +
    nominal * 60 * mm +
    nominal * ss +
    ff -
    dropPerMin * (totalMins - Math.floor(totalMins / 10))
  );
}

function framesToTc(totalFrames: number, nominal: number, df: boolean): string {
  const frames = Math.max(0, totalFrames);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");

  if (!df) {
    const ff = frames % nominal;
    const totalSecs = Math.floor(frames / nominal);
    const ss = totalSecs % 60;
    const mm = Math.floor(totalSecs / 60) % 60;
    const hh = Math.floor(totalSecs / 3600);
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
  }

  // Drop-frame reconstruction
  const dropPerMin = nominal === 30 ? 2 : 4;
  const framesPerMin   = nominal * 60 - dropPerMin;
  const framesPer10Min = nominal * 60 * 10 - dropPerMin * 9;
  const framesPerhour  = framesPer10Min * 6;

  let rem = frames;
  const hh = Math.floor(rem / framesPerhour);
  rem -= hh * framesPerhour;
  const tenMins = Math.floor(rem / framesPer10Min);
  rem -= tenMins * framesPer10Min;
  const mins = tenMins === 0 ? 0 : Math.floor((rem - dropPerMin) / framesPerMin) + 1;
  rem -= mins === 0 ? 0 : dropPerMin + (mins - 1) * framesPerMin;
  const mm = tenMins * 10 + mins;
  const ss = Math.floor(rem / nominal);
  const ff = rem % nominal;
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")};${String(ff).padStart(2,"0")}`;
}

function secondsToTc(secs: number, nominal: number, df: boolean): string {
  return framesToTc(Math.round(secs * nominal), nominal, df);
}

// ── Timecode input ────────────────────────────────────────────────────────────

function TcInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow digits, backspace, delete, arrows, tab, colon/semicolon
    const allowed = /^[0-9:;,]$/.test(e.key) || ["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key);
    if (!allowed) e.preventDefault();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value.replace(/[^0-9:;]/g, "");
    // Auto-insert colons
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length <= 8) {
      const formatted = digits.replace(/(\d{2})(?=\d)/g, "$1:").slice(0, 11);
      onChange(formatted);
    } else {
      onChange(raw.slice(0, 11));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{label}</label>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="00:00:00:00"
        maxLength={11}
        className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 font-mono text-2xl text-center text-foreground tracking-widest focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 placeholder:text-muted-foreground/20 transition-colors"
        spellCheck={false}
      />
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

function ResultCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn("text-base font-semibold text-foreground break-all", mono && "font-mono tracking-wide")}>{value}</p>
    </div>
  );
}

// ── Convert tab ───────────────────────────────────────────────────────────────

function ConvertTab({ fps, nominal, df }: { fps: number; nominal: number; df: boolean }) {
  const [mode, setMode] = useState<"tc" | "frames" | "seconds">("tc");
  const [input, setInput] = useState("");

  const result = useCallback(() => {
    if (!input.trim()) return null;
    if (mode === "tc") {
      const totalFrames = tcToFrames(input, nominal, df);
      const totalSecs   = totalFrames / fps;
      const ms          = Math.round((totalSecs % 1) * 1000);
      return {
        frames:  totalFrames.toLocaleString(),
        seconds: totalSecs.toFixed(3) + "s",
        ms:      `${Math.floor(totalSecs * 1000).toLocaleString()} ms`,
        realtime:`${String(Math.floor(totalSecs / 3600)).padStart(2,"0")}:${String(Math.floor(totalSecs / 60) % 60).padStart(2,"0")}:${String(Math.floor(totalSecs % 60)).padStart(2,"0")}.${String(ms).padStart(3,"0")}`,
      };
    }
    if (mode === "frames") {
      const f = parseInt(input, 10);
      if (isNaN(f)) return null;
      const totalSecs = f / fps;
      return {
        timecode: framesToTc(f, nominal, df),
        seconds:  totalSecs.toFixed(3) + "s",
        ms:       `${Math.floor(totalSecs * 1000).toLocaleString()} ms`,
      };
    }
    // seconds
    const s = parseFloat(input);
    if (isNaN(s)) return null;
    const totalFrames = Math.round(s * fps);
    return {
      timecode: secondsToTc(s, nominal, df),
      frames:   totalFrames.toLocaleString(),
      ms:       `${Math.round(s * 1000).toLocaleString()} ms`,
    };
  }, [input, mode, fps, nominal, df]);

  const res = result();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-muted/30 w-fit">
        {(["tc", "frames", "seconds"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setInput(""); }}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "tc" ? "Timecode" : m === "frames" ? "Frames" : "Seconds"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {mode === "tc" ? "Timecode" : mode === "frames" ? "Frame Number" : "Duration (seconds)"}
        </label>
        <input
          type={mode === "tc" ? "text" : "number"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "tc" ? "00:00:00:00" : mode === "frames" ? "0" : "0.000"}
          className="w-full rounded-xl border border-border bg-muted/30 px-4 py-3 font-mono text-2xl text-center text-foreground tracking-widest focus:outline-none focus:ring-1 focus:ring-[#d4a853]/40 focus:border-[#d4a853]/40 placeholder:text-muted-foreground/20 transition-colors"
          spellCheck={false}
        />
      </div>

      {res && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(res).map(([k, v]) => (
            <ResultCard key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v as string} mono />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimecodeCalc() {
  const [fpsKey, setFpsKey]   = useState<FpsKey>("23.976");
  const [tab, setTab]         = useState<"calc" | "convert">("calc");
  const [op, setOp]           = useState<"add" | "sub">("add");
  const [tcA, setTcA]         = useState("");
  const [tcB, setTcB]         = useState("");

  const fpsConfig = FRAME_RATES.find((f) => f.label === fpsKey) ?? FRAME_RATES[0];
  const { fps, nominal, df } = fpsConfig;

  const result = useCallback(() => {
    if (!tcA.trim() || !tcB.trim()) return null;
    const fa = tcToFrames(tcA, nominal, df);
    const fb = tcToFrames(tcB, nominal, df);
    const fr = op === "add" ? fa + fb : Math.max(0, fa - fb);
    const totalSecs = fr / fps;
    return {
      tc:      framesToTc(fr, nominal, df),
      frames:  fr.toLocaleString(),
      seconds: totalSecs.toFixed(3),
      ms:      Math.floor(totalSecs * 1000).toLocaleString(),
    };
  }, [tcA, tcB, op, fps, nominal, df]);

  const res = result();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Frame rate selector */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Frame Rate</p>
        <div className="flex flex-wrap gap-1.5">
          {FRAME_RATES.map((fr) => (
            <button key={fr.label} onClick={() => setFpsKey(fr.label)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all",
                fpsKey === fr.label
                  ? "bg-[#d4a853]/15 border-[#d4a853]/40 text-[#d4a853]"
                  : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border/80"
              )}
            >
              {fr.label}
            </button>
          ))}
        </div>
        {df && (
          <p className="text-[10px] text-amber-400/70">Drop frame — frame numbers 0 and 1 are skipped at the start of each minute (except every 10th)</p>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-muted/30 w-fit">
        {(["calc", "convert"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "calc" ? "Add / Subtract" : "Convert"}
          </button>
        ))}
      </div>

      {tab === "convert" ? (
        <ConvertTab fps={fps} nominal={nominal} df={df} />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Inputs */}
          <TcInput label="Timecode A" value={tcA} onChange={setTcA} />

          {/* Operation toggle */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="flex gap-1 p-0.5 rounded-lg border border-border bg-muted/30">
              <button onClick={() => setOp("add")}
                className={cn("flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  op === "add" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Plus className="h-3 w-3" /> Add
              </button>
              <button onClick={() => setOp("sub")}
                className={cn("flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  op === "sub" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Minus className="h-3 w-3" /> Subtract
              </button>
            </div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <TcInput label="Timecode B" value={tcB} onChange={setTcB} />

          {/* Result */}
          {res ? (
            <div className="rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/5 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#d4a853]" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#d4a853]/70">Result</p>
              </div>
              <p className="font-mono text-3xl font-bold text-foreground tracking-wider">{res.tc}</p>
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#d4a853]/10">
                <ResultCard label="Frames"  value={res.frames}          mono />
                <ResultCard label="Seconds" value={res.seconds + "s"}   mono />
                <ResultCard label="Ms"      value={res.ms + " ms"}      mono />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-8 text-center">
              <p className="text-xs text-muted-foreground/40">Enter both timecodes to see the result</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
