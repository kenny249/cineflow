"use client";

import { useEffect, useRef } from "react";
import { scrollState } from "./scrollState";

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function phase(p: number, s: number, e: number) { return clamp((p - s) / (e - s), 0, 1); }
function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }

interface Star {
  x: number; y: number;
  r: number; base: number;
  speed: number; phase: number;
  parallax: number; gold: boolean;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; decay: number; size: number;
}

export function BackgroundCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = window.innerWidth;
    let H = window.innerHeight;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas!.width = W; canvas!.height = H;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Stars ───────────────────────────────────────────────────────────────
    const STAR_COUNT = 900;
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.3 + Math.random() * 1.6,
      base: 0.15 + Math.random() * 0.7,
      speed: 0.4 + Math.random() * 2.5,
      phase: Math.random() * Math.PI * 2,
      parallax: 0.1 + Math.random() * 0.9,
      gold: Math.random() < 0.06,
    }));

    // ── Particles (explosion) ────────────────────────────────────────────────
    let particles: Particle[] = [];
    let exploded = false;
    let flashAlpha = 0;
    let shockR = 0;
    let shockActive = false;
    let secondShockR = 0;

    function triggerExplosion() {
      const cx = W / 2, cy = H / 2;
      particles = [];
      for (let i = 0; i < 1600; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.8 + Math.random() * 10;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.7 + Math.random() * 0.3,
          decay: 0.006 + Math.random() * 0.01,
          size: 0.9 + Math.random() * 3.5,
        });
      }
      flashAlpha = 1;
      shockR = 0; shockActive = true;
      secondShockR = 0;
    }

    // ── Floating embers (clarity phase) ─────────────────────────────────────
    const EMBER_COUNT = 300;
    const embers = Array.from({ length: EMBER_COUNT }, () => ({
      x: Math.random() * 1.4 - 0.2,
      y: Math.random() * 1.4 - 0.2,
      vy: -(0.0003 + Math.random() * 0.0006),
      opacity: Math.random() * 0.6,
      size: 0.5 + Math.random() * 1.5,
    }));

    let t = 0;

    function draw() {
      t += 0.016;
      const p = scrollState.prog;

      // Phase weights (all 0-1)
      const pArrival  = easeOut(phase(p, 0,    0.11));
      const pChaos    = easeOut(phase(p, 0.11, 0.40));
      const pCollapse = easeOut(phase(p, 0.36, 0.46));
      const pExplode  = easeOut(phase(p, 0.46, 0.52));
      const pClarity  = easeOut(phase(p, 0.52, 0.72));
      const pCta      = easeOut(phase(p, 0.86, 1.00));

      // Explosion trigger
      if (p > 0.46 && !exploded) { exploded = true; triggerExplosion(); }

      // ── Background ──────────────────────────────────────────────────────
      // cool deep-space → harsh → black → warm gold-dark → rich black
      const bgR = lerp(lerp(5,  14, pChaos), lerp(3, 6, pClarity), pExplode + pClarity);
      const bgG = lerp(lerp(5,  12, pChaos), lerp(3, 5, pClarity), pExplode + pClarity);
      const bgB = lerp(lerp(18, 22, pChaos), lerp(6, 8, pClarity), pExplode + pClarity);
      ctx.fillStyle = `rgb(${bgR|0},${bgG|0},${bgB|0})`;
      ctx.fillRect(0, 0, W, H);

      // ── Center nebula ─────────────────────────────────────────────────────
      {
        const nr = lerp(lerp(18, 10, pCollapse), lerp(212, 150, 1 - pClarity), pClarity);
        const ng = lerp(lerp(28, 16, pCollapse), lerp(168, 100, 1 - pClarity), pClarity);
        const nb = lerp(lerp(90, 30, pCollapse), lerp(83,  50,  1 - pClarity), pClarity);
        const na = (pArrival * 0.15 * (1 - pCollapse) * (1 - pExplode))
                 + (pClarity * 0.20);
        if (na > 0.005) {
          const gr = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W, H) * (0.28 + pClarity * 0.18));
          gr.addColorStop(0, `rgba(${nr|0},${ng|0},${nb|0},${na})`);
          gr.addColorStop(1, `rgba(${nr|0},${ng|0},${nb|0},0)`);
          ctx.fillStyle = gr;
          ctx.fillRect(0, 0, W, H);
        }
      }

      // ── Stars ──────────────────────────────────────────────────────────────
      const scrollOffset = p * 800; // rough pixel scroll equivalent
      stars.forEach(s => {
        let sx = ((s.x + t * 0.0008 * s.parallax) % 1 + 1) % 1;
        let sy = ((s.y + scrollOffset * 0.00018 * s.parallax + t * 0.00015 * s.parallax) % 1 + 1) % 1;
        const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const alpha = s.base * twinkle
          * (1 - pCollapse * 0.6)
          * (1 - pExplode * 0.9)
          * (0.4 + pClarity * 0.6);
        if (alpha < 0.02) return;

        ctx.beginPath();
        ctx.arc(sx * W, sy * H, s.r * (1 + (s.gold ? pClarity * 0.5 : 0)), 0, Math.PI * 2);
        if (s.gold) {
          ctx.fillStyle = `rgba(212,168,83,${alpha * (0.2 + pClarity * 0.8)})`;
        } else {
          ctx.fillStyle = `rgba(${lerp(180, 210, pChaos)|0},${lerp(190, 215, pChaos * 0.3)|0},${lerp(255, 240, pChaos * 0.6)|0},${alpha})`;
        }
        ctx.fill();

        // Subtle cross-spike on bright stars
        if (s.r > 1.2 && alpha > 0.4) {
          const spike = s.r * 3 * alpha;
          ctx.strokeStyle = s.gold
            ? `rgba(212,168,83,${alpha * 0.25})`
            : `rgba(200,220,255,${alpha * 0.15})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(sx * W - spike, sy * H); ctx.lineTo(sx * W + spike, sy * H); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx * W, sy * H - spike); ctx.lineTo(sx * W, sy * H + spike); ctx.stroke();
        }
      });

      // ── Chaos flicker ──────────────────────────────────────────────────────
      if (pCollapse > 0) {
        const flicker = (Math.sin(t * 55) * 0.5 + 0.5) * (Math.sin(t * 31) * 0.5 + 0.5);
        ctx.fillStyle = `rgba(180,210,255,${pCollapse * flicker * 0.055})`;
        ctx.fillRect(0, 0, W, H);
      }

      // ── White flash ────────────────────────────────────────────────────────
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha = Math.max(0, flashAlpha - 0.09);
      }

      // ── Shockwaves ─────────────────────────────────────────────────────────
      if (shockActive) {
        shockR += 32; secondShockR += 20;
        const maxR = Math.sqrt(W * W + H * H);
        const a1 = Math.max(0, 1 - shockR / (maxR * 0.75));
        if (a1 <= 0.01) { shockActive = false; }
        ctx.save();
        ctx.beginPath();
        ctx.arc(W/2, H/2, shockR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,168,83,${a1 * 0.95})`;
        ctx.lineWidth = 3.5 * a1;
        ctx.stroke();
        const a2 = Math.max(0, 1 - secondShockR / (maxR * 0.6));
        ctx.beginPath();
        ctx.arc(W/2, H/2, secondShockR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,240,180,${a2 * 0.5})`;
        ctx.lineWidth = 2 * a2;
        ctx.stroke();
        ctx.restore();
      }

      // ── Explosion particles ────────────────────────────────────────────────
      if (particles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p2 = particles[i];
          p2.x += p2.vx; p2.y += p2.vy;
          p2.vx *= 0.972; p2.vy = p2.vy * 0.972 + 0.06;
          p2.life -= p2.decay;
          if (p2.life <= 0) { particles.splice(i, 1); continue; }
          const a = Math.max(0, p2.life) * 0.85;
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, Math.max(0.2, p2.size * p2.life), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,168,83,${a})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Clarity embers ─────────────────────────────────────────────────────
      if (pClarity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        embers.forEach(e => {
          e.y = ((e.y + e.vy) + 1.4) % 1.4 - 0.2;
          const a = e.opacity * pClarity * (1 - pCta * 0.7);
          if (a < 0.01) return;
          ctx.beginPath();
          ctx.arc(e.x * W, e.y * H, e.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,168,83,${a})`;
          ctx.fill();
        });
        ctx.restore();
      }

      // ── Dark vignette (always) ────────────────────────────────────────────
      {
        const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.28, W/2, H/2, Math.max(W,H)*0.72);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.72)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    let raf: number;
    function loop() { raf = requestAnimationFrame(loop); draw(); }
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 z-0" style={{ pointerEvents: "none" }} />;
}
