"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ShowcaseFeature {
  label: string;
  h: string;
  sub: string;
  note: string;
  img: string;
  imgAlt: string;
  imgHeight: number;
}

interface ShowcaseCategory {
  key: string;
  label: string;
  features: readonly ShowcaseFeature[];
}

const CATEGORIES: readonly ShowcaseCategory[] = [
  {
    key: "production",
    label: "Production",
    features: [
      {
        label: "Shot Lists",
        h: "Your whole production. One view.",
        sub: "Shot lists, call sheets, and scheduling — everything your crew needs, right where your project lives.",
        note: "Replaces StudioBinder + Notion",
        img: "/marketing/panel-production.png",
        imgAlt: "CineFlow shot list for a short film production, with scenes, camera moves, and lenses tracked per shot.",
        imgHeight: 820,
      },
      {
        label: "AI Script Breakdown",
        h: "AI reads your script. You get the breakdown.",
        sub: "Drop in a script and Claude extracts every scene, character, location, and prop — the full breakdown a line producer would build by hand.",
        note: "Powered by Claude",
        img: "/marketing/panel-ai-breakdown-results.png",
        imgAlt: "CineFlow AI script breakdown showing scene count, characters, locations, shoot days, and production notes for a commercial.",
        imgHeight: 900,
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    features: [
      {
        label: "Invoicing",
        h: "Stop chasing your own money.",
        sub: "Revenue, expenses, and invoices across every project — see what's outstanding at a glance.",
        note: "Replaces HoneyBook + Wave",
        img: "/marketing/panel-invoicing.png",
        imgAlt: "CineFlow finance dashboard with a revenue chart, top clients, and invoice totals.",
        imgHeight: 900,
      },
      {
        label: "Quote Calculator",
        h: "Price a job in minutes, not hours.",
        sub: "Build a quote from real crew rates, apply your markup, and turn it into a client-ready estimate.",
        note: "From rate card to client quote",
        img: "/marketing/panel-quote-calculator.png",
        imgAlt: "CineFlow quote calculator with crew and equipment line items and floor, standard, and premium pricing tiers.",
        imgHeight: 900,
      },
    ],
  },
  {
    key: "clients",
    label: "Clients & Projects",
    features: [
      {
        label: "Client Portal",
        h: "Clients stay in the loop. Automatically.",
        sub: "Every client gets their own portal. They see progress, approve cuts, and sign off. Without texting you.",
        note: 'No more "hey, are the videos done yet?"',
        img: "/marketing/panel-client-portal.png",
        imgAlt: "CineFlow review hub showing video cuts with approval status — in house, revision needed, approved.",
        imgHeight: 460,
      },
      {
        label: "Boards",
        h: "Plan visually. Not in a spreadsheet.",
        sub: "A freeform canvas for notes, shot ideas, characters, and locations — build it out the way your brain actually works.",
        note: "Replaces Milanote + sticky notes",
        img: "/marketing/panel-boards.png",
        imgAlt: "CineFlow board with note, location, character, and shot cards for a festival shoot.",
        imgHeight: 900,
      },
    ],
  },
] as const;

const SWIPE_THRESHOLD = 80;

export function FeatureShowcase() {
  const [catIndex, setCatIndex] = useState(0);
  const [[featIndex, direction], setFeat] = useState<[number, number]>([0, 0]);

  const category = CATEGORIES[catIndex];
  const feature = category.features[featIndex];

  function selectCategory(i: number) {
    if (i === catIndex) return;
    setCatIndex(i);
    setFeat([0, 0]);
  }

  function paginate(dir: number) {
    const len = category.features.length;
    setFeat(([prev]) => [(prev + dir + len) % len, dir]);
  }

  return (
    <div data-reveal="clip">
      {/* Category tabs — quiet until hovered, no auto-switching */}
      <div className="lp-clip mb-14 flex justify-center">
        <div className="lp-clip-inner flex flex-wrap items-center justify-center gap-2" style={{ "--di": "0s" } as React.CSSProperties}>
          {CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onClick={() => selectCategory(i)}
              className={`rounded-full border px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] transition-all ${
                i === catIndex
                  ? "border-[#d4a853]/40 bg-[#d4a853]/10 text-[#d4a853]"
                  : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-clip">
        <div className="lp-clip-inner" style={{ "--di": "0.08s" } as React.CSSProperties}>
          <div className="flex flex-col items-center gap-10 md:flex-row md:items-center md:gap-14">
            {/* Screenshot + swipe/arrows */}
            <div className="relative w-full md:w-[58%] md:shrink-0">
              <div
                className="lp-panel-frame relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
                style={{ boxShadow: "0 0 60px rgba(212,168,83,0.06), 0 20px 60px rgba(0,0,0,0.5)" }}
              >
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  <motion.div
                    key={`${category.key}-${feature.label}`}
                    custom={direction}
                    initial={{ x: direction >= 0 ? 40 : -40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: direction >= 0 ? -40 : 40, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.6}
                    onDragEnd={(_e, info) => {
                      if (info.offset.x < -SWIPE_THRESHOLD) paginate(1);
                      else if (info.offset.x > SWIPE_THRESHOLD) paginate(-1);
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <Image
                      src={feature.img}
                      alt={feature.imgAlt}
                      width={1440}
                      height={feature.imgHeight}
                      sizes="(min-width: 768px) 58vw, 92vw"
                      className="w-full h-auto pointer-events-none select-none"
                      draggable={false}
                    />
                  </motion.div>
                </AnimatePresence>
                <div className="lp-panel-shine" />
              </div>

              {/* Arrows */}
              <button
                type="button"
                onClick={() => paginate(-1)}
                aria-label="Previous feature"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a]/70 text-white/60 backdrop-blur-sm transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => paginate(1)}
                aria-label="Next feature"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a]/70 text-white/60 backdrop-blur-sm transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Pagination dots */}
              <div className="mt-4 flex justify-center gap-1.5">
                {category.features.map((f, i) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setFeat([i, i > featIndex ? 1 : -1])}
                    aria-label={`Show ${f.label}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === featIndex ? "w-5 bg-[#d4a853]" : "w-1.5 bg-white/15 hover:bg-white/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Copy */}
            <div className="flex w-full flex-col items-center text-center md:flex-1 md:items-start md:text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${category.key}-${feature.label}-copy`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="mb-4 font-mono text-[10px] tracking-[0.42em] uppercase text-[#d4a853]/48">
                    {category.label} · {feature.label}
                  </p>
                  <h3
                    className="font-black leading-[1.1] tracking-tighter text-white"
                    style={{ fontSize: "clamp(1.8rem,3.4vw,2.8rem)" }}
                  >
                    {feature.h}
                  </h3>
                  <div className="my-6 h-px w-8 bg-[#d4a853]/22 md:mx-0 mx-auto" />
                  <p className="max-w-xs text-[13px] leading-relaxed text-white/48">{feature.sub}</p>
                  <p className="mt-5 font-mono text-[9px] tracking-[0.32em] uppercase text-white/18">{feature.note}</p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
