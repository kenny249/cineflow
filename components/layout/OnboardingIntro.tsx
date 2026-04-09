"use client";

import { useEffect, useState } from "react";
import { Film, ListChecks, Layers, UploadCloud, X, ChevronRight } from "lucide-react";

const STORAGE_KEY = "cf_onboarded";

const FRAMES = [
  {
    id: "welcome",
    eyebrow: "WELCOME TO",
    headline: "Cineflow",
    sub: "The production platform built for filmmakers who move fast.",
    icon: Film,
    accent: true,
  },
  {
    id: "projects",
    eyebrow: "MANAGE YOUR WORK",
    headline: "Every project. One place.",
    sub: "Track productions from first frame to final delivery — clients, timelines, and team all in sync.",
    icon: ListChecks,
    accent: false,
  },
  {
    id: "tools",
    eyebrow: "BUILT-IN TOOLS",
    headline: "Shot lists. Storyboards. Revisions.",
    sub: "Everything your creative workflow needs — no extra apps, no extra tabs.",
    icon: Layers,
    accent: false,
  },
  {
    id: "ready",
    eyebrow: "BETA ACCESS",
    headline: "Your slate is ready.",
    sub: "You're in early. Shape what Cineflow becomes.",
    icon: UploadCloud,
    accent: true,
    cta: true,
  },
];

const FRAME_DURATION = 1400; // ms per frame
const FADE_DURATION = 400;   // ms crossfade

interface OnboardingIntroProps {
  onDone?: () => void;
}

export function OnboardingIntro({ onDone }: OnboardingIntroProps) {
  const [visible, setVisible] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Small delay so the page has rendered behind it
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (frameIdx >= FRAMES.length - 1) {
      // On last frame, auto-dismiss after its duration
      const t = setTimeout(dismiss, FRAME_DURATION + FADE_DURATION);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => advance(), FRAME_DURATION);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, frameIdx]);

  const advance = () => {
    setFading(true);
    setTimeout(() => {
      setFrameIdx((i) => i + 1);
      setFading(false);
    }, FADE_DURATION);
  };

  const dismiss = () => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, "1");
    setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 600);
  };

  if (!visible) return null;

  const frame = FRAMES[frameIdx];
  const Icon = frame.icon;
  const progress = ((frameIdx + 1) / FRAMES.length) * 100;

  return (
    <>
      <style>{`
        @keyframes introRise {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes introScale {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes introPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,168,83,0); }
          50%       { box-shadow: 0 0 28px 6px rgba(212,168,83,0.18); }
        }
        @keyframes scanH {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100vw); }
        }
        @keyframes progressIn {
          from { width: 0%; }
          to   { width: var(--target-w); }
        }
        .intro-rise  { animation: introRise  0.55s cubic-bezier(.22,1,.36,1) both; }
        .intro-scale { animation: introScale 0.5s cubic-bezier(.22,1,.36,1) both; }
        .intro-pulse { animation: introPulse 2.4s ease-in-out infinite; }
        .scan-h {
          position: absolute; top: 40%; left: 0;
          width: 120px; height: 1px;
          background: linear-gradient(to right, transparent, rgba(212,168,83,0.4), transparent);
          animation: scanH 2.8s linear infinite;
        }
      `}</style>

      {/* Full-screen backdrop */}
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#060606]"
        style={{
          transition: `opacity 0.6s ease`,
          opacity: exiting ? 0 : 1,
        }}
      >
        {/* Ambient corner glows */}
        <div className="pointer-events-none absolute left-0 top-0 h-80 w-80 rounded-full bg-[#d4a853]/[0.06] blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#d4a853]/[0.04] blur-[100px]" />

        {/* Horizontal scan line */}
        <div className="scan-h" />

        {/* Skip button */}
        <button
          onClick={dismiss}
          className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/40 backdrop-blur-sm transition hover:text-white/70"
        >
          <X className="h-3 w-3" />
          Skip
        </button>

        {/* Progress dots */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {FRAMES.map((f, i) => (
            <div
              key={f.id}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === frameIdx ? 24 : 6,
                background: i <= frameIdx ? "#d4a853" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>

        {/* Frame content */}
        <div
          className="flex flex-col items-center px-8 text-center"
          style={{
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_DURATION}ms ease`,
            maxWidth: 520,
          }}
        >
          {/* Icon */}
          <div
            key={`icon-${frameIdx}`}
            className="intro-scale intro-pulse mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#d4a853]/20 bg-[#d4a853]/10"
            style={{ animationDelay: "0ms" }}
          >
            <Icon className="h-8 w-8 text-[#d4a853]" />
          </div>

          {/* Eyebrow */}
          <p
            key={`eyebrow-${frameIdx}`}
            className="intro-rise mb-2 text-[10px] font-bold tracking-[0.35em] text-[#d4a853]/70"
            style={{ animationDelay: "60ms" }}
          >
            {frame.eyebrow}
          </p>

          {/* Headline */}
          <h1
            key={`h1-${frameIdx}`}
            className="intro-rise font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
            style={{ animationDelay: "120ms" }}
          >
            {frame.accent ? (
              <>
                {frame.headline.split("Cineflow")[0]}
                <span className="text-[#d4a853]">Cineflow</span>
                {frame.headline.split("Cineflow")[1]}
              </>
            ) : (
              frame.headline
            )}
          </h1>

          {/* Sub */}
          <p
            key={`sub-${frameIdx}`}
            className="intro-rise mt-4 text-sm leading-relaxed text-white/50"
            style={{ animationDelay: "200ms" }}
          >
            {frame.sub}
          </p>

          {/* CTA on last frame */}
          {frame.cta && (
            <button
              key="cta"
              onClick={dismiss}
              className="intro-rise mt-8 flex items-center gap-2 rounded-xl bg-[#d4a853] px-6 py-3 text-sm font-bold text-black transition hover:bg-[#d4a853]/90"
              style={{ animationDelay: "320ms" }}
            >
              Enter Cineflow
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Bottom progress bar */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/5">
          <div
            className="h-full bg-[#d4a853]/60 transition-all"
            style={{
              width: `${progress}%`,
              transition: `width ${FRAME_DURATION}ms linear`,
            }}
          />
        </div>

        {/* Film grain overlay */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: 0.06, mixBlendMode: "overlay" }}
        >
          <defs>
            <filter id="intro-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#intro-grain)" />
        </svg>
      </div>
    </>
  );
}
