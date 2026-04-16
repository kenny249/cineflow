"use client";

import { useEffect, useRef } from "react";

interface CinematicWallpaperProps {
  onExit: () => void;
}

type Particle  = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean; o: number };
type FilmStrip = { x: number; y: number; speed: number; frames: number; o: number };
type Floater   = { text: string; x: number; y: number; vx: number; vy: number; size: number; o: number; targetO: number; life: number; maxLife: number };
type Ring      = { x: number; y: number; r: number; vx: number; vy: number; o: number };

export function CinematicWallpaper({ onExit }: CinematicWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
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

    // ── Particles ──────────────────────────────────────────────────────────────
    const particles: Particle[] = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.14,
      vy: (Math.random() - 0.5) * 0.14,
      r:  0.5 + Math.random() * 1.8,
      gold: Math.random() < 0.38,
      o:  0.1 + Math.random() * 0.22,
    }));

    // ── Film strips ────────────────────────────────────────────────────────────
    const filmStrips: FilmStrip[] = Array.from({ length: 4 }, (_, i) => ({
      x:      (canvas.width / 4) * i,
      y:      80 + Math.random() * (canvas.height - 200),
      speed:  0.25 + Math.random() * 0.35,
      frames: 4 + Math.floor(Math.random() * 3),
      o:      0.045 + Math.random() * 0.055,
    }));

    // ── DNA strands ────────────────────────────────────────────────────────────
    const strands = [
      { y: canvas.height * 0.22, speed: 0.38, amp: 42, freq: 0.022, o: 0.08, phase: 0 },
      { y: canvas.height * 0.78, speed: 0.28, amp: 32, freq: 0.018, o: 0.06, phase: Math.PI * 0.7 },
    ];

    // ── Text floaters ──────────────────────────────────────────────────────────
    const floaters: Floater[] = [];
    const TEXTS = ["CINEFLOW", "CINEFLOW", "CF", "▶", "◼", "⬡", "◈", "◇"];

    function spawnFloater() {
      const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
      const isWord = text === "CINEFLOW";
      floaters.push({
        text,
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.12,
        size:    isWord ? 28 + Math.random() * 52 : 14 + Math.random() * 22,
        o:       0,
        targetO: isWord ? 0.07 + Math.random() * 0.09 : 0.1 + Math.random() * 0.14,
        life:    0,
        maxLife: 500 + Math.random() * 500,
      });
    }
    for (let i = 0; i < 8; i++) spawnFloater();

    // ── Rings ──────────────────────────────────────────────────────────────────
    const rings: Ring[] = Array.from({ length: 6 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      r:  60 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      o:  0.025 + Math.random() * 0.04,
    }));

    // ── Wake lock (keeps iPad screen on) ───────────────────────────────────────
    let wakeLock: any = null;
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen").then((wl: any) => {
        wakeLock = wl;
      }).catch(() => {});
    }

    // ── Draw loop ─────────────────────────────────────────────────────────────
    let t = 0;

    const draw = () => {
      t++;
      const W = canvas.width;
      const H = canvas.height;

      // Background
      ctx.fillStyle = "#050507";
      ctx.fillRect(0, 0, W, H);

      // Vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.9);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Letterbox bars
      const barH = Math.round(H * 0.045);
      const barG = ctx.createLinearGradient(0, 0, W, 0);
      barG.addColorStop(0,   "rgba(212,168,83,0.04)");
      barG.addColorStop(0.5, "rgba(212,168,83,0.11)");
      barG.addColorStop(1,   "rgba(212,168,83,0.04)");
      ctx.fillStyle = barG;
      ctx.fillRect(0, 0, W, barH);
      ctx.fillRect(0, H - barH, W, barH);

      // ── Rings ──
      for (const rg of rings) {
        rg.x += rg.vx; rg.y += rg.vy;
        if (rg.x < -rg.r)      rg.x = W + rg.r;
        if (rg.x > W + rg.r)   rg.x = -rg.r;
        if (rg.y < -rg.r)      rg.y = H + rg.r;
        if (rg.y > H + rg.r)   rg.y = -rg.r;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,168,83,${rg.o})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Inner ring
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(212,168,83,${rg.o * 0.5})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // ── DNA strands ──
      for (const s of strands) {
        s.phase += s.speed * 0.018;
        ctx.save();
        ctx.translate(0, s.y);

        for (let wave = 0; wave < 2; wave++) {
          const phOff = wave * Math.PI;
          ctx.beginPath();
          for (let x = 0; x <= W; x += 3) {
            const y = Math.sin(x * s.freq + s.phase + phOff) * s.amp;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(212,168,83,${s.o})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }

        // Cross-rungs
        for (let x = 10; x < W; x += 26) {
          const y1 = Math.sin(x * s.freq + s.phase)            * s.amp;
          const y2 = Math.sin(x * s.freq + s.phase + Math.PI)  * s.amp;
          const sep = Math.abs(y1 - y2);
          const alpha = s.o * (1 - sep / (s.amp * 2)) * 2.8;
          if (alpha > 0.005) {
            ctx.beginPath();
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
            ctx.strokeStyle = `rgba(212,168,83,${Math.max(0, Math.min(1, alpha))})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ── Film strips ──
      const FW = 82, FH = 56, GAP = 7, SPR = 5, SPRSP = 17;
      for (const fs of filmStrips) {
        fs.x -= fs.speed;
        const totalW = fs.frames * (FW + GAP);
        if (fs.x + totalW < -100) fs.x = W + 80;

        ctx.save();
        ctx.globalAlpha = fs.o;
        ctx.translate(fs.x, fs.y);

        for (let f = 0; f < fs.frames; f++) {
          const fx = f * (FW + GAP);
          ctx.strokeStyle = "rgba(212,168,83,0.85)";
          ctx.lineWidth = 0.8;
          ctx.strokeRect(fx, 0, FW, FH);
          // Faint inner rectangle
          ctx.strokeStyle = "rgba(212,168,83,0.25)";
          ctx.strokeRect(fx + 5, 5, FW - 10, FH - 10);
          // Sprocket holes top & bottom
          for (let s = 0; s < 4; s++) {
            const sx = fx + 10 + s * SPRSP;
            ctx.beginPath();
            ctx.arc(sx, -SPR - 3, SPR, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(212,168,83,0.6)";
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx, FH + SPR + 3, SPR, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ── Particles ──
      const CONNECT = 130;
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
            const a = (1 - d / CONNECT) * 0.09;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = (particles[i].gold || particles[j].gold)
              ? `rgba(212,168,83,${a})`
              : `rgba(200,200,220,${a * 0.7})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      // Dots
      for (const p of particles) {
        if (p.gold) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 9);
          g.addColorStop(0, `rgba(212,168,83,${p.o})`);
          g.addColorStop(1, "rgba(212,168,83,0)");
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 9, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(212,168,83,${p.o})`
          : `rgba(210,210,230,${p.o * 0.6})`;
        ctx.fill();
      }

      // ── Text floaters ──
      if (t % 110 === 0 && floaters.length < 14) spawnFloater();
      for (let i = floaters.length - 1; i >= 0; i--) {
        const fl = floaters[i];
        fl.x += fl.vx; fl.y += fl.vy;
        fl.life++;
        const FADE = 70;
        if (fl.life < FADE)                       fl.o = (fl.life / FADE) * fl.targetO;
        else if (fl.life > fl.maxLife - FADE)     fl.o = ((fl.maxLife - fl.life) / FADE) * fl.targetO;
        else                                       fl.o = fl.targetO;
        if (fl.life >= fl.maxLife) { floaters.splice(i, 1); continue; }

        ctx.save();
        ctx.globalAlpha = fl.o;
        ctx.font = `100 ${fl.size}px 'SF Pro Display', system-ui, sans-serif`;
        ctx.fillStyle = "#d4a853";
        ctx.fillText(fl.text, fl.x, fl.y);
        ctx.restore();
      }

      // Subtle scanlines
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.028)";
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
      onClick={onExit}
      onTouchEnd={onExit}
      onKeyDown={(e) => e.key === "Escape" && onExit()}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Exit hint fades after 4s via animation */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/20 pointer-events-none tracking-[0.25em] uppercase animate-fade-out">
        Tap to exit
      </p>
    </div>
  );
}
