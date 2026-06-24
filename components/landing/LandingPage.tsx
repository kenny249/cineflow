"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film, Check } from "lucide-react";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { scrollState } from "./scrollState";
import { AdPixels } from "@/components/shared/AdPixels";

interface Props { refCode?: string }

const FRAGMENTS = [
  { text: '"where are we at?" · 11:47pm',     mono: false, x: "4%",  y: "20%", rot: -3, d: 0.6,  dur: 3.8 },
  { text: "Invoice_v4_FINAL_FINAL.pdf",        mono: true,  x: "70%", y: "16%", rot:  4, d: 1.0,  dur: 4.2 },
  { text: '"did you get the rough cut link?"', mono: false, x: "3%",  y: "60%", rot: -2, d: 1.2,  dur: 3.5 },
  { text: "shot_list_REVISED_use_this.xlsx",   mono: true,  x: "68%", y: "72%", rot:  5, d: 0.8,  dur: 4.5 },
  { text: '"can you resend the contract?"',    mono: false, x: "74%", y: "42%", rot: -4, d: 1.4,  dur: 3.9 },
  { text: "Client approval: pending 14d",      mono: false, x: "8%",  y: "80%", rot:  3, d: 1.0,  dur: 4.1 },
  { text: '"what time is call time again?"',   mono: false, x: "12%", y: "38%", rot: -5, d: 1.5,  dur: 3.6 },
  { text: "call_sheet_saturday_v4.pdf",        mono: true,  x: "58%", y: "24%", rot:  3, d: 0.9,  dur: 4.3 },
  { text: '"I never got the invoice 🙏"',      mono: false, x: "76%", y: "60%", rot: -3, d: 1.3,  dur: 3.7 },
  { text: '"just checking in again..."',       mono: false, x: "28%", y: "19%", rot:  2, d: 1.6,  dur: 4.0 },
] as const;

const PANELS = [
  {
    num: "01", tag: "Production",
    h: ["Your whole", "production.", "One view."] as const,
    sub: "Shot lists, call sheets, and scheduling. Everything your crew needs, right where your project lives.",
    note: "Replaces StudioBinder + Notion",
  },
  {
    num: "02", tag: "Client Portal",
    h: ["Clients stay", "in the loop.", "Automatically."] as const,
    sub: "Every client gets their own portal. They see progress, approve cuts, and sign off. Without texting you.",
    note: 'No more "hey, are the videos done yet?"',
  },
  {
    num: "03", tag: "Payments",
    h: ["Stop chasing", "your own", "money."] as const,
    sub: "Professional invoices, deposit collection, and automated reminders, right next to the project.",
    note: "Replaces HoneyBook + DocuSign",
  },
] as const;

const LP_PLANS = [
  {
    name: "Solo",
    price: 39,
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
  { stat: "Zero chaos.",      sub: "Everything in one place. Nothing falls through." },
] as const;

const TESTIMONIALS = [
  "Dude this is a game changer.",
  "This makes my life so much easier.",
  "I genuinely needed this.",
] as const;

export function LandingPage({ refCode }: Props) {
  const href = refCode ? `/signup?ref=${refCode}` : "/signup";

  useEffect(() => {
    let teardown: (() => void) | undefined;

    (async () => {
      const { default: Lenis } = await import("lenis");

      const lenis = new Lenis({ lerp: 0.10, smoothWheel: true });
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

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10">
            <Film className="h-3.5 w-3.5 text-[#d4a853]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white/90">CineFlow</span>
        </div>
        <Link
          href={href}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm transition-all hover:border-[#d4a853]/50 hover:text-[#d4a853]"
        >
          Start free trial
        </Link>
      </nav>

      <div className="relative z-20">

        {/* ══ HERO ══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 text-center">

          {/* Hidden on mobile — overlap hero content on small screens */}
          {FRAGMENTS.map((f, i) => (
            <div
              key={i}
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
              className="lp-hero-line mb-12 h-px w-56"
              style={{ background: "linear-gradient(90deg,transparent,rgba(212,168,83,0.42),transparent)" }}
            />
            <p className="lp-hero-kicker mb-5 text-[11px] font-medium tracking-[0.32em] uppercase text-white/40">
              The all-in-one studio platform
            </p>
            <h1
              className="lp-hero-headline max-w-3xl font-sans font-black leading-[1.04] tracking-tighter text-white"
              style={{ fontSize: "clamp(2.2rem,4.2vw,3.8rem)" }}
            >
              Stop stitching your<br />production together.
            </h1>
            <p className="lp-hero-sub mt-6 max-w-sm text-[13px] leading-relaxed text-white/48">
              Shot lists, client portals, invoicing, crew scheduling.<br />All flowing in one place. Finally.
            </p>
            <Link
              href={href}
              className="lp-hero-cta mt-8 rounded-xl bg-[#d4a853] px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(212,168,83,0.35)]"
            >
              Start for free →
            </Link>
            <p className="lp-hero-trust mt-3 font-mono text-[9px] tracking-[0.28em] uppercase text-white/22">
              No credit card required · Cancel anytime
            </p>
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
        <section className="relative flex items-center justify-center px-8 py-24 text-center">
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
            <div className="lp-clip mt-8">
              <Link
                href={href}
                className="lp-clip-inner inline-block rounded-xl bg-[#d4a853] px-7 py-3 text-sm font-bold text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(212,168,83,0.35)]"
                style={{ "--di": "0.34s" } as React.CSSProperties}
              >
                Start for free →
              </Link>
            </div>
          </div>
        </section>

        {/* ══ SCATTER TRANSITION ════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-10">
          <div className="relative mx-auto h-28 max-w-2xl">
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
        <section className="relative flex flex-col items-center justify-center px-8 py-20 text-center">
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
              <div
                className="font-black leading-none tracking-tighter"
                style={{
                  background: "linear-gradient(135deg,#ffffff 34%,#d4a853 63%,#fff3c4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "block",
                }}
              >CineFlow</div>
            </div>

            <div className="lp-clip mt-7">
              <p className="lp-clip-inner mx-auto max-w-sm text-[13px] leading-relaxed text-white/28"
                style={{ "--di": "0.30s" } as React.CSSProperties}>
                Everything your production runs on. Finally in one place.
              </p>
            </div>
          </div>
        </section>

        {/* ══ PANELS ════════════════════════════════════════════════════ */}
        <section className="relative py-20 px-8">
          <div className="mx-auto max-w-xl flex flex-col items-center gap-20">
            {PANELS.map((panel, i) => (
              <div
                key={i}
                data-reveal="clip"
                className="flex flex-col items-center text-center"
              >
                <div className="lp-clip mb-6">
                  <p className="lp-clip-inner font-mono text-[10px] tracking-[0.42em] uppercase text-[#d4a853]/48"
                    style={{ "--di": "0s" } as React.CSSProperties}>
                    {panel.num} · {panel.tag}
                  </p>
                </div>
                <div
                  className="font-black leading-[1.06] tracking-tighter text-white"
                  style={{ fontSize: "clamp(3rem,6.5vw,5.8rem)" }}
                >
                  <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.08s" } as React.CSSProperties}>{panel.h[0]}</div></div>
                  <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.16s" } as React.CSSProperties}>{panel.h[1]}</div></div>
                  <div className="lp-clip"><div className="lp-clip-inner text-[#d4a853]" style={{ "--di": "0.24s" } as React.CSSProperties}>{panel.h[2]}</div></div>
                </div>
                <div className="lp-clip my-7">
                  <div className="lp-clip-inner h-px w-8 bg-[#d4a853]/22" style={{ "--di": "0.30s" } as React.CSSProperties} />
                </div>
                <div className="lp-clip">
                  <p className="lp-clip-inner max-w-xs text-[13px] leading-relaxed text-white/48"
                    style={{ "--di": "0.36s" } as React.CSSProperties}>{panel.sub}</p>
                </div>
                <div className="lp-clip mt-5">
                  <p className="lp-clip-inner font-mono text-[9px] tracking-[0.32em] uppercase text-white/18"
                    style={{ "--di": "0.42s" } as React.CSSProperties}>{panel.note}</p>
                </div>
              </div>
            ))}
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
                  className="rounded-2xl px-6 py-7"
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

        {/* ══ TESTIMONIALS ══════════════════════════════════════════════ */}
        <section className="relative py-16 px-8">
          <div className="mx-auto max-w-3xl grid gap-10 sm:grid-cols-3">
            {TESTIMONIALS.map((quote) => (
              <div key={quote} data-reveal className="flex flex-col items-center text-center">
                <p
                  className="font-black leading-[1.18] tracking-tight text-white/75"
                  style={{ fontSize: "clamp(1rem,1.8vw,1.25rem)" }}
                >
                  &ldquo;{quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ══ PRICING ═══════════════════════════════════════════════════ */}
        <section className="relative py-24 px-8">
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
              <p className="mt-1.5 font-mono text-[10px] text-[#d4a853]/55 tracking-wide">
                Save ~20% with annual billing
              </p>
            </div>

            <div data-reveal className="grid gap-4 sm:grid-cols-3">
              {LP_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className="relative flex flex-col rounded-2xl p-6"
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
                      ${plan.price}
                    </span>
                    <span className="ml-1 text-xs text-white/28">/mo</span>
                  </div>

                  <ul className="mb-8 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-xs text-white/45">
                        <Check className={`mt-0.5 h-3 w-3 shrink-0 ${plan.popular ? "text-[#d4a853]" : "text-white/28"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={href}
                    className={`block w-full rounded-xl py-2.5 text-center text-xs font-bold transition-all ${
                      plan.popular
                        ? "bg-[#d4a853] text-black hover:bg-[#d4a853]/90 hover:shadow-[0_0_28px_rgba(212,168,83,0.22)]"
                        : "border border-white/[0.08] text-white/55 hover:border-[#d4a853]/30 hover:text-[#d4a853]"
                    }`}
                  >
                    Start free trial
                  </Link>
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
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0s" } as React.CSSProperties}>Everything in one place.</div></div>
              <div className="lp-clip"><div className="lp-clip-inner" style={{ "--di": "0.10s" } as React.CSSProperties}>Finally.</div></div>
            </div>
            <div className="lp-clip mb-5">
              <p className="lp-clip-inner max-w-xs text-[13px] leading-relaxed text-white/40"
                style={{ "--di": "0.20s" } as React.CSSProperties}>
                Join filmmakers and video teams already running their productions on CineFlow.
              </p>
            </div>
            <div className="lp-clip mb-2 mt-1">
              <Link
                href={href}
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
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 font-mono text-[9px] tracking-widest uppercase text-white/10">
            <Link href="/privacy" className="hover:text-white/30 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/30 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </section>

      </div>
    </div>
  );
}
