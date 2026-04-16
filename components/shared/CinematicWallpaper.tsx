"use client";

import { useEffect, useRef } from "react";

interface CinematicWallpaperProps {
  onExit: () => void;
}

// 3-D particle — stored in original (un-rotated) coords + current rotated coords
type P3 = {
  ox: number; oy: number; oz: number; // original world-space position
  x:  number; y:  number; z:  number; // current rotated position (updated each frame)
  r:        number;
  gold:     boolean;
  kind:     "bg" | "helix" | "rung";
  pulse:    number;
  pSpeed:   number;
};

// Strand index + neighbour index for sequential helix line connections
type StrandLink = { a: number; b: number };

export function CinematicWallpaper({ onExit }: CinematicWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  function exit() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }

  useEffect(() => {
    const el = document.documentElement as any;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
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

    let wakeLock: { release: () => Promise<void> } | null = null;
    if ("wakeLock" in navigator) {
      (navigator as any).wakeLock.request("screen")
        .then((wl: typeof wakeLock) => { wakeLock = wl; })
        .catch(() => {});
    }

    // ─── Build particle system ────────────────────────────────────────────

    const particles: P3[] = [];

    // Background cloud — particles scattered in a sphere around the helix
    for (let i = 0; i < 130; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);
      const radius = 180 + Math.random() * 340;
      const ox = radius * Math.sin(phi) * Math.cos(theta);
      const oy = radius * Math.sin(phi) * Math.sin(theta);
      const oz = radius * Math.cos(phi);
      particles.push({
        ox, oy, oz, x: ox, y: oy, z: oz,
        r:      0.6 + Math.random() * 1.8,
        gold:   Math.random() < 0.45,
        kind:   "bg",
        pulse:  Math.random() * Math.PI * 2,
        pSpeed: 0.008 + Math.random() * 0.018,
      });
    }

    // DNA double helix — 2 strands, 80 points each, 3 full turns
    const HELIX_R     = 65;    // helix radius
    const HELIX_H     = 520;   // total height of helix
    const TURNS       = 3;
    const PTS         = 80;    // points per strand
    const RUNG_EVERY  = 5;     // connect strands every N steps

    const strand1Idx: number[] = [];
    const strand2Idx: number[] = [];
    const strandLinks: StrandLink[] = [];

    for (let i = 0; i < PTS; i++) {
      const t = (i / PTS) * Math.PI * 2 * TURNS;
      const oy = (i / (PTS - 1)) * HELIX_H - HELIX_H / 2;

      // Strand 1
      const ox1 = HELIX_R * Math.cos(t);
      const oz1 = HELIX_R * Math.sin(t);
      strand1Idx.push(particles.length);
      particles.push({
        ox: ox1, oy, oz: oz1, x: ox1, y: oy, z: oz1,
        r: 2.4, gold: true, kind: "helix",
        pulse: Math.random() * Math.PI * 2, pSpeed: 0.012 + Math.random() * 0.01,
      });

      // Strand 2 (offset by π)
      const ox2 = HELIX_R * Math.cos(t + Math.PI);
      const oz2 = HELIX_R * Math.sin(t + Math.PI);
      strand2Idx.push(particles.length);
      particles.push({
        ox: ox2, oy, oz: oz2, x: ox2, y: oy, z: oz2,
        r: 2.4, gold: true, kind: "helix",
        pulse: Math.random() * Math.PI * 2, pSpeed: 0.012 + Math.random() * 0.01,
      });

      // Rung particles connecting the two strands
      if (i % RUNG_EVERY === 0) {
        const RUNG_INNER = 3; // intermediate particles along each rung
        for (let j = 1; j <= RUNG_INNER; j++) {
          const f  = j / (RUNG_INNER + 1);
          const ox = ox1 + (ox2 - ox1) * f;
          const oz = oz1 + (oz2 - oz1) * f;
          particles.push({
            ox, oy, oz, x: ox, y: oy, z: oz,
            r: 0.9, gold: false, kind: "rung",
            pulse: 0, pSpeed: 0,
          });
        }
      }
    }

    // Sequential links along each strand (for efficient line drawing)
    for (let i = 0; i < PTS - 1; i++) {
      strandLinks.push({ a: strand1Idx[i], b: strand1Idx[i + 1] });
      strandLinks.push({ a: strand2Idx[i], b: strand2Idx[i + 1] });
    }
    // Rung links every RUNG_EVERY steps
    for (let i = 0; i < PTS; i += RUNG_EVERY) {
      strandLinks.push({ a: strand1Idx[i], b: strand2Idx[i] });
    }

    // ─── Rotation state ───────────────────────────────────────────────────

    let rotY  = 0;              // primary spin around Y-axis
    let rotX  = 0.18;           // gentle fixed tilt on X
    let driftT = 0;             // time for X-axis drift oscillation

    // ─── Logo state ───────────────────────────────────────────────────────

    type LogoPhase = "idle" | "fadein" | "hold" | "fadeout";
    let logoAlpha: number   = 0;
    let logoPhase: LogoPhase = "idle";
    let logoTimer: number   = 0;
    let logoCountdown: number = 80;  // first appearance after ~80 frames

    const LOGO_MAX    = 0.14;
    const LOGO_FADEIN = 100;
    const LOGO_HOLD   = 140;
    const LOGO_FADEOUT= 100;
    const LOGO_GAP    = 320; // frames between appearances

    // ─── Helpers ──────────────────────────────────────────────────────────

    const FOV = 520;

    function project(px: number, py: number, pz: number) {
      const scale = FOV / (FOV + pz + 220);
      return {
        sx: canvas!.width  / 2 + px * scale,
        sy: canvas!.height / 2 + py * scale,
        scale,
      };
    }

    function rotY3(px: number, py: number, pz: number, a: number) {
      const c = Math.cos(a), s = Math.sin(a);
      return { x: px * c + pz * s, y: py, z: -px * s + pz * c };
    }

    function rotX3(px: number, py: number, pz: number, a: number) {
      const c = Math.cos(a), s = Math.sin(a);
      return { x: px, y: py * c - pz * s, z: py * s + pz * c };
    }

    // ─── Draw loop ────────────────────────────────────────────────────────

    const draw = () => {
      const W = canvas!.width;
      const H = canvas!.height;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Advance rotation
      rotY  += 0.0028;
      driftT += 0.0007;
      rotX   = 0.18 + 0.06 * Math.sin(driftT); // gentle nodding

      // Transform all particles into current rotated positions
      for (const p of particles) {
        let r = rotY3(p.ox, p.oy, p.oz, rotY);
        r = rotX3(r.x, r.y, r.z, rotX);
        p.x = r.x; p.y = r.y; p.z = r.z;
        p.pulse += p.pSpeed;
      }

      // Depth-sorted draw order (painter's algorithm: far → near)
      const sorted = [...particles].sort((a, b) => b.z - a.z);

      // ── Background particle connections ──────────────────────────────────
      const bgPs = particles.filter(p => p.kind === "bg");
      const BG_CONNECT = 95;
      for (let i = 0; i < bgPs.length; i++) {
        for (let j = i + 1; j < bgPs.length; j++) {
          const dx = bgPs[i].x - bgPs[j].x;
          const dy = bgPs[i].y - bgPs[j].y;
          const dz = bgPs[i].z - bgPs[j].z;
          const d  = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d >= BG_CONNECT) continue;
          const pa  = project(bgPs[i].x, bgPs[i].y, bgPs[i].z);
          const pb  = project(bgPs[j].x, bgPs[j].y, bgPs[j].z);
          const avg = (pa.scale + pb.scale) * 0.5;
          const a   = (1 - d / BG_CONNECT) * 0.045 * avg;
          ctx.beginPath();
          ctx.moveTo(pa.sx, pa.sy);
          ctx.lineTo(pb.sx, pb.sy);
          ctx.strokeStyle = (bgPs[i].gold || bgPs[j].gold)
            ? `rgba(212,168,83,${a})`
            : `rgba(200,175,110,${a * 0.4})`;
          ctx.lineWidth = 0.35;
          ctx.stroke();
        }
      }

      // ── Helix strand + rung lines (sequential — O(n)) ────────────────────
      for (const lk of strandLinks) {
        const pa = project(particles[lk.a].x, particles[lk.a].y, particles[lk.a].z);
        const pb = project(particles[lk.b].x, particles[lk.b].y, particles[lk.b].z);
        const avgScale = (pa.scale + pb.scale) * 0.5;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = `rgba(212,168,83,${avgScale * 0.35})`;
        ctx.lineWidth = 0.6 * avgScale;
        ctx.stroke();
      }

      // ── Particles (depth-sorted) ──────────────────────────────────────────
      for (const p of sorted) {
        const { sx, sy, scale } = project(p.x, p.y, p.z);

        // Clamp scale to avoid massive particles if z is near -FOV
        const s  = Math.min(scale, 2.0);
        const pf = 0.85 + 0.15 * Math.sin(p.pulse);
        const r  = p.r * s * pf;
        const da = Math.max(0.04, Math.min(1, s * 1.4)); // depth-based alpha

        if (p.kind === "helix") {
          // Outer glow
          const gr = r * 9;
          const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
          g.addColorStop(0,   `rgba(212,168,83,${da * 0.55})`);
          g.addColorStop(0.25,`rgba(212,168,83,${da * 0.12})`);
          g.addColorStop(1,   "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, gr, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          // Core
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.6, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,225,130,${da})`;
          ctx.fill();

        } else if (p.kind === "rung") {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.3, r * 0.7), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,150,90,${da * 0.38})`;
          ctx.fill();

        } else {
          // Background particle
          if (p.gold) {
            const gr = r * 7;
            const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
            g.addColorStop(0, `rgba(212,168,83,${da * 0.45})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath();
            ctx.arc(sx, sy, gr, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.3, r), 0, Math.PI * 2);
          ctx.fillStyle = p.gold
            ? `rgba(212,168,83,${da * 0.65})`
            : `rgba(255,240,200,${da * 0.22})`;
          ctx.fill();
        }
      }

      // ── Deep vignette ─────────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, H * 0.88);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.91)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // ── CINEFLOW — ghostly, minimal ───────────────────────────────────────
      if (logoPhase === "idle") {
        logoCountdown--;
        if (logoCountdown <= 0) {
          logoPhase = "fadein"; logoTimer = 0; logoCountdown = LOGO_GAP;
        }
      } else if (logoPhase === "fadein") {
        logoTimer++;
        logoAlpha = (logoTimer / LOGO_FADEIN) * LOGO_MAX;
        if (logoTimer >= LOGO_FADEIN) { logoPhase = "hold"; logoTimer = 0; }
      } else if (logoPhase === "hold") {
        logoTimer++;
        logoAlpha = LOGO_MAX;
        if (logoTimer >= LOGO_HOLD) { logoPhase = "fadeout"; logoTimer = 0; }
      } else {
        logoTimer++;
        logoAlpha = LOGO_MAX * (1 - logoTimer / LOGO_FADEOUT);
        if (logoTimer >= LOGO_FADEOUT) { logoPhase = "idle"; logoAlpha = 0; }
      }

      if (logoAlpha > 0.001) {
        const fs = Math.min(W * 0.055, 66);
        ctx.save();
        ctx.globalAlpha = logoAlpha;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.font         = `100 ${fs}px 'SF Pro Display', system-ui, sans-serif`;
        ctx.fillStyle    = "#d4a853";
        ctx.fillText("CINEFLOW", W / 2, H / 2);
        ctx.restore();
      }

      // ── Scanlines ─────────────────────────────────────────────────────────
      for (let sy = 0; sy < H; sy += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.016)";
        ctx.fillRect(0, sy, W, 1);
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
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/10 pointer-events-none tracking-[0.3em] uppercase animate-fade-out">
        Tap to exit
      </p>
    </div>
  );
}
