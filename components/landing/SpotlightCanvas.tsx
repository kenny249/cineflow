"use client";

import { useEffect, useRef } from "react";

export function SpotlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });

  // Gold ember particles that follow the cursor
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
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      mouse.current.x = x / window.innerWidth;
      mouse.current.y = y / window.innerHeight;

      // Spawn embers at cursor
      for (let i = 0; i < 3; i++) {
        embers.current.push({
          x, y,
          vx: (Math.random() - 0.5) * 2.2,
          vy: -Math.random() * 2.5 - 0.5,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.9,
          size: 1.2 + Math.random() * 2.2,
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);

    function draw() {
      raf = requestAnimationFrame(draw);
      current.current.x += (mouse.current.x - current.current.x) * 0.065;
      current.current.y += (mouse.current.y - current.current.y) * 0.065;

      const cx = current.current.x * canvas!.width;
      const cy = current.current.y * canvas!.height;
      const r = Math.min(canvas!.width, canvas!.height) * 0.36;

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      // Dark base
      ctx.fillStyle = "rgba(3,3,8,0.97)";
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      // Spotlight cutout — destination-out punch through dark
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const spot = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      spot.addColorStop(0, "rgba(0,0,0,0.96)");
      spot.addColorStop(0.45, "rgba(0,0,0,0.6)");
      spot.addColorStop(0.8, "rgba(0,0,0,0.15)");
      spot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spot;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Gold rim glow
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const rim = ctx.createRadialGradient(cx, cy, r * 0.78, cx, cy, r * 1.12);
      rim.addColorStop(0, "rgba(212,168,83,0)");
      rim.addColorStop(0.5, "rgba(212,168,83,0.07)");
      rim.addColorStop(1, "rgba(212,168,83,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner center light pool
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.35);
      pool.addColorStop(0, "rgba(255,240,200,0.08)");
      pool.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Embers
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      embers.current = embers.current.filter(e => e.life > 0);
      embers.current.forEach(e => {
        e.x += e.vx;
        e.y += e.vy;
        e.vy += 0.04; // gentle gravity
        e.vx *= 0.97;
        e.life -= 0.025 / e.maxLife;
        const alpha = Math.max(0, e.life) * 0.85;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * e.life, 0, Math.PI * 2);
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
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}
