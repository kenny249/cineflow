"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";

export function MobileSplash() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show on first load per session
    const key = "cf_splashed";
    if (sessionStorage.getItem(key)) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem(key, "1");

    const fadeTimer = setTimeout(() => setFadeOut(true), 1600);
    const hideTimer = setTimeout(() => setVisible(false), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background transition-opacity duration-500 md:hidden ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(212,168,83,0.12),transparent_70%)]" />

      {/* Film strip top */}
      <div className="absolute top-0 left-0 right-0 h-8 flex overflow-hidden opacity-20">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex h-full shrink-0 items-center gap-1 px-1">
            <div className="h-4 w-3 rounded-sm border border-white/30 bg-white/5" />
          </div>
        ))}
      </div>

      {/* Logo */}
      <div
        className="relative flex flex-col items-center gap-3"
        style={{ animation: "splashRise 0.6s cubic-bezier(0.22,1,0.36,1) forwards" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/12 shadow-[0_0_40px_rgba(212,168,83,0.3)]">
          <Film className="h-7 w-7 text-[#d4a853]" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="font-display text-xl font-bold tracking-[0.15em] text-foreground">
            CINEFLOW
          </span>
          <span className="text-[10px] font-medium tracking-[0.3em] text-[#d4a853] uppercase">
            Studio Platform
          </span>
        </div>
      </div>

      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#d4a853]/40 to-transparent"
        style={{ animation: "scanLine 1.2s ease-in-out forwards" }}
      />

      {/* Film strip bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-8 flex overflow-hidden opacity-20">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex h-full shrink-0 items-center gap-1 px-1">
            <div className="h-4 w-3 rounded-sm border border-white/30 bg-white/5" />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes splashRise {
          from { opacity: 0; transform: translateY(20px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scanLine {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
