"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { CinematicScene } from "./CinematicScene";
import { SpotlightCanvas } from "./SpotlightCanvas";

interface Props { refCode?: string }

export function LandingPage({ refCode }: Props) {
  const signupHref = refCode ? `/signup?ref=${refCode}` : "/signup";

  useEffect(() => {
    let kill: (() => void) | undefined;

    (async () => {
      const { default: gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      const { default: Lenis } = await import("lenis");
      // @ts-ignore — splitting has no perfect types but works at runtime
      const Splitting = (await import("splitting")).default;

      gsap.registerPlugin(ScrollTrigger);

      // ── Lenis smooth scroll ──────────────────────────────────────────────
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);

      // ── Splitting.js — split all [data-split] elements into chars ────────
      const splitTargets = document.querySelectorAll<HTMLElement>("[data-split]");
      Splitting({ target: splitTargets, by: "chars" });

      const ctx = gsap.context(() => {

        // ── "ENOUGH." — char stagger reveal after explosion ──────────────────
        const enoughChars = document.querySelectorAll<HTMLElement>("#enough .char");
        if (enoughChars.length) {
          gsap.set(enoughChars, { y: 120, opacity: 0, rotateX: -90 });
          gsap.to(enoughChars, {
            y: 0, opacity: 1, rotateX: 0,
            duration: 0.9, ease: "power4.out",
            stagger: 0.045,
            scrollTrigger: {
              trigger: "#s-explode",
              start: "top 20%",
              toggleActions: "play none none none",
            },
            delay: 0.8,
          });
        }

        // ── "CINEFLOW" — cinematic letter rise ───────────────────────────────
        const cineChars = document.querySelectorAll<HTMLElement>("#cineflow-title .char");
        if (cineChars.length) {
          gsap.set(cineChars, { y: 160, opacity: 0, skewX: 8 });
          gsap.to(cineChars, {
            y: 0, opacity: 1, skewX: 0,
            duration: 1.1, ease: "expo.out",
            stagger: 0.055,
            scrollTrigger: {
              trigger: "#s-intro",
              start: "top 62%",
              toggleActions: "play none none none",
            },
          });
        }

        // ── Subtitle under CineFlow ──────────────────────────────────────────
        gsap.fromTo("#intro-sub",
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 1.1, ease: "power3.out",
            scrollTrigger: { trigger: "#s-intro", start: "top 45%" },
            delay: 0.7,
          }
        );

        // ── Pain point overlays ──────────────────────────────────────────────
        document.querySelectorAll<HTMLElement>("[data-pain]").forEach((el, i) => {
          const chars = el.querySelectorAll<HTMLElement>(".char");
          if (chars.length) {
            gsap.set(chars, { y: 60, opacity: 0 });
            gsap.to(chars, {
              y: 0, opacity: 1,
              duration: 0.7, ease: "power3.out",
              stagger: 0.018,
              scrollTrigger: { trigger: el, start: "top 80%" },
            });
            // Auto fade out as user scrolls past
            gsap.to(el, {
              opacity: 0, y: -30,
              duration: 0.5, ease: "power2.in",
              scrollTrigger: { trigger: el, start: "bottom 40%", toggleActions: "play none none reverse" },
            });
          } else {
            gsap.fromTo(el,
              { y: 50, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
                scrollTrigger: { trigger: el, start: "top 80%" } }
            );
          }
        });

        // ── Gold line ────────────────────────────────────────────────────────
        gsap.fromTo("#gold-line",
          { scaleX: 0 },
          {
            scaleX: 1, duration: 1.6, ease: "expo.inOut",
            scrollTrigger: { trigger: "#s-intro", start: "top 75%" },
          }
        );

        // ── Showcase labels ──────────────────────────────────────────────────
        document.querySelectorAll<HTMLElement>("[data-showcase]").forEach((el) => {
          gsap.fromTo(el,
            { opacity: 0, y: 20 },
            {
              opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
              scrollTrigger: { trigger: el, start: "top 70%", toggleActions: "play none none reverse" },
            }
          );
        });

        // ── CTA elements ─────────────────────────────────────────────────────
        const ctaTitle = document.querySelectorAll<HTMLElement>("#cta-title .char");
        if (ctaTitle.length) {
          gsap.set(ctaTitle, { y: 80, opacity: 0 });
          gsap.to(ctaTitle, {
            y: 0, opacity: 1,
            duration: 1.0, ease: "expo.out",
            stagger: 0.03,
            scrollTrigger: { trigger: "#s-cta", start: "top 72%" },
          });
        }
        document.querySelectorAll<HTMLElement>("[data-cta]").forEach((el, i) => {
          gsap.fromTo(el,
            { y: 28, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.85, ease: "power3.out",
              scrollTrigger: { trigger: "#s-cta", start: "top 65%" },
              delay: 0.5 + i * 0.14,
            }
          );
        });
      });

      kill = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
        ctx.revert();
      };
    })();

    return () => kill?.();
  }, []);

  return (
    <>
      {/* ── Fixed Three.js world ───────────────────────────────────────── */}
      <CinematicScene />

      {/* ── Fixed nav ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#d4a853]/40 bg-[#d4a853]/10 backdrop-blur-sm">
            <Film className="h-4 w-4 text-[#d4a853]" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">CineFlow</span>
        </div>
        <Link
          href={signupHref}
          className="rounded-xl border border-[#d4a853]/40 bg-black/30 px-4 py-2 text-xs font-bold text-[#d4a853] backdrop-blur-sm transition-all hover:bg-[#d4a853] hover:text-black hover:border-[#d4a853]"
        >
          Get early access
        </Link>
      </nav>

      {/* ── Scrollable content overlay ─────────────────────────────────── */}
      <div className="relative z-10" style={{ background: "transparent" }}>

        {/* ══ ACT 1: ARRIVAL (0–14% scroll) ════════════════════════════ */}
        {/* Section is tall to give scroll room, no visible content needed —
            the Three.js scene is the show here */}
        <div id="s-arrival" style={{ height: "14vh" }} />

        {/* ══ ACT 2: THE PROBLEM / CHAOS (14–38%) ══════════════════════ */}
        {/* Pain points appear as floating overlays on the dark canvas */}
        <div
          id="s-chaos"
          className="relative flex flex-col items-center justify-center"
          style={{ height: "24vh" }}
        >
          <div className="flex flex-col items-center gap-24">
            <div
              data-pain
              data-split
              className="max-w-lg text-center font-black leading-tight text-white/90"
              style={{ fontSize: "clamp(1.3rem, 2.4vw, 2rem)", perspective: "600px" }}
            >
              Shot lists buried in email threads.
            </div>
            <div
              data-pain
              data-split
              className="max-w-lg text-center font-black leading-tight text-white/90"
              style={{ fontSize: "clamp(1.3rem, 2.4vw, 2rem)", perspective: "600px" }}
            >
              Invoices chased for 60 days.
            </div>
            <div
              data-pain
              data-split
              className="max-w-lg text-center font-black leading-tight text-white/90"
              style={{ fontSize: "clamp(1.3rem, 2.4vw, 2rem)", perspective: "600px" }}
            >
              Clients texting at 11pm.
            </div>
          </div>
        </div>

        {/* ══ ACT 3: BREAKING POINT (38–47%) ═══════════════════════════ */}
        <div style={{ height: "9vh" }} />

        {/* ══ ACT 4: EXPLOSION (47–53%) ════════════════════════════════ */}
        <div
          id="s-explode"
          className="relative flex flex-col items-center justify-center"
          style={{ height: "6vh" }}
        >
          {/* "ENOUGH." rises after explosion */}
          <div
            id="enough"
            data-split
            className="font-black tracking-tight text-white text-center"
            style={{ fontSize: "clamp(3rem, 8vw, 7rem)", perspective: "800px", overflow: "hidden" }}
          >
            ENOUGH.
          </div>
        </div>

        {/* ══ ACT 5: CLARITY / INTRODUCTION (53–70%) ═══════════════════ */}
        <div
          id="s-intro"
          className="relative flex flex-col items-center justify-center"
          style={{ height: "17vh" }}
        >
          <div className="mx-auto w-full max-w-5xl px-8">
            {/* Gold line */}
            <div className="mb-10 h-px overflow-hidden bg-white/5">
              <div
                id="gold-line"
                className="h-full w-full bg-[#d4a853]"
                style={{ transformOrigin: "left center", transform: "scaleX(0)" }}
              />
            </div>

            <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.4em] text-[#d4a853]">
              Introducing
            </p>

            {/* CINEFLOW — Splitting.js char reveal */}
            <div
              id="cineflow-title"
              data-split
              className="font-black leading-none tracking-tighter"
              style={{
                fontSize: "clamp(4rem, 10vw, 9rem)",
                overflow: "hidden",
                background: "linear-gradient(135deg, #ffffff 60%, #d4a853 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CineFlow
            </div>

            <p
              id="intro-sub"
              className="mt-6 max-w-sm text-sm leading-relaxed text-white/35"
              style={{ opacity: 0 }}
            >
              One platform. Every production.<br />
              Built for agencies done juggling.
            </p>
          </div>
        </div>

        {/* ══ ACT 6: SHOWCASE (70–90%) — 3 pinned-feeling beats ════════ */}
        <div
          id="s-showcase"
          className="relative"
          style={{ height: "20vh" }}
        >
          {/* Three label moments, stacked so they appear as user scrolls */}
          <div className="flex flex-col items-center justify-around h-full py-8 gap-12">
            {[
              { label: "Dashboard", desc: "Every project. Every status. One view." },
              { label: "Collaboration", desc: "Your whole crew. Fully in the loop." },
              { label: "Clients & Finance", desc: "Get paid. Get approved. Move on." },
            ].map(({ label, desc }, i) => (
              <div
                key={i}
                data-showcase
                className="text-center"
                style={{ opacity: 0 }}
              >
                <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#d4a853] mb-1">{label}</p>
                <p className="text-sm font-semibold text-white/60">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ══ ACT 7: CTA SPOTLIGHT (90–100%) ══════════════════════════ */}
        <div
          id="s-cta"
          className="relative flex flex-col items-center justify-center overflow-hidden"
          style={{ height: "30vh" }}
        >
          {/* SpotlightCanvas fills this section */}
          <div className="absolute inset-0">
            <SpotlightCanvas />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
            {/* CTA headline — Splitting.js */}
            <div
              id="cta-title"
              data-split
              className="font-black leading-tight tracking-tight text-white"
              style={{
                fontSize: "clamp(2rem, 4.5vw, 4rem)",
                overflow: "hidden",
                textShadow: "0 0 80px rgba(212,168,83,0.25)",
              }}
            >
              Ready to direct your agency?
            </div>

            <p data-cta className="text-sm text-white/30 max-w-xs leading-relaxed" style={{ opacity: 0 }}>
              Join media agencies already running on CineFlow.
            </p>

            <Link
              data-cta
              href={signupHref}
              className="rounded-2xl bg-[#d4a853] px-8 py-3.5 text-sm font-black text-black transition-all hover:scale-105 hover:shadow-[0_0_50px_rgba(212,168,83,0.5)]"
              style={{ opacity: 0 }}
            >
              Start for free →
            </Link>

            <p data-cta className="text-[11px] text-white/20" style={{ opacity: 0 }}>
              No credit card required. Cancel anytime.
            </p>
          </div>

          {/* Footer */}
          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 text-[10px] text-white/20">
            <Link href="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
            <span>© 2026 CineFlow</span>
          </div>
        </div>
      </div>
    </>
  );
}
