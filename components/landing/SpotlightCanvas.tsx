"use client";

import { useEffect, useRef } from "react";

export function SpotlightCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });

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
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove);

    function draw() {
      raf = requestAnimationFrame(draw);
      // Lerp cursor
      current.current.x += (mouse.current.x - current.current.x) * 0.07;
      current.current.y += (mouse.current.y - current.current.y) * 0.07;

      const cx = current.current.x * canvas!.width;
      const cy = current.current.y * canvas!.height;
      const r = Math.min(canvas!.width, canvas!.height) * 0.38;

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      // Dark overlay
      ctx.fillStyle = "rgba(6,6,6,0.96)";
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      // Spotlight cutout
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, "rgba(6,6,6,0)");
      grd.addColorStop(0.5, "rgba(6,6,6,0.2)");
      grd.addColorStop(1, "rgba(6,6,6,0.97)");

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Gold rim glow
      const rim = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.05);
      rim.addColorStop(0, "rgba(212,168,83,0)");
      rim.addColorStop(0.5, "rgba(212,168,83,0.06)");
      rim.addColorStop(1, "rgba(212,168,83,0)");
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}
