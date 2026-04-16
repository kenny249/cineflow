"use client";

import { useEffect, useRef } from "react";

interface CinematicWallpaperProps {
  onExit: () => void;
}

type Bokeh    = { x: number; y: number; vx: number; vy: number; r: number; baseO: number; pulse: number; pSpeed: number };
type Particle = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean; o: number };
type Floater  = { text: string; x: number; y: number; vx: number; vy: number; size: number; o: number; targetO: number; life: number; maxLife: number };

export function CinematicWallpaper({ onExit }: CinematicWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  function exit() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }

  useEffect(() => {
    // Request fullscreen (best-effort on iPad Safari)
    const el = document.documentElement as any;
    if (el.requestFullscreen)            el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Bokeh orbs — the key cinematic ingredient ─────────────────────────
    const bokeh: Bokeh[] = Array.from({ length: 24 }, () => ({
      x:      Math.random() * canvas!.width,
      y:      Math.random() * canvas!.height,
      vx:     (Math.random() - 0.5) * 0.05,
      vy:     (Math.random() - 0.5) * 0.05,
      r:      70 + Math.random() * 180,
      baseO:  0.14 + Math.random() * 0.3,
      pulse:  Math.random() * Math.PI * 2,
      pSpeed: 0.002 + Math.random() * 0.005,
    }));

    // ── Particles ─────────────────────────────────────────────────────────
    const particles: Particle[] = Array.from({ length: 220 }, () => ({
      x:    Math.random() * canvas!.width,
      y:    Math.random() * canvas!.height,
      vx:   (Math.random() - 0.5) * 0.11,
      vy:   (Math.random() - 0.5) * 0.11,
      r:    0.4 + Math.random() * 1.7,
      gold: Math.random() < 0.48,
      o:    0.18 + Math.random() * 0.38,
    }));

    // ── Text floaters ─────────────────────────────────────────────────────
    const floaters: Floater[] = [];
    function spawnFloater() {
      const roll = Math.random();
      const isBig = roll < 0.25;
      const isMid = roll < 0.5;
      floaters.push({
        text:    isBig ? "CINEFLOW" : (isMid ? "CF" : "◈"),
        x:       Math.random() * canvas!.width,
        y:       Math.random() * canvas!.height,
        vx:      (Math.random() - 0.5) * 0.16,
        vy:      (Math.random() - 0.5) * 0.07,
        size:    isBig ? 32 + Math.random() * 52 : isMid ? 16 + Math.random() * 14 : 10 + Math.random() * 12,
        o:       0,
        targetO: isBig ? 0.055 + Math.random() * 0.07 : 0.1 + Math.random() * 0.18,
        life:    0,
        maxLife: 700 + Math.random() * 700,
      });
    }
    for (let i = 0; i < 12; i++) spawnFloater();

    // ── Wake lock (prevents iPad sleep) ───────────────────────────────────
    let wakeLock: any = null;
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((wl: any) => { wakeLock = wl; }).catch(() => {});
    }

    let t = 0;
    let logoPhase = 0;
    const CONNECT = 110;

    const draw = () => {
      t++;
      const W = canvas.width;
      const H = canvas.height;

      // True black
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, H);

      // ── Bokeh layer ──────────────────────────────────────────────────────
      for (const b of bokeh) {
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.x = W + b.r; if (b.x > W + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = H + b.r; if (b.y > H + b.r) b.y = -b.r;
        b.pulse += b.pSpeed;
        const o = b.baseO * (0.65 + 0.35 * Math.sin(b.pulse));
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0,    `rgba(212,168,83,${o})`);
        g.addColorStop(0.3,  `rgba(212,168,83,${o * 0.35})`);
        g.addColorStop(0.7,  `rgba(180,130,50,${o * 0.08})`);
        g.addColorStop(1,    "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // ── Particles ────────────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      }
      // Connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const a = (1 - d / CONNECT) * 0.055;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = (particles[i].gold || particles[j].gold)
              ? `rgba(212,168,83,${a})`
              : `rgba(180,155,100,${a * 0.5})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }
      // Dots
      for (const p of particles) {
        if (p.gold) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 11);
          g.addColorStop(0, `rgba(212,168,83,${p.o * 0.9})`);
          g.addColorStop(1, "rgba(212,168,83,0)");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 11, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(212,168,83,${p.o})`
          : `rgba(255,240,200,${p.o * 0.35})`;
        ctx.fill();
      }

      // ── Deep vignette ────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // ── Floating text (behind center logo) ───────────────────────────────
      if (t % 140 === 0 && floaters.length < 18) spawnFloater();
      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i];
        fl.x += fl.vx; fl.y += fl.vy; fl.life++;
        const FADE = 90;
        if (fl.life < FADE)                    fl.o = (fl.life / FADE) * fl.targetO;
        else if (fl.life > fl.maxLife - FADE)  fl.o = ((fl.maxLife - fl.life) / FADE) * fl.targetO;
        else                                    fl.o = fl.targetO;
        if (fl.life >= fl.maxLife) { floaters.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = fl.o;
        ctx.font = `100 ${fl.size}px 'SF Pro Display', system-ui, sans-serif`;
        ctx.fillStyle = "#d4a853";
        ctx.textAlign = "left";
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.restore();
      }

      // ── Central CINEFLOW wordmark ─────────────────────────────────────────
      logoPhase += 0.007;
      const logoO = 0.45 + 0.42 * Math.sin(logoPhase); // breathes 0.03–0.87
      const fontSize = Math.min(W * 0.075, 88);

      ctx.save();
      ctx.globalAlpha = logoO;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";

      // Outer glow pass (larger blur)
      ctx.shadowColor = "rgba(212,168,83,0.5)";
      ctx.shadowBlur  = 60 + 25 * Math.sin(logoPhase);
      ctx.font        = `100 ${fontSize}px 'SF Pro Display', system-ui, sans-serif`;
      ctx.fillStyle   = "#d4a853";
      ctx.fillText("CINEFLOW", W / 2, H / 2);

      // Crisp pass on top
      ctx.shadowBlur  = 8;
      ctx.shadowColor = "rgba(212,168,83,0.9)";
      ctx.fillText("CINEFLOW", W / 2, H / 2);

      // Hairline rule below text
      const measured = ctx.measureText("CINEFLOW").width;
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = logoO * 0.35;
      ctx.strokeStyle = "#d4a853";
      ctx.lineWidth   = 0.7;
      const lineY     = H / 2 + fontSize * 0.62;
      ctx.beginPath();
      ctx.moveTo(W / 2 - measured / 2, lineY);
      ctx.lineTo(W / 2 + measured / 2, lineY);
      ctx.stroke();
      ctx.restore();

      // ── Scanlines ─────────────────────────────────────────────────────────
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.022)";
        ctx.fillRect(0, y, W, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] cursor-none select-none"
      onClick={exit}
      onTouchEnd={exit}
      onKeyDown={(e) => e.key === "Escape" && exit()}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none tracking-[0.25em] uppercase animate-fade-out">
        Tap to exit
      </p>
    </div>
  );
}
