"use client";

import { useRef, useState } from "react";
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
  num: string;
  label: string;
  features: readonly ShowcaseFeature[];
}

const CATEGORIES: readonly ShowcaseCategory[] = [
  {
    key: "production",
    num: "01",
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
    num: "02",
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
    num: "03",
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
const WHEEL_THRESHOLD = 40;
const WHEEL_COOLDOWN_MS = 500;

function CategorySection({ category, reversed }: { category: ShowcaseCategory; reversed: boolean }) {
  const [[featIndex, direction], setFeat] = useState<[number, number]>([0, 0]);
  const wheelCooldown = useRef(false);
  const feature = category.features[featIndex];

  function paginate(dir: number) {
    const len = category.features.length;
    setFeat(([prev]) => [(prev + dir + len) % len, dir]);
  }

  function handleWheel(e: React.WheelEvent) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return; // vertical scroll — let the page scroll
    if (Math.abs(e.deltaX) < WHEEL_THRESHOLD) return;
    if (wheelCooldown.current) return;
    e.preventDefault();
    wheelCooldown.current = true;
    paginate(e.deltaX > 0 ? 1 : -1);
    setTimeout(() => { wheelCooldown.current = false; }, WHEEL_COOLDOWN_MS);
  }

  return (
    <div
      data-reveal="clip"
      className={`flex flex-col items-center gap-10 text-center md:gap-16 md:text-left ${
        reversed ? "md:flex-row-reverse" : "md:flex-row"
      }`}
    >
      {/* Screenshot + swipe/arrows */}
      <div className="w-full md:w-[54%] md:shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {category.features.length > 1 && (
            <button
              type="button"
              onClick={() => paginate(-1)}
              aria-label="Previous feature"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <div className="relative min-w-0 flex-1" onWheel={handleWheel}>
            <div
              className="lp-panel-frame lp-panel-frame-resize relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"
              style={{
                boxShadow: "0 0 60px rgba(212,168,83,0.06), 0 20px 60px rgba(0,0,0,0.5)",
                ["--panel-ratio" as string]: `${(feature.imgHeight / 1440) * 100}%`,
              }}
            >
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={feature.label}
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
                  className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
                >
                  <Image
                    src={feature.img}
                    alt={feature.imgAlt}
                    fill
                    sizes="(min-width: 768px) 54vw, 92vw"
                    className="object-cover pointer-events-none select-none"
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>
              <div className="lp-panel-shine" />
            </div>
          </div>

          {category.features.length > 1 && (
            <button
              type="button"
              onClick={() => paginate(1)}
              aria-label="Next feature"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {category.features.length > 1 && (
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
        )}
      </div>

      {/* Copy */}
      <div className="flex w-full min-w-0 flex-col items-center md:w-auto md:flex-1 md:items-start">
        <p className="mb-6 font-mono text-[10px] tracking-[0.42em] uppercase text-[#d4a853]/48">
          {category.num} · {category.label}
        </p>
        <div className="w-full min-w-0 md:max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <p className="mb-2 font-mono text-[10px] tracking-[0.3em] uppercase text-white/30">{feature.label}</p>
              <h3
                className="font-black leading-[1.1] tracking-tighter text-white text-balance"
                style={{ fontSize: "clamp(1.8rem,3.2vw,2.6rem)" }}
              >
                {feature.h}
              </h3>
              <div className="my-6 h-px w-8 bg-[#d4a853]/22" />
              <p className="max-w-xs text-[13px] leading-relaxed text-white/48">{feature.sub}</p>
              <p className="mt-5 font-mono text-[9px] tracking-[0.32em] uppercase text-white/18">{feature.note}</p>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <div className="flex flex-col gap-28">
      {CATEGORIES.map((category, i) => (
        <CategorySection key={category.key} category={category} reversed={i % 2 === 1} />
      ))}
    </div>
  );
}
