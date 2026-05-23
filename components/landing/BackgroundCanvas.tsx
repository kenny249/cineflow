"use client";

import { useEffect, useRef } from "react";
import { scrollState } from "./scrollState";

interface Star {
  x: number; y: number; r: number;
  base: number; speed: number; phase: number;
  gold: boolean;
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

    // ── Stars ──────────────────────────────────────────────────────────────
    const stars: Star[] = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.2 + Math.random() * 0.9,
      base: 0.04 + Math.random() * 0.20,
      speed: 0.3 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      gold: Math.random() < 0.06,
    }));

    // ── Clarity embers ─────────────────────────────────────────────────────
    const embers = Array.from({ length: 140 }, () => ({
      x: Math.random(), y: Math.random() * 1.3,
      vy: -(0.00025 + Math.random() * 0.00045),
      opacity: 0.15 + Math.random() * 0.5,
      size: 0.6 + Math.random() * 1.2,
    }));

    let t = 0;

    function draw() {
      t += 0.016;
      const p = scrollState.prog;
      const pClarity = Math.max(0, Math.min(1, (p - 0.44) / 0.22));

      // ── Solid background ────────────────────────────────────────────────
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, W, H);

      // ── Subtle gold warmth during clarity ───────────────────────────────
      if (pClarity > 0) {
        const a = pClarity * 0.07;
        const g = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, Math.min(W, H) * 0.7);
        g.addColorStop(0, `rgba(212,168,83,${a})`);
        g.addColorStop(1, "rgba(212,168,83,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── Stars ───────────────────────────────────────────────────────────
      stars.forEach(s => {
        const tw = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
        let a = s.base * (0.5 + 0.5 * tw);
        if (s.gold) a *= 0.3 + pClarity * 0.7;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.gold ? `rgba(212,168,83,${a})` : `rgba(210,220,255,${a})`;
        ctx.fill();
      });

      // ── Clarity embers ──────────────────────────────────────────────────
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

      // ── Vignette ────────────────────────────────────────────────────────
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
