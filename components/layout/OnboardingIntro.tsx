"use client";

import { useEffect, useState, useCallback } from "react";
import { Film, ListChecks, Layers, UploadCloud, X, ArrowRight } from "lucide-react";

const STORAGE_KEY = "cf_onboarded";
const TRANSITION_MS = 500;

const FRAMES = [
  {
    id: "welcome",
    eyebrow: "WELCOME TO",
    headline: "Cineflow",
    headlineGold: "flow",
    sub: "The production platform built for filmmakers who move fast.",
    icon: Film,
    cta: false,
  },
  {
    id: "projects",
    eyebrow: "MANAGE YOUR WORK",
    headline: "Every project.\nOne place.",
    headlineGold: null,
    sub: "Track productions from first frame to final delivery — clients, timelines, and team all in sync.",
    icon: ListChecks,
    cta: false,
  },
  {
    id: "tools",
    eyebrow: "BUILT-IN TOOLS",
    headline: "Shot lists.\nStoryboards. Revisions.",
    headlineGold: null,
    sub: "Everything your creative workflow needs — no extra apps, no extra tabs.",
    icon: Layers,
    cta: false,
  },
  {
    id: "ready",
    eyebrow: "YOU'RE IN EARLY",
    headline: "Your slate\nis ready.",
    headlineGold: null,
    sub: "Shape what Cineflow becomes. Your feedback builds the product.",
    icon: UploadCloud,
    cta: true,
  },
];

interface OnboardingIntroProps {
  onDone?: () => void;
}

export function OnboardingIntro({ onDone }: OnboardingIntroProps) {
  const [visible, setVisible] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
    const t = setTimeout(() => setOverlayVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    localStorage.setItem(STORAGE_KEY, "1");
    setOverlayVisible(false);
    setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 700);
  }, [onDone]);

  const goNext = useCallback(() => {
    if (frameIdx >= FRAMES.length - 1) { dismiss(); return; }
    setContentVisible(false);
    setTimeout(() => {
      setFrameIdx((i) => i + 1);
      setTimeout(() => setContentVisible(true), 80);
    }, TRANSITION_MS);
  }, [frameIdx, dismiss]);

  if (!visible) return null;

  const frame = FRAMES[frameIdx];
  const Icon = frame.icon;
  const isLast = frameIdx === FRAMES.length - 1;

  const renderHeadline = () => {
    if (!frame.headlineGold) {
      return frame.headline.split("\n").map((line, i) => (
        <span key={i} className={i === 1 ? "text-white/30" : "text-white"}>
          {line}{i < frame.headline.split("\n").length - 1 && <br />}
        </span>
      ));
    }
    const before = frame.headline.replace(frame.headlineGold, "");
    return (
      <>
        <span className="text-white">{before}</span>
        <span className="text-[#d4a853]">{frame.headlineGold}</span>
      </>
    );
  };

  return (
    <>
      <style>{`
        @keyframes cf-rise {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cf-pop {
          0%   { opacity: 0; transform: scale(0.75) rotate(-8deg); }
          65%  { transform: scale(1.06) rotate(1deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes cf-scan {
          0%   { transform: translateX(-200px); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(110vw); opacity: 0; }
        }
        @keyframes cf-glow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        .cf-rise { animation: cf-rise 0.65s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .cf-pop  { animation: cf-pop  0.6s  cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .cf-scan-line {
          position: absolute; height: 1px; width: 180px; top: 42%;
          background: linear-gradient(to right, transparent, rgba(212,168,83,0.45), transparent);
          animation: cf-scan 5s ease-in-out infinite;
        }
        .cf-glow-1 { animation: cf-glow 3.5s ease-in-out infinite; }
        .cf-glow-2 { animation: cf-glow 3.5s ease-in-out 1.6s infinite; }
      `}</style>

      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#050505]"
        style={{
          opacity: overlayVisible ? 1 : 0,
          transition: `opacity ${exiting ? 700 : 450}ms cubic-bezier(.4,0,.2,1)`,
          pointerEvents: exiting ? "none" : "auto",
        }}
      >
        {/* Ambient glows */}
        <div className="cf-glow-1 pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[#d4a853]/[0.07] blur-[140px]" />
        <div className="cf-glow-2 pointer-events-none absolute -bottom-32 -right-32 h-[480px] w-[480px] rounded-full bg-[#d4a853]/[0.05] blur-[120px]" />

        {/* Scan line */}
        <div className="cf-scan-line" />

        {/* Skip */}
        <button
          onClick={dismiss}
          className="absolute right-5 top-5 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/35 backdrop-blur-sm transition-all hover:border-white/20 hover:text-white/60"
        >
          <X className="h-3 w-3" />
          Skip intro
        </button>

        {/* Step dots */}
        <div className="absolute top-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
          {FRAMES.map((f, i) => (
            <div
              key={f.id}
              className="rounded-full transition-all duration-500 ease-out"
              style={{
                width: i === frameIdx ? 22 : 5,
                height: 5,
                background:
                  i < frameIdx
                    ? "rgba(212,168,83,0.35)"
                    : i === frameIdx
                    ? "#d4a853"
                    : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        {/* Content block — cross-fades as one unit */}
        <div
          className="flex w-full max-w-[500px] flex-col items-center px-8 text-center"
          style={{
            opacity: contentVisible ? 1 : 0,
            transform: contentVisible ? "translateY(0)" : "translateY(12px)",
            transition: `opacity ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1), transform ${TRANSITION_MS}ms cubic-bezier(.4,0,.2,1)`,
          }}
        >
          {/* Icon */}
          <div
            key={`icon-${frameIdx}`}
            className="cf-pop mb-8 flex h-[72px] w-[72px] items-center justify-center rounded-[18px] border border-[#d4a853]/20 bg-[#d4a853]/10"
          >
            <Icon className="h-9 w-9 text-[#d4a853]" />
          </div>

          {/* Eyebrow */}
          <p
            key={`ey-${frameIdx}`}
            className="cf-rise mb-3 text-[10px] font-bold tracking-[0.42em] text-[#d4a853]/55"
            style={{ animationDelay: "90ms" }}
          >
            {frame.eyebrow}
          </p>

          {/* Headline */}
          <h1
            key={`h-${frameIdx}`}
            className="cf-rise font-display text-[2.6rem] font-bold leading-tight tracking-tight sm:text-5xl"
            style={{ animationDelay: "160ms" }}
          >
            {renderHeadline()}
          </h1>

          {/* Body */}
          <p
            key={`sub-${frameIdx}`}
            className="cf-rise mt-5 max-w-[360px] text-sm leading-relaxed text-white/38"
            style={{ animationDelay: "240ms" }}
          >
            {frame.sub}
          </p>

          {/* CTA button */}
          <button
            key={`btn-${frameIdx}`}
            onClick={goNext}
            className="cf-rise mt-10 flex items-center gap-2.5 rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black shadow-lg transition-all hover:bg-[#c9a040] hover:shadow-[0_0_28px_rgba(212,168,83,0.3)] active:scale-[0.97]"
            style={{ animationDelay: "310ms" }}
          >
            {isLast ? "Enter Cineflow" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>

          <p
            className="cf-rise mt-4 text-[11px] tabular-nums text-white/18"
            style={{ animationDelay: "360ms" }}
          >
            {frameIdx + 1} / {FRAMES.length}
          </p>
        </div>

        {/* Film grain */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ opacity: 0.05, mixBlendMode: "overlay" }}
        >
          <defs>
            <filter id="og">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#og)" />
        </svg>
      </div>
    </>
  );
}
