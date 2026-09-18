"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePostHog } from "posthog-js/react";
import { Film, Check, ChevronDown } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { SpotlightCanvas } from "./SpotlightCanvas";
import { scrollState } from "./scrollState";
import { AdPixels } from "@/components/shared/AdPixels";
import { MagneticLink } from "./MagneticLink";
import { FeatureShowcase } from "./FeatureShowcase";

export type HeroVariant = "a" | "b" | "c" | "d";

interface Props { refCode?: string; heroVariant?: HeroVariant }

// Paid-traffic headline test (Oct 2026) — Kenny sends ?h=b/c/d to compare
// against the control. Swaps only the hero H1/sub; rest of the page is
// identical across variants. See landing_hero_view / landing_cta_click.
const HERO_VARIANTS: Record<
  HeroVariant,
  { h1: React.ReactNode; h1Size?: string; sub: React.ReactNode; img: string; imgAlt: string; imgHeight: number }
> = {
  a: {
    h1: <>Stop stitching your<br />production together.</>,
    sub: <>Your quote becomes the contract, the contract becomes the shoot,<br className="hidden md:inline" /> and the shoot becomes the invoice. Nothing gets retyped.</>,
    img: "/marketing/panel-production.png",
    imgAlt: "CineFlow shot list for a short film production, with scenes, camera moves, and lenses tracked per shot.",
    imgHeight: 820,
  },
  b: {
    h1: <>One project. First call<br />to final payment.</>,
    sub: <>Your quote becomes the contract, the contract becomes the shoot,<br className="hidden md:inline" /> and the shoot becomes the invoice. Nothing gets retyped.</>,
    img: "/marketing/panel-client-portal.png",
    imgAlt: "CineFlow review hub showing video cuts with approval status — in house, revision needed, approved.",
    imgHeight: 460,
  },
  c: {
    h1: <>You got into this to make films.<br />Not to chase invoices.</>,
    sub: <>Quotes, contracts, client approvals, and payments — handled,<br className="hidden md:inline" /> so you can get back on set.</>,
    img: "/marketing/panel-invoicing.png",
    imgAlt: "CineFlow finance dashboard with a revenue chart, top clients, and invoice totals.",
    imgHeight: 900,
  },
  d: {
    h1: <>Frame.io for review. StudioBinder for prep.<br />Spreadsheets for everything else.</>,
    h1Size: "clamp(1.7rem,3.4vw,2.9rem)",
    sub: <>Or one platform that does the whole job.</>,
    img: "/marketing/panel-production.png",
    imgAlt: "CineFlow shot list for a short film production, with scenes, camera moves, and lenses tracked per shot.",
    imgHeight: 820,
  },
};

const FRAGMENTS = [
  { text: '"where are we at?" · 11:47pm',     mono: false, x: "4%",  y: "20%", rot: -3, d: 0.6,  dur: 3.8 },
  // Sits close enough to the headline that its own float animation
  // (translateY 0 to -20px) plus mouse parallax (worst case ~8.9px
  // combined) can close the gap — measured clearance at rest+extreme:
  // a 2.2px, c 3.4px, d overlaps outright (~81px). Only b has real
  // clearance (15.6px), so it's the only variant that keeps this one.
  { text: "Invoice_v4_FINAL_FINAL.pdf",        mono: true,  x: "70%", y: "16%", rot:  4, d: 1.0,  dur: 4.2, hideFor: ["a", "c", "d"] as const },
  { text: '"did you get the rough cut link?"', mono: false, x: "3%",  y: "60%", rot: -2, d: 1.2,  dur: 3.5 },
  { text: "shot_list_REVISED_use_this.xlsx",   mono: true,  x: "68%", y: "72%", rot:  5, d: 0.8,  dur: 4.5 },
  { text: '"can you resend the contract?"',    mono: false, x: "74%", y: "42%", rot: -4, d: 1.4,  dur: 3.9 },
  { text: "Client approval: pending 14d",      mono: false, x: "8%",  y: "80%", rot:  3, d: 1.0,  dur: 4.1 },
  { text: '"what time is call time again?"',   mono: false, x: "12%", y: "38%", rot: -5, d: 1.5,  dur: 3.6 },
  // Collides with variant b's sub (~76px overlap at 768px height).
  { text: "call_sheet_saturday_v4.pdf",        mono: true,  x: "58%", y: "24%", rot:  3, d: 0.9,  dur: 4.3, hideFor: ["b"] as const },
  { text: '"I never got the invoice 🙏"',      mono: false, x: "76%", y: "60%", rot: -3, d: 1.3,  dur: 3.7 },
  // Removed entirely (not hidden per-variant): overlaps a's sub (~51px)
  // and b's headline (~80px) and sub (~79px) outright, and even where it
  // doesn't overlap at rest, its own float + mouse parallax closes the
  // remaining gap for c (9.5px, under the ~8.9px worst-case combined
  // excursion) and d (2.9px). No variant has safe clearance for it.
] as const;

// Annual figures mirror app/(app)/upgrade/page.tsx — keep in sync if pricing changes.
const LP_PLANS = [
  {
    name: "Solo",
    price: 39,
    annual: 29,
    annualTotal: 348,
    seats: "1 filmmaker",
    features: [
      "Unlimited projects",
      "Shot lists + storyboards",
      "Client review portals",
      "Invoicing + contracts",
      "AI-powered tools",
    ],
    popular: false,
  },
  {
    name: "Studio",
    price: 79,
    annual: 65,
    annualTotal: 780,
    seats: "Up to 5 team members",
    features: [
      "Everything in Solo",
      "Team collaboration",
      "Revision workflows",
      "Retainer management",
      "Priority support",
    ],
    popular: true,
  },
  {
    name: "Agency",
    price: 159,
    annual: 129,
    annualTotal: 1548,
    seats: "Up to 15 team members",
    features: [
      "Everything in Studio",
      "Advanced analytics",
      "Multi-client management",
      "Dedicated support",
    ],
    popular: false,
  },
] as const;

const OUTCOMES = [
  { stat: "More bookings.",   sub: "Less time on admin means more time selling." },
  { stat: "Happier clients.", sub: "A portal that keeps them informed, not your DMs." },
  { stat: "Zero chaos.",      sub: "One project file, from first call to final payment." },
] as const;

// Scattered points the intro particles converge in from — echoes the chaos
// fragments resolving into the wordmark, like scattered light finding focus.
const CF_PARTICLES = [
  { sx: "-320px", sy: "-90px",  d: "0.05s" },
  { sx: "300px",  sy: "-120px", d: "0.12s" },
  { sx: "-260px", sy: "110px",  d: "0.02s" },
  { sx: "340px",  sy: "80px",   d: "0.18s" },
  { sx: "-150px", sy: "-160px", d: "0.24s" },
  { sx: "180px",  sy: "150px",  d: "0.08s" },
  { sx: "-380px", sy: "20px",   d: "0.30s" },
  { sx: "400px",  sy: "-30px",  d: "0.15s" },
  { sx: "-80px",  sy: "160px",  d: "0.21s" },
  { sx: "90px",   sy: "-170px", d: "0.27s" },
] as const;

// Not drawn from support history (too early for that) — these are the
// objections a rational buyer has right before a card-free trial, answered
// only with things that are actually true about the product today.
const FAQS = [
  {
    q: "Do I need a credit card to start?",
    a: "No. Every plan starts with a 30-day free trial, no card required. You only pay if you decide to continue.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — there's no long-term contract. Cancel anytime from your account settings.",
  },
  {
    q: "Is my data secure?",
    a: "CineFlow runs on the same infrastructure (Supabase, Vercel) used by SOC 2–compliant companies, with encryption in transit and for sensitive fields at rest. Your client data is yours — it's never sold or used to train anything.",
  },
  {
    q: "Can my team use it with me?",
    a: "Yes. Studio and Agency plans include team seats with role-based permissions, so you control who sees what on a project.",
  },
  {
    q: "What if I outgrow my plan?",
    a: "Change plans anytime from your account — billing adjusts automatically, prorated for the time you've already paid.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes, in any mobile browser today — CineFlow is fully cloud-native. Native Mac and iOS apps are planned but not yet available.",
  },
] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] py-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-sm font-medium text-white/80">{q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#d4a853]/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-white/45">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ refCode, heroVariant = "a" }: Props) {
  const href = refCode ? `/signup?ref=${refCode}` : "/signup";
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const lenisRef = useRef<{ scrollTo: (target: string | number | HTMLElement, opts?: Record<string, unknown>) => void } | null>(null);
  const [nlEmail, setNlEmail] = useState("");
  const [nlStatus, setNlStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const posthog = usePostHog();
  const hero = HERO_VARIANTS[heroVariant];

  useEffect(() => {
    posthog?.capture("landing_hero_view", { variant: heroVariant });
  }, [heroVariant, posthog]);

  function trackCtaClick(location: string) {
    posthog?.capture("landing_cta_click", { variant: heroVariant, location });
  }

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nlStatus === "loading") return;
    setNlStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nlEmail }),
      });
      if (!res.ok) throw new Error();
      setNlStatus("success");
    } catch {
      setNlStatus("error");
    }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let teardown: (() => void) | undefined;

    (async () => {
      const { default: Lenis } = await import("lenis");

      const lenis = new Lenis({ lerp: 0.10, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.on("scroll", ({ progress }: { progress: number }) => {
        scrollState.prog = progress;
      });
      let rafId: number;
      function tick(t: number) { lenis.raf(t); rafId = requestAnimationFrame(tick); }
      rafId = requestAnimationFrame(tick);

      const frags = Array.from(document.querySelectorAll<HTMLElement>(".lp-frag-wrap"));
      function onMove(e: MouseEvent) {
        const x = e.clientX / window.innerWidth  - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        frags.forEach((el, i) => {
          const d = 0.28 + (i % 4) * 0.18;
          el.style.setProperty("--mpx", `${x * d * 18}px`);
          el.style.setProperty("--mpy", `${y * d * 12}px`);
        });
      }
      window.addEventListener("mousemove", onMove);

      const io = new IntersectionObserver(
        (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
      );
      document.querySelectorAll("[data-reveal]").forEach(el => io.observe(el));

      teardown = () => {
        cancelAnimationFrame(rafId);
        lenis.destroy();
        lenisRef.current = null;
        window.removeEventListener("mousemove", onMove);
        io.disconnect();
      };
    })();

    return () => teardown?.();
  }, []);

  return (
    <div style={{ background: "#050508" }}>
      <AdPixels />
      <BackgroundCanvas />
      <SpotlightCanvas />
      <div className="lp-grain" />

      {/* Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 py-5 transition-colors duration-300 ${
          scrolled ? "border-b border-white/5 bg-[#050508]/80 backdrop-blur-md" : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white/90">CineFlow</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="hidden text-xs font-medium text-white/45 transition-colors hover:text-white/80 sm:inline"
          >
            Log in
          </Link>
          <Link
            href={href}
            onClick={() => trackCtaClick("nav")}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-[#d4a853]/50 hover:text-[#d4a853] sm:px-4"
          >
            Start free trial
          </Link>
        </div>
      </nav>

      <div className="relative z-20">

        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 pb-40 text-center">

          {/* Hidden on mobile — overlap hero content on small screens */}
          {FRAGMENTS.filter((f) => !("hideFor" in f && (f.hideFor as readonly string[]).includes(heroVariant))).map((f) => (
            <div
              key={f.text}
              className="lp-frag-wrap absolute pointer-events-none hidden sm:block"
              style={{ left: f.x, top: f.y, "--fd": `${f.d}s`, "--fdur": `${f.dur}s` } as React.CSSProperties}
            >
              <div
                className="lp-frag-card rounded-md px-3 py-1.5 text-white/35"
                style={{
                  "--rot": `${f.rot}deg`,
                  fontSize: "11px",
                  fontFamily: f.mono ? "'SF Mono','Fira Code',monospace" : "inherit",
                  border: "1px solid rgba(255,255,255,0.055)",
                  background: "rgba(5,5,12,0.70)",
                  backdropFilter: "blur(8px)",
                  whiteSpace: "nowrap",
                  letterSpacing: f.mono ? "0.02em" : "-0.01em",
                } as React.CSSProperties}
              >
                {f.text}
              </div>
            </div>
          ))}

          <div className="relative z-10 flex flex-col items-center">
            <div
              className="lp-hero-line mb-16 h-px w-56"
              style={{ background: "linear-gradient(90deg,transparent,rgba(212,168,83,0.42),transparent)" }}
            />
            <h1
              className="lp-hero-headline max-w-3xl font-sans font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: hero.h1Size ?? "clamp(2.2rem,4.2vw,3.8rem)" }}
            >
              {hero.h1}
            </h1>
            <p className="lp-hero-sub mt-6 max-w-md text-[13px] leading-relaxed text-white/48">
              {hero.sub}
            </p>
            <div className="lp-hero-cta mt-8 flex flex-col items-center gap-4">
              <MagneticLink
                href={href}
                onClick={() => trackCtaClick("hero")}
                className="inline-block rounded-xl bg-[#d4a853] px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(212,168,83,0.35)]"
              >
                Start for free →
              </MagneticLink>
            </div>
            <p className="lp-hero-trust mt-3 font-mono text-[9px] tracking-[0.28em] uppercase text-white/22">
              No credit card required · Cancel anytime
            </p>
          </div>

          {/* Product peek — top edge breaks into the first viewport so cold
              traffic sees the software without scrolling. Tied to the hero
              variant so each headline immediately shows what it promised. */}
          <div className="lp-hero-peek relative z-10 mt-32 w-full max-w-4xl sm:mt-64">
            <div
              className="lp-panel-frame relative max-h-52 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] sm:max-h-none"
              style={{ boxShadow: "0 0 60px rgba(212,168,83,0.06), 0 20px 60px rgba(0,0,0,0.5)" }}
            >
              {/* Below sm, the full 1440px screenshot shrinks ~4.6x and reads
                  as an illegible blur — its whole purpose is proof the
                  product is real. Render it ~2x larger than the frame and
                  let overflow-hidden crop to the top-left (header + first
                  shot row), a legible fragment instead of an unreadable
                  whole. Reverts to the normal full-width fit at sm+. */}
              <Image
                src={hero.img}
                alt={hero.imgAlt}
                width={1440}
                height={hero.imgHeight}
                priority
                sizes="(min-width: 1024px) 896px, 184vw"
                className="block h-auto w-[200%] max-w-none sm:w-full sm:max-w-full"
              />
              <div className="lp-panel-shine" />
            </div>
          </div>

          <div className="lp-hero-scroll absolute bottom-10 flex flex-col items-center gap-3">
            <div className="h-12 w-px bg-gradient-to-b from-transparent to-[#d4a853]/22" />
            <p className="font-mono text-[8px] tracking-[0.35em] text-white/14 uppercase">Scroll</p>
          </div>
        </section>

        {/* ══ PAIN ══════════════════════════════════════════════════════ */}
        <section className="relative flex flex-col items-center gap-20 py-28 px-8">

          <div data-reveal className="max-w-2xl text-center">
            <p className="mb-5 font-mono text-[10px] tracking-[0.42em] uppercase text-white/20">The problem</p>
            <p
              className="font-black leading-[1.14] tracking-tighter text-white"
              style={{ fontSize: "clamp(1.9rem,3.6vw,3.2rem)" }}
            >
              StudioBinder. Frame.io.<br />HoneyBook. Slack.
              <br /><span className="text-red-400/70">Not one of them talks to the other.</span>
            </p>
          </div>

          {/* Receipt card — cost comparison */}
          <div data-reveal className="w-full max-w-[300px]">
            <div
              className="rounded-2xl border border-white/[0.08] px-6 py-5"
              style={{ background: "rgba(5,5,12,0.9)", backdropFilter: "blur(16px)" }}
            >
              <p className="mb-4 font-mono text-[9px] tracking-[0.38em] uppercase text-white/40">What you&apos;re already paying</p>
              <div className="space-y-2.5">
                {[
                  { name: "StudioBinder", price: "29" },
                  { name: "Frame.io",     price: "15" },
                  { name: "HoneyBook",    price: "40" },
                  { name: "Slack",        price: "7"  },
                ].map(({ name, price }) => (
                  <div key={name} className="flex items-baseline justify-between">
                    <span className="font-mono text-[11px] text-white/55">{name}</span>
                    <span className="font-mono text-[11px] text-white/45">${price}<span className="text-[9px] text-white/28">/mo</span></span>
                  </div>
                ))}
              </div>
              <div className="my-4 border-t border-dashed border-white/[0.10]" />
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-white/55">Total</span>
                <span className="font-mono text-sm font-semibold text-red-400/80 line-through">$91/mo</span>
              </div>
              <div className="mt-4 rounded-xl border border-[#d4a853]/25 bg-[#d4a853]/[0.06] px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] text-[#d4a853]/90">CineFlow</span>
                  <span className="font-mono text-sm font-bold text-[#d4a853]">from $39<span className="text-xs text-[#d4a853]/60">/mo</span></span>
                </div>
                <p className="mt-1 font-mono text-[9px] text-[#d4a853]/50">one subscription. everything.</p>
              </div>
            </div>
          </div>

          <div data-reveal className="max-w-2xl text-center">
            <p
              className="font-black leading-[1.14] tracking-tighter text-white"
              style={{ fontSize: "clamp(1.9rem,3.6vw,3.2rem)" }}
            >
              Subscription after subscription.
              <br /><span className="text-red-400/70">Something&apos;s always falling through the cracks.</span>
            </p>
          </div>

        </section>

        {/* ══ ENOUGH ════════════════════════════════════════════════════ */}
        <section className="relative flex items-center justify-center px-8 py-14 text-center">
          <div data-reveal="clip">
            <div
              className="lp-clip font-black leading-none tracking-tighter text-white"
              style={{ fontSize: "clamp(5rem,13vw,10rem)" }}
            >
              <div className="lp-clip-inner" style={{ "--di": "0s" } as React.CSSProperties}>ENOUGH.</div>
            </div>
            <div className="lp-clip mt-7">
              <p className="lp-clip-inner text-[12px] font-light tracking-[0.34em] uppercase text-white/24"
                style={{ "--di": "0.18s" } as React.CSSProperties}>
                There&apos;s a better way.
              </p>
            </div>
            <div className="lp-clip mt-10">
              <div className="lp-clip-inner" style={{ "--di": "0.34s" } as React.CSSProperties}>
                <ChevronDown
                  className="mx-auto h-5 w-5 text-[#d4a853]/45"
                  style={{ animation: "float-up-down 2.6s ease-in-out infinite" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ══ SCATTER TRANSITION ════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-4">
          <div className="relative mx-auto h-16 max-w-2xl">
            {([
              { left: "6%",  top: "15%", w: 28, rot: -22, dur: 3.8, del: 0.0 },
              { left: "78%", top: "25%", w: 16, rot:  41, dur: 4.2, del: 0.5 },
              { left: "42%", top: "6%",  w: 22, rot:  -9, dur: 3.5, del: 0.9 },
              { left: "22%", top: "74%", w: 14, rot:  56, dur: 4.5, del: 0.3 },
              { left: "64%", top: "78%", w: 20, rot: -38, dur: 3.9, del: 0.7 },
              { left: "88%", top: "52%", w: 12, rot:  18, dur: 4.1, del: 1.1 },
              { left: "2%",  top: "58%", w: 18, rot: -52, dur: 3.6, del: 0.4 },
            ] as const).map((m, i) => (
              <div
                key={i}
                className="absolute h-px"
                style={{
                  left: m.left,
                  top: m.top,
                  width: m.w,
                  rotate: `${m.rot}deg`,
                  background: "rgba(212,168,83,0.20)",
                  animation: `float-up-down ${m.dur}s ease-in-out ${m.del}s infinite`,
                } as React.CSSProperties}
              />
            ))}
            <div
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: "rgba(212,168,83,0.45)",
                boxShadow: "0 0 16px rgba(212,168,83,0.20)",
                animation: "float-up-down 4.2s ease-in-out infinite",
              }}
            />
          </div>
        </section>

        {/* ══ CINEFLOW INTRO ════════════════════════════════════════════ */}
        <section className="relative flex flex-col items-center justify-center px-8 py-14 text-center">
          <div data-reveal="clip" className="flex flex-col items-center">
            <div className="lp-clip mb-8">
              <div className="lp-clip-inner h-px w-10 bg-[#d4a853]" style={{ "--di": "0s" } as React.CSSProperties} />
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner font-mono text-[11px] tracking-[0.42em] uppercase text-[#d4a853]/55"
                style={{ "--di": "0.06s" } as React.CSSProperties}>
                Introducing
              </p>
            </div>

            {/* Wordmark — blur/scale applied to wrapper so gradient text renders correctly */}
            <div className="lp-cf-wordmark-wrap" style={{ fontSize: "clamp(4.5rem,14vw,12rem)" }}>
              <div
                className="lp-cf-glow pointer-events-none absolute inset-0 -z-10"
                style={{
                  background: "radial-gradient(ellipse 90% 70% at 50% 55%, rgba(212,168,83,0.14) 0%, transparent 70%)",
                  filter: "blur(32px)",
                }}
              />
              {/* Scattered fragments converging into the wordmark on reveal */}
              {CF_PARTICLES.map((p, i) => (
                <span
                  key={i}
                  className="lp-cf-particle pointer-events-none absolute left-1/2 top-1/2"
                  style={{ "--sx": p.sx, "--sy": p.sy, "--di": p.d } as React.CSSProperties}
                />
              ))}
              <div
                className="font-black leading-none tracking-tight"
                style={{
                  background: "linear-gradient(135deg,#ffffff 34%,#d4a853 63%,#fff3c4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "block",
                  paddingRight: "0.06em",
                }}
              >CineFlow</div>
              {/* Specular sweep — light catching gold foil, on a loop */}
              <div className="lp-cf-shine pointer-events-none absolute inset-0 font-black leading-none tracking-tight"
                style={{ paddingRight: "0.06em" }} aria-hidden="true">CineFlow</div>
            </div>

            <div className="lp-clip mt-7">
              <p className="lp-clip-inner mx-auto max-w-sm text-[13px] leading-relaxed text-white/28"
                style={{ "--di": "0.30s" } as React.CSSProperties}>
                One continuous thread, from first call to final invoice.
              </p>
            </div>
          </div>
        </section>

        {/* ══ PANELS ════════════════════════════════════════════════════ */}
        <section id="lp-panels" className="relative py-20 px-8">
          <div className="mx-auto max-w-6xl">
            <FeatureShowcase />
          </div>
        </section>

        {/* ══ OUTCOMES ══════════════════════════════════════════════════ */}
        <section className="relative py-24 px-8">
          <div className="mx-auto max-w-3xl">
            <div data-reveal className="mb-14 text-center">
              <p className="font-mono text-[10px] tracking-[0.42em] uppercase text-white/20">The result</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              {OUTCOMES.map(({ stat, sub }) => (
                <div
                  key={stat}
                  data-reveal
                  className="lp-outcome-card rounded-2xl px-6 py-7"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p
                    className="mb-3 font-black leading-tight tracking-tighter text-white"
                    style={{ fontSize: "clamp(1.3rem,2.2vw,1.7rem)" }}
                  >
                    {stat}
                  </p>
                  <p className="text-[12px] leading-relaxed text-white/38">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PRICING ═══════════════════════════════════════════════════ */}
        <section id="lp-pricing" className="relative py-24 px-8">
          <div className="mx-auto max-w-4xl">

            <div data-reveal className="mb-14 text-center">
              <p className="mb-4 font-mono text-[10px] tracking-[0.42em] uppercase text-white/20">Pricing</p>
              <h2
                className="font-black leading-[1.06] tracking-tighter text-white"
                style={{ fontSize: "clamp(2rem,4vw,3.2rem)" }}
              >
                Simple, honest pricing.
              </h2>
              <p className="mt-4 text-[13px] text-white/40">
                30-day free trial on every plan. No credit card required.
              </p>

              <div className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setBilling("monthly")}
                  className={`rounded-full px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                    billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBilling("annual")}
                  className={`rounded-full px-4 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                    billing === "annual" ? "bg-[#d4a853] text-black" : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Annual · save ~20%
                </button>
              </div>
            </div>

            <div data-reveal className="grid gap-4 sm:grid-cols-3">
              {LP_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`lp-pricing-card relative flex flex-col rounded-2xl p-6 ${plan.popular ? "lp-pricing-card--popular" : ""}`}
                  style={{
                    background: plan.popular ? "rgba(212,168,83,0.05)" : "rgba(255,255,255,0.02)",
                    border: plan.popular ? "1px solid rgba(212,168,83,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-[#d4a853] px-3 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-black">
                        Most popular
                      </span>
                    </div>
                  )}

                  <p className={`mb-1 text-sm font-semibold ${plan.popular ? "text-[#d4a853]" : "text-white/80"}`}>
                    {plan.name}
                  </p>
                  <p className="mb-5 font-mono text-[11px] text-white/28">{plan.seats}</p>

                  <div className="mb-6">
                    <span className={`text-3xl font-black ${plan.popular ? "text-[#d4a853]" : "text-white"}`}>
                      ${billing === "annual" ? plan.annual : plan.price}
                    </span>
                    <span className="ml-1 text-xs text-white/28">/mo</span>
                    {billing === "annual" && (
                      <p className="mt-1 font-mono text-[10px] text-white/28">Billed ${plan.annualTotal}/year</p>
                    )}
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-xs text-white/45">
                        <Check className={`mt-0.5 h-3 w-3 shrink-0 ${plan.popular ? "text-[#d4a853]" : "text-white/28"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <MagneticLink
                    href={href}
                    strength={7}
                    onClick={() => trackCtaClick(`pricing:${plan.name}`)}
                    className={`block w-full rounded-xl py-2.5 text-center text-xs font-bold transition-all ${
                      plan.popular
                        ? "bg-[#d4a853] text-black hover:bg-[#d4a853]/90 hover:shadow-[0_0_28px_rgba(212,168,83,0.22)]"
                        : "border border-white/[0.08] text-white/55 hover:border-[#d4a853]/30 hover:text-[#d4a853]"
                    }`}
                  >
                    Start free trial
                  </MagneticLink>
                </div>
              ))}
            </div>

            {/* Lifetime */}
            <div
              data-reveal
              className="mt-5 flex flex-col items-center justify-between gap-4 rounded-2xl px-6 py-5 sm:flex-row"
              style={{ border: "1px solid rgba(212,168,83,0.15)", background: "rgba(212,168,83,0.03)" }}
            >
              <div>
                <p className="text-sm font-semibold text-white/65">
                  Lifetime Access · $299
                  <span className="ml-2 font-mono text-[10px] text-white/22">one-time payment</span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-white/28">
                  Solo-level features · 1 seat · forever · limited to 500 licenses
                </p>
              </div>
              <Link
                href={href}
                onClick={() => trackCtaClick("lifetime")}
                className="shrink-0 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/[0.08] px-5 py-2.5 font-mono text-xs font-semibold text-[#d4a853] transition-all hover:bg-[#d4a853]/[0.15]"
              >
                Get lifetime access
              </Link>
            </div>

            <p data-reveal className="mt-8 text-center font-mono text-[10px] text-white/18">
              Need more? Enterprise (unlimited seats) starts at $299/mo ·{" "}
              <a href="mailto:hello@usecineflow.com" className="text-[#d4a853]/50 transition-colors hover:text-[#d4a853]/80">
                hello@usecineflow.com
              </a>
            </p>

          </div>
        </section>

        {/* ══ FAQ ═══════════════════════════════════════════════════════ */}
        <section className="relative py-20 px-8">
          <div className="mx-auto max-w-2xl">
            <div data-reveal className="mb-10 text-center">
              <p className="font-mono text-[10px] tracking-[0.42em] uppercase text-white/20">Questions</p>
            </div>
            <div data-reveal>
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 52% 40% at 50% 52%,rgba(212,168,83,0.055) 0%,transparent 70%)" }}
          />
          <div data-reveal="clip" className="relative z-10 flex flex-col items-center gap-0">
            <div
              className="mb-5 font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.4rem,5vw,4.5rem)" }}
            >
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0s" } as React.CSSProperties}>Stop stitching.</div></div>
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.10s" } as React.CSSProperties}>Start shooting.</div></div>
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner max-w-xs text-[13px] leading-relaxed text-white/40"
                style={{ "--di": "0.20s" } as React.CSSProperties}>
                Built by a filmmaker who got tired of stitching tools together. See if it fits how you actually work.
              </p>
            </div>
            <div className="lp-clip mb-2 mt-1">
              <Link
                href={href}
                onClick={() => trackCtaClick("closing")}
                className="lp-clip-inner block rounded-xl bg-[#d4a853] px-8 py-3.5 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(212,168,83,0.35)]"
                style={{ "--di": "0.30s" } as React.CSSProperties}
              >
                Start for free →
              </Link>
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner font-mono text-[9px] tracking-[0.28em] uppercase text-white/22"
                style={{ "--di": "0.36s" } as React.CSSProperties}>
                No credit card required · Cancel anytime
              </p>
            </div>
            <div className="lp-clip">
              <p className="lp-clip-inner font-mono text-[9px] tracking-[0.32em] uppercase text-white/18"
                style={{ "--di": "0.44s" } as React.CSSProperties}>
                Replaces 4+ subscriptions. Starts at $39/mo.
              </p>
            </div>

            <div className="lp-clip mt-10">
              <div className="lp-clip-inner" style={{ "--di": "0.5s" } as React.CSSProperties}>
                {nlStatus === "success" ? (
                  <p className="text-[11px] text-[#d4a853]/70">You&apos;re on the list — thanks.</p>
                ) : (
                  <>
                    <p className="mb-3 text-[10px] text-white/25">
                      Not ready to try it? Get occasional product updates — about once a month, no spam.
                    </p>
                    <form onSubmit={handleNewsletterSubmit} className="flex items-center justify-center gap-2">
                      <input
                        type="email"
                        required
                        value={nlEmail}
                        onChange={(e) => setNlEmail(e.target.value)}
                        placeholder="you@studio.com"
                        className="w-40 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 placeholder:text-white/20 focus:border-[#d4a853]/40 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={nlStatus === "loading"}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:border-[#d4a853]/40 hover:text-[#d4a853] disabled:opacity-50"
                      >
                        {nlStatus === "loading" ? "…" : "Notify me"}
                      </button>
                    </form>
                    {nlStatus === "error" && (
                      <p className="mt-2 text-[10px] text-red-400/70">Something went wrong — try again.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex flex-wrap justify-center gap-x-8 gap-y-2 px-8 font-mono text-[9px] tracking-widest uppercase text-white/10">
            <a href="#lp-pricing" className="hover:text-white/30 transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-white/30 transition-colors">Log in</Link>
            <a href="mailto:hello@usecineflow.com" className="hover:text-white/30 transition-colors">Contact</a>
            <Link href="/privacy" className="hover:text-white/30 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/30 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </section>

      </div>
    </div>
  );
}
