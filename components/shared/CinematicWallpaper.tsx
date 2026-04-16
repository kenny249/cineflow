"use client";

import { useEffect, useRef } from "react";

interface CinematicWallpaperProps {
  onExit: () => void;
}

type P3 = {
  ox: number; oy: number; oz: number;
  x:  number; y:  number; z:  number;
  r:        number;
  gold:     boolean;
  kind:     "bg" | "helix" | "rung";
  pulse:    number;
  pSpeed:   number;
  strandPos?: number; // 0-1 position along strand for pulse effect
};

type StrandLink = { a: number; b: number };

type Streaker = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  px: number; py: number; pz: number; // previous position
  life: number; maxLife: number;
  r: number;
  bright: number; // 0.6-1.4
};

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

    // ─── Build particle system ────────────────────────────────────────

    const particles: P3[] = [];

    // Background cloud — larger volume, more density
    for (let i = 0; i < 240; i++) {
      const theta  = Math.random() * Math.PI * 2;
      const phi    = Math.acos(2 * Math.random() - 1);
      const radius = 220 + Math.random() * 620;
      const ox = radius * Math.sin(phi) * Math.cos(theta);
      const oy = radius * Math.sin(phi) * Math.sin(theta);
      const oz = radius * Math.cos(phi);
      particles.push({
        ox, oy, oz, x: ox, y: oy, z: oz,
        r:      0.5 + Math.random() * 2.4,
        gold:   Math.random() < 0.42,
        kind:   "bg",
        pulse:  Math.random() * Math.PI * 2,
        pSpeed: 0.006 + Math.random() * 0.02,
      });
    }

    // DNA double helix — much larger and more imposing
    const HELIX_R    = 130;   // bigger radius
    const HELIX_H    = 760;   // taller
    const TURNS      = 4;     // more turns
    const PTS        = 100;   // more points = smoother
    const RUNG_EVERY = 5;

    const strand1Idx: number[] = [];
    const strand2Idx: number[] = [];
    const strandLinks: StrandLink[] = [];

    for (let i = 0; i < PTS; i++) {
      const t  = (i / PTS) * Math.PI * 2 * TURNS;
      const oy = (i / (PTS - 1)) * HELIX_H - HELIX_H / 2;
      const strandPos = i / (PTS - 1);

      const ox1 = HELIX_R * Math.cos(t);
      const oz1 = HELIX_R * Math.sin(t);
      strand1Idx.push(particles.length);
      particles.push({
        ox: ox1, oy, oz: oz1, x: ox1, y: oy, z: oz1,
        r: 3.2, gold: true, kind: "helix",
        pulse: Math.random() * Math.PI * 2, pSpeed: 0.01 + Math.random() * 0.008,
        strandPos,
      });

      const ox2 = HELIX_R * Math.cos(t + Math.PI);
      const oz2 = HELIX_R * Math.sin(t + Math.PI);
      strand2Idx.push(particles.length);
      particles.push({
        ox: ox2, oy, oz: oz2, x: ox2, y: oy, z: oz2,
        r: 3.2, gold: true, kind: "helix",
        pulse: Math.random() * Math.PI * 2, pSpeed: 0.01 + Math.random() * 0.008,
        strandPos,
      });

      if (i % RUNG_EVERY === 0) {
        const RUNG_INNER = 4;
        for (let j = 1; j <= RUNG_INNER; j++) {
          const f  = j / (RUNG_INNER + 1);
          const ox = ox1 + (ox2 - ox1) * f;
          const oz = oz1 + (oz2 - oz1) * f;
          particles.push({
            ox, oy, oz, x: ox, y: oy, z: oz,
            r: 1.1, gold: false, kind: "rung",
            pulse: 0, pSpeed: 0, strandPos,
          });
        }
      }
    }

    for (let i = 0; i < PTS - 1; i++) {
      strandLinks.push({ a: strand1Idx[i], b: strand1Idx[i + 1] });
      strandLinks.push({ a: strand2Idx[i], b: strand2Idx[i + 1] });
    }
    for (let i = 0; i < PTS; i += RUNG_EVERY) {
      strandLinks.push({ a: strand1Idx[i], b: strand2Idx[i] });
    }

    // ─── Streaking particles ─────────────────────────────────────────
    const STREAKER_COUNT = 28;
    const streakerPool: Streaker[] = [];

    function spawnStreaker(stagger = false): Streaker {
      // Spawn on a sphere shell, aim roughly toward center
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const spawnR = 500 + Math.random() * 250;
      const sx = spawnR * Math.sin(phi) * Math.cos(theta);
      const sy = spawnR * Math.sin(phi) * Math.sin(theta);
      const sz = spawnR * Math.cos(phi);
      const speed = 3.5 + Math.random() * 7;
      const len   = Math.sqrt(sx * sx + sy * sy + sz * sz);
      // Aim at center with slight random offset
      const tx = (Math.random() - 0.5) * 180;
      const ty = (Math.random() - 0.5) * 180;
      const tz = (Math.random() - 0.5) * 180;
      const dx = (tx - sx) / len;
      const dy = (ty - sy) / len;
      const dz = (tz - sz) / len;
      const maxLife = 50 + Math.floor(Math.random() * 90);
      return {
        x: sx, y: sy, z: sz,
        px: sx, py: sy, pz: sz,
        vx: dx * speed, vy: dy * speed, vz: dz * speed,
        life:    stagger ? Math.floor(Math.random() * maxLife) : maxLife,
        maxLife,
        r:       0.7 + Math.random() * 1.6,
        bright:  0.6 + Math.random() * 0.8,
      };
    }

    for (let i = 0; i < STREAKER_COUNT; i++) {
      streakerPool.push(spawnStreaker(true));
    }

    // ─── Rotation / camera state ─────────────────────────────────────
    let rotY   = 0;
    let rotX   = 0.18;
    let driftT = 0;
    let speedT = 0;   // for sinusoidal speed modulation

    // Slow camera drift — gives parallax, deepens 3D feel
    let camT = 0;
    const CAM_R = 70;

    // Energy pulse — travels up and down the helix
    let pulsePos = 0.0;  // 0 = bottom, 1 = top
    let pulseDir = 1;
    const PULSE_WIDTH = 0.09;

    // ─── Logo state ───────────────────────────────────────────────────
    type LogoPhase = "idle" | "fadein" | "hold" | "fadeout";
    let logoAlpha: number    = 0;
    let logoPhase: LogoPhase = "idle";
    let logoTimer: number    = 0;
    let logoCountdown        = 80;

    const LOGO_MAX     = 0.14;
    const LOGO_FADEIN  = 100;
    const LOGO_HOLD    = 150;
    const LOGO_FADEOUT = 100;
    const LOGO_GAP     = 340;

    // ─── Helpers ──────────────────────────────────────────────────────
    const FOV = 560;

    function project(px: number, py: number, pz: number, cx = 0, cy = 0) {
      const scale = FOV / (FOV + pz + 260);
      return {
        sx:    canvas!.width  / 2 + (px - cx) * scale,
        sy:    canvas!.height / 2 + (py - cy) * scale,
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

    // ─── Draw loop ────────────────────────────────────────────────────

    const draw = () => {
      const W = canvas!.width;
      const H = canvas!.height;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);

      // Advance state
      speedT += 0.0038;
      const rotSpeed = 0.0022 + 0.0022 * Math.sin(speedT); // variable, surges
      rotY  += rotSpeed;
      driftT += 0.00055;
      rotX   = 0.20 + 0.14 * Math.sin(driftT);             // more dramatic nod

      camT += 0.00075;
      const camX = CAM_R * Math.sin(camT);
      const camY = CAM_R * 0.45 * Math.sin(camT * 0.71);

      // Energy pulse
      pulsePos += 0.0055 * pulseDir;
      if (pulsePos > 1.08) { pulsePos = 1.08; pulseDir = -1; }
      if (pulsePos < -0.08) { pulsePos = -0.08; pulseDir = 1; }

      // Transform all particles
      for (const p of particles) {
        let r = rotY3(p.ox, p.oy, p.oz, rotY);
        r = rotX3(r.x, r.y, r.z, rotX);
        p.x = r.x; p.y = r.y; p.z = r.z;
        p.pulse += p.pSpeed;
      }

      // Depth sort
      const sorted = [...particles].sort((a, b) => b.z - a.z);

      // ── Nebula atmosphere (large diffuse glows) ───────────────────────
      // Positions shift slightly with camera orbit for parallax
      const nebulae = [
        { nx: W * 0.18 + camX * 0.8, ny: H * 0.28 + camY * 0.5, nr: W * 0.32, na: 0.022 },
        { nx: W * 0.78 + camX * 0.6, ny: H * 0.68 + camY * 0.4, nr: W * 0.26, na: 0.018 },
        { nx: W * 0.50 + camX * 0.3, ny: H * 0.12 + camY * 0.6, nr: W * 0.20, na: 0.014 },
        { nx: W * 0.30 + camX * 0.5, ny: H * 0.80 + camY * 0.3, nr: W * 0.22, na: 0.013 },
      ];
      for (const nb of nebulae) {
        const g = ctx.createRadialGradient(nb.nx, nb.ny, 0, nb.nx, nb.ny, nb.nr);
        g.addColorStop(0,   `rgba(212,168,83,${nb.na})`);
        g.addColorStop(0.5, `rgba(160,110,40,${nb.na * 0.4})`);
        g.addColorStop(1,   "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(nb.nx, nb.ny, nb.nr, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      // ── Background particle connections ───────────────────────────────
      const bgPs = particles.filter(p => p.kind === "bg");
      const BG_CONNECT = 100;
      for (let i = 0; i < bgPs.length; i++) {
        for (let j = i + 1; j < bgPs.length; j++) {
          const dx = bgPs[i].x - bgPs[j].x;
          const dy = bgPs[i].y - bgPs[j].y;
          const dz = bgPs[i].z - bgPs[j].z;
          const d  = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d >= BG_CONNECT) continue;
          const pa  = project(bgPs[i].x, bgPs[i].y, bgPs[i].z, camX, camY);
          const pb  = project(bgPs[j].x, bgPs[j].y, bgPs[j].z, camX, camY);
          const avg = (pa.scale + pb.scale) * 0.5;
          const a   = (1 - d / BG_CONNECT) * 0.055 * avg;
          ctx.beginPath();
          ctx.moveTo(pa.sx, pa.sy);
          ctx.lineTo(pb.sx, pb.sy);
          ctx.strokeStyle = (bgPs[i].gold || bgPs[j].gold)
            ? `rgba(212,168,83,${a})`
            : `rgba(200,175,110,${a * 0.38})`;
          ctx.lineWidth = 0.38;
          ctx.stroke();
        }
      }

      // ── Helix strand + rung lines ────────────────────────────────────
      for (const lk of strandLinks) {
        const pA = particles[lk.a];
        const pB = particles[lk.b];
        const pa = project(pA.x, pA.y, pA.z, camX, camY);
        const pb = project(pB.x, pB.y, pB.z, camX, camY);
        const avgScale = (pa.scale + pb.scale) * 0.5;

        // Pulse glow on strands
        const avgSP     = ((pA.strandPos ?? 0) + (pB.strandPos ?? 0)) * 0.5;
        const dist      = Math.abs(avgSP - pulsePos);
        const pulseGlow = dist < PULSE_WIDTH ? Math.pow(1 - dist / PULSE_WIDTH, 2) * 1.1 : 0;

        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.strokeStyle = `rgba(212,168,83,${avgScale * (0.38 + pulseGlow * 0.9)})`;
        ctx.lineWidth = (0.7 + pulseGlow * 2.2) * avgScale;
        ctx.stroke();
      }

      // ── Particles (depth-sorted) ──────────────────────────────────────
      for (const p of sorted) {
        const { sx, sy, scale } = project(p.x, p.y, p.z, camX, camY);
        const s  = Math.min(scale, 2.4);
        const pf = 0.84 + 0.16 * Math.sin(p.pulse);
        const r  = p.r * s * pf;
        const da = Math.max(0.04, Math.min(1, s * 1.5));

        // Per-particle pulse boost
        const pDist  = p.strandPos !== undefined ? Math.abs(p.strandPos - pulsePos) : 1;
        const pBoost = p.kind !== "bg" && pDist < PULSE_WIDTH
          ? Math.pow(1 - pDist / PULSE_WIDTH, 2) * 1.4
          : 0;

        if (p.kind === "helix") {
          // Outer mega-glow (much larger radius)
          const gr = r * (16 + pBoost * 10);
          const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
          g.addColorStop(0,    `rgba(255,220,110,${da * (0.72 + pBoost * 0.5)})`);
          g.addColorStop(0.15, `rgba(212,168,83,${da * (0.22 + pBoost * 0.35)})`);
          g.addColorStop(0.5,  `rgba(180,130,60,${da * 0.05})`);
          g.addColorStop(1,    "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(sx, sy, gr, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          // Core
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.8, r), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,238,160,${Math.min(1, da + pBoost * 0.4)})`;
          ctx.fill();

        } else if (p.kind === "rung") {
          // Slight glow on rung particles near pulse
          if (pBoost > 0.1) {
            const gr = r * 5;
            const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
            g.addColorStop(0, `rgba(212,168,83,${da * pBoost * 0.4})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath();
            ctx.arc(sx, sy, gr, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.4, r * 0.8), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180,150,90,${da * (0.48 + pBoost * 0.3)})`;
          ctx.fill();

        } else {
          // Background particle
          if (p.gold) {
            const gr = r * 10;
            const g  = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr);
            g.addColorStop(0, `rgba(212,168,83,${da * 0.52})`);
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath();
            ctx.arc(sx, sy, gr, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.3, r), 0, Math.PI * 2);
          ctx.fillStyle = p.gold
            ? `rgba(212,168,83,${da * 0.72})`
            : `rgba(255,240,200,${da * 0.25})`;
          ctx.fill();
        }
      }

      // ── Streaking particles ───────────────────────────────────────────
      for (const sk of streakerPool) {
        sk.life--;
        if (sk.life <= 0) {
          const fresh = spawnStreaker(false);
          Object.assign(sk, fresh);
          continue;
        }

        // Save previous projected position before updating
        const prev = project(sk.x, sk.y, sk.z, camX, camY);

        // Update
        sk.x += sk.vx;
        sk.y += sk.vy;
        sk.z += sk.vz;

        const curr = project(sk.x, sk.y, sk.z, camX, camY);

        const lifeRatio = sk.life / sk.maxLife;
        // Fade in at birth, fade out at death
        const fadeAlpha = lifeRatio < 0.15
          ? lifeRatio / 0.15
          : lifeRatio > 0.75
            ? (1 - lifeRatio) / 0.25
            : 1.0;
        const alpha = fadeAlpha * sk.bright * Math.min(curr.scale * 2.2, 1.0);

        if (alpha > 0.01) {
          // Gradient streak tail
          const grad = ctx.createLinearGradient(prev.sx, prev.sy, curr.sx, curr.sy);
          grad.addColorStop(0, "rgba(212,168,83,0)");
          grad.addColorStop(1, `rgba(255,235,140,${alpha * 0.85})`);
          ctx.beginPath();
          ctx.moveTo(prev.sx, prev.sy);
          ctx.lineTo(curr.sx, curr.sy);
          ctx.strokeStyle = grad;
          ctx.lineWidth   = sk.r * curr.scale * 1.2;
          ctx.stroke();

          // Bright tip
          const tipG = ctx.createRadialGradient(curr.sx, curr.sy, 0, curr.sx, curr.sy, sk.r * curr.scale * 3.5);
          tipG.addColorStop(0, `rgba(255,245,180,${alpha})`);
          tipG.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(curr.sx, curr.sy, sk.r * curr.scale * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = tipG;
          ctx.fill();
        }
      }

      // ── Deep vignette ─────────────────────────────────────────────────
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.86);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.93)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // ── CINEFLOW — ghostly, whisper-light ─────────────────────────────
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
        const fs = Math.min(W * 0.054, 66);
        ctx.save();
        ctx.globalAlpha  = logoAlpha;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.font         = `100 ${fs}px 'SF Pro Display', system-ui, sans-serif`;
        ctx.fillStyle    = "#d4a853";
        ctx.fillText("CINEFLOW", W / 2, H / 2);
        ctx.restore();
      }

      // ── Scanlines ─────────────────────────────────────────────────────
      for (let sy = 0; sy < H; sy += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.014)";
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
