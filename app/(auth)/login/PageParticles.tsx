"use client";

import { useEffect, useRef } from "react";

type P = {
  x: number; y: number; vx: number; vy: number;
  r: number; gold: boolean; o: number;
};

export function PageParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const particles = useRef<P[]>([]);
  const raf = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    particles.current = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 0.7 + Math.random() * 1.4,
      gold: Math.random() < 0.22,
      o: 0.04 + Math.random() * 0.1,
    }));

    const REPEL = 110;
    const ATTRACT = 260;
    const CONNECT = 110;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { x: mx, y: my } = mouse.current;

      // ── Cursor spotlight ──
      if (mx > -500) {
        const outer = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
        outer.addColorStop(0, "rgba(212,168,83,0.028)");
        outer.addColorStop(0.45, "rgba(212,168,83,0.009)");
        outer.addColorStop(1, "rgba(212,168,83,0)");
        ctx.fillStyle = outer;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const inner = ctx.createRadialGradient(mx, my, 0, mx, my, 72);
        inner.addColorStop(0, "rgba(255,245,210,0.04)");
        inner.addColorStop(1, "rgba(255,245,210,0)");
        ctx.fillStyle = inner;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const pts = particles.current;

      for (const p of pts) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL && dist > 0) {
          const force = ((REPEL - dist) / REPEL) * 0.6;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        } else if (dist < ATTRACT && dist > REPEL) {
          const force = ((ATTRACT - dist) / (ATTRACT - REPEL)) * 0.07;
          p.vx -= (dx / dist) * force;
          p.vy -= (dy / dist) * force;
        }
        p.vx *= 0.972;
        p.vy *= 0.972;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 2) { p.vx = (p.vx / speed) * 2; p.vy = (p.vy / speed) * 2; }
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
      }

      // Connection lines
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const alpha = (1 - d / CONNECT) * 0.08;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = (pts[i].gold || pts[j].gold)
              ? `rgba(212,168,83,${alpha})`
              : `rgba(229,231,235,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // Dots
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(212,168,83,${p.o})`
          : `rgba(229,231,235,${p.o})`;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
