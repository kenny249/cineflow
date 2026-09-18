"use client";

import { useEffect, useRef } from "react";

// Ambient cursor light + trailing gold embers. Adapted from an earlier, heavier
// version that punched a spotlight through a near-opaque dark overlay (a full
// page takeover) — this one only ever adds warm light via additive/"screen"
// compositing against a transparent canvas, so it layers safely over real
// content instead of dimming it.
export function SpotlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });
  const active = useRef(false);

  type Ember = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number };
  const embers = useRef<Ember[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent | TouchEvent) {
      active.current = true;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      mouse.current.x = x / window.innerWidth;
      mouse.current.y = y / window.innerHeight;

      for (let i = 0; i < 3; i++) {
        embers.current.push({
          x, y,
          vx: (Math.random() - 0.5) * 1.8,
          vy: -Math.random() * 2.0 - 0.4,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.9,
          size: 1.0 + Math.random() * 1.8,
        });
      }
      if (embers.current.length > 160) embers.current.splice(0, embers.current.length - 160);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    function draw() {
      raf = requestAnimationFrame(draw);
      current.current.x += (mouse.current.x - current.current.x) * 0.065;
      current.current.y += (mouse.current.y - current.current.y) * 0.065;

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      if (!active.current && embers.current.length === 0) return;

      const cx = current.current.x * canvas!.width;
      const cy = current.current.y * canvas!.height;
      const r = Math.min(canvas!.width, canvas!.height) * 0.32;

      // Soft warm light pool centered on the cursor — additive only, never darkens
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      pool.addColorStop(0, "rgba(255,240,200,0.10)");
      pool.addColorStop(0.4, "rgba(212,168,83,0.07)");
      pool.addColorStop(1, "rgba(212,168,83,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Embers
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      embers.current = embers.current.filter(e => e.life > 0);
      embers.current.forEach(e => {
        e.x += e.vx;
        e.y += e.vy;
        e.vy += 0.04;
        e.vx *= 0.97;
        e.life -= 0.025 / e.maxLife;
        const clampedLife = Math.max(0, e.life);
        const alpha = clampedLife * 0.9;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * clampedLife, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,168,83,${alpha})`;
        ctx.fill();
      });
      ctx.restore();
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[1] hidden sm:block"
      style={{ pointerEvents: "none", mixBlendMode: "screen" }}
    />
  );
}
