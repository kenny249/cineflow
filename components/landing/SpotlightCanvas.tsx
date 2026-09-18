"use client";

import { useEffect, useRef } from "react";

// Ambient cursor light. Adapted from an earlier, heavier version that punched
// a spotlight through a near-opaque dark overlay (a full page takeover) —
// this one only ever adds warm light via additive/"screen" compositing
// against a transparent canvas, so it layers safely over real content
// instead of dimming it. Originally also trailed gold ember particles;
// dropped after feedback that they read as distracting sparkles.
export function SpotlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });
  const active = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;

    function resize() {
      // clientWidth/Height reflect the true visible viewport more reliably
      // than window.innerWidth/Height — see BackgroundCanvas.tsx.
      canvas!.width = document.documentElement.clientWidth;
      canvas!.height = document.documentElement.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent | TouchEvent) {
      active.current = true;
      const x = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      mouse.current.x = x / document.documentElement.clientWidth;
      mouse.current.y = y / document.documentElement.clientHeight;
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });

    function draw() {
      raf = requestAnimationFrame(draw);
      current.current.x += (mouse.current.x - current.current.x) * 0.4;
      current.current.y += (mouse.current.y - current.current.y) * 0.4;

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      if (!active.current) return;

      const cx = current.current.x * canvas!.width;
      const cy = current.current.y * canvas!.height;
      const r = Math.min(canvas!.width, canvas!.height) * 0.16;

      // Soft warm light pool centered on the cursor — additive only, never darkens
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      pool.addColorStop(0, "rgba(255,240,200,0.045)");
      pool.addColorStop(0.4, "rgba(212,168,83,0.03)");
      pool.addColorStop(1, "rgba(212,168,83,0)");
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
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
