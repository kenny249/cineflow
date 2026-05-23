"use client";

import { useEffect, useRef } from "react";
import { scrollState } from "./scrollState";

interface Star {
  x: number; y: number; r: number;
  base: number; speed: number; phase: number;
  gold: boolean;
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
    let W = window.innerWidth, H = window.innerHeight;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas!.width = W; canvas!.height = H;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Stars ────────────────────────────────────────────────────────────────
    const stars: Star[] = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.2 + Math.random() * 0.9,
      base: 0.04 + Math.random() * 0.20,
      speed: 0.3 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      gold: Math.random() < 0.06,
    }));

    // ── Explosion particles ───────────────────────────────────────────────────
    let particles: Particle[] = [];
    let exploded = false;
    let flashAlpha = 0;       // decays smoothly — no looping
    let shockR = -1;
    let shock2R = -1;

    function boom() {
      const cx = W / 2, cy = H / 2;
      for (let i = 0; i < 1400; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 9;
        particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 0.75 + Math.random() * 0.25, decay: 0.007 + Math.random() * 0.009, size: 1 + Math.random() * 3 });
      }
      flashAlpha = 1; shockR = 0; shock2R = 0;
    }

    // ── Clarity embers ────────────────────────────────────────────────────────
    const embers = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random() * 1.3,
      vy: -(0.00025 + Math.random() * 0.00045),
      opacity: 0.15 + Math.random() * 0.5, size: 0.6 + Math.random() * 1.2,
    }));

    let t = 0;

    function draw() {
      t += 0.016;
      const p = scrollState.prog;

      const clarityStart = 0.46;
      const pClarity = Math.max(0, Math.min(1, (p - clarityStart) / 0.20));

      if (p > 0.44 && !exploded) { exploded = true; boom(); }

      // ── Solid dark background (never changes — Apple restraint) ─────────────
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      // ── Very subtle gold warmth during clarity ────────────────────────────
      if (pClarity > 0) {
        const a = pClarity * 0.07;
        const g = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, Math.min(W, H) * 0.7);
        g.addColorStop(0, `rgba(212,168,83,${a})`);
        g.addColorStop(1, "rgba(212,168,83,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── Stars ────────────────────────────────────────────────────────────────
      stars.forEach(s => {
        const sx = s.x * W;
        const sy = s.y * H;
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        let a = s.base * (0.5 + 0.5 * tw);
        if (s.gold) a *= 0.3 + pClarity * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.gold
          ? `rgba(212,168,83,${a})`
          : `rgba(210,220,255,${a})`;
        ctx.fill();
      });

      // ── White flash — smooth single decay, never repeats ─────────────────────
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha = Math.max(0, flashAlpha - 0.065); // ~15 frames to fade
      }

      // ── Shockwave rings ───────────────────────────────────────────────────────
      if (shockR >= 0) {
        shockR += 28; shock2R += 17;
        const maxR = Math.sqrt(W * W + H * H);
        const a1 = Math.max(0, 0.85 * (1 - shockR / (maxR * 0.8)));
        if (a1 > 0.005) {
          ctx.beginPath(); ctx.arc(W / 2, H / 2, shockR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(212,168,83,${a1})`;
          ctx.lineWidth = 2.5 * a1; ctx.stroke();
        } else { shockR = -1; }
        const a2 = Math.max(0, 0.5 * (1 - shock2R / (maxR * 0.65)));
        if (a2 > 0.005) {
          ctx.beginPath(); ctx.arc(W / 2, H / 2, shock2R, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,240,180,${a2})`;
          ctx.lineWidth = 1.5 * a2; ctx.stroke();
        }
      }

      // ── Explosion particles ───────────────────────────────────────────────────
      if (particles.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p2 = particles[i];
          p2.x += p2.vx; p2.y += p2.vy;
          p2.vx *= 0.975; p2.vy = p2.vy * 0.975 + 0.055;
          p2.life -= p2.decay;
          if (p2.life <= 0) { particles.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.arc(p2.x, p2.y, Math.max(0.1, p2.size * p2.life), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,168,83,${p2.life * 0.8})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Clarity embers — gentle upward drift ─────────────────────────────────
      if (pClarity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        embers.forEach(e => {
          e.y = ((e.y + e.vy) + 1.3) % 1.3;
          ctx.beginPath();
          ctx.arc(e.x * W, e.y * H, e.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(212,168,83,${e.opacity * pClarity * 0.6})`;
          ctx.fill();
        });
        ctx.restore();
      }

      // ── Vignette (always) ────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.68)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    let raf: number;
    function loop() { raf = requestAnimationFrame(loop); draw(); }
    loop();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="fixed inset-0 z-0" style={{ pointerEvents: "none" }} />;
}
