"use client";

import { useEffect, useRef } from "react";

// Pointy-top hex geometry
const R       = 36;                    // hex radius
const W       = Math.sqrt(3) * R;     // hex width
const ROW_H   = 1.5 * R;             // vertical row step
const PARALLAX = 18;                  // max parallax px
const GLOW_R  = 250;                  // cursor glow radius
const EASE    = 0.058;

const RIPPLE_SPEED     = 190;  // px/s
const RIPPLE_THICKNESS = 30;
const RIPPLE_DURATION  = 1000; // ms

interface Ripple { x: number; y: number; born: number }

export function HexField() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const glowMouse      = useRef({ x: -9999, y: -9999 });
  const normMouse      = useRef({ x: 0.5, y: 0.5 });
  const pxRef          = useRef({ x: 0, y: 0 });
  const ripples        = useRef<Ripple[]>([]);
  const lastRipplePos  = useRef({ x: -9999, y: -9999 });
  const rafRef         = useRef<number>(0);
  const t0             = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    t0.current = performance.now();

    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      canvas.width  = p.offsetWidth;
      canvas.height = p.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    /** Draw a single pointy-top hexagon path (no stroke/fill call) */
    const hex = (cx: number, cy: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (Math.PI / 3) * i;
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = () => {
      const now = performance.now();
      const sec = (now - t0.current) / 1000;

      // ── Lerp parallax ──
      const targX = (normMouse.current.x - 0.5) * -PARALLAX * 2;
      const targY = (normMouse.current.y - 0.5) * -PARALLAX * 2;
      pxRef.current.x += (targX - pxRef.current.x) * EASE;
      pxRef.current.y += (targY - pxRef.current.y) * EASE;

      const ox = pxRef.current.x;
      const oy = pxRef.current.y;
      const mx = glowMouse.current.x;
      const my = glowMouse.current.y;
      const inPanel = mx > -100;

      // Ambient breath
      const breath = 0.006 * Math.sin(sec * 0.52);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Cursor wide spotlight on canvas BG ──
      if (inPanel) {
        const spot = ctx.createRadialGradient(mx, my, 0, mx, my, 420);
        spot.addColorStop(0,    "rgba(212,168,83,0.09)");
        spot.addColorStop(0.35, "rgba(212,168,83,0.028)");
        spot.addColorStop(1,    "rgba(0,0,0,0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Cull dead ripples
      ripples.current = ripples.current.filter(r => now - r.born < RIPPLE_DURATION);

      // ── Grid ──
      const pad  = PARALLAX + R;
      const cols = Math.ceil((canvas.width  + pad * 2) / W)    + 2;
      const rows = Math.ceil((canvas.height + pad * 2) / ROW_H) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col * W + (row % 2 !== 0 ? W / 2 : 0) - pad + ox;
          const cy = row * ROW_H - pad + oy;

          // ── Ripple contribution (canvas-space, NOT parallax-adjusted) ──
          let ripBoost = 0;
          for (const rip of ripples.current) {
            const age     = (now - rip.born) / RIPPLE_DURATION;
            const rRadius = age * RIPPLE_SPEED * (RIPPLE_DURATION / 1000);
            const rd      = Math.sqrt((cx - rip.x) ** 2 + (cy - rip.y) ** 2);
            const ring    = Math.abs(rd - rRadius);
            if (ring < RIPPLE_THICKNESS) {
              const ringT   = 1 - ring / RIPPLE_THICKNESS;
              ripBoost = Math.max(ripBoost, ringT * (1 - age) * (1 - age) * 0.38);
            }
          }

          if (inPanel) {
            const dx   = cx - mx;
            const dy   = cy - my;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < GLOW_R) {
              const tLinear = 1 - dist / GLOW_R;
              const tSoft   = tLinear * tLinear;         // quadratic
              const tSharp  = tSoft   * tLinear;         // cubic

              // Faint warm fill for inner hexes
              if (tSharp > 0.06) {
                hex(cx, cy);
                ctx.fillStyle = `rgba(212,168,83,${tSharp * 0.065 + ripBoost * 0.02})`;
                ctx.fill();
              }

              // Glow stroke: warm-white at core, gold at periphery
              hex(cx, cy);
              const strokeO = 0.04 + tSoft * 0.30 + ripBoost * 0.14;
              ctx.strokeStyle = tLinear > 0.62
                ? `rgba(255,238,170,${strokeO})`
                : `rgba(212,168,83,${strokeO})`;
              ctx.lineWidth = 0.4 + tSoft * 1.4;
              ctx.stroke();

              // ── Hot-center atomic dot ──
              if (dist < GLOW_R * 0.18) {
                const hotT = 1 - dist / (GLOW_R * 0.18);
                ctx.beginPath();
                ctx.arc(cx, cy, 1.0 + hotT * 2.0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,248,210,${hotT * 0.62})`;
                ctx.fill();
              }

              continue;
            }
          }

          // ── Base faint grid ──
          const baseO = 0.028 + breath + ripBoost * 0.18;
          hex(cx, cy);
          if (ripBoost > 0.04) {
            ctx.strokeStyle = `rgba(212,168,83,${baseO + ripBoost * 0.16})`;
            ctx.lineWidth   = 0.4 + ripBoost * 0.5;
          } else {
            ctx.strokeStyle = `rgba(255,255,255,${baseO})`;
            ctx.lineWidth   = 0.4;
          }
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    const onMove = (e: MouseEvent) => {
      normMouse.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };

      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;

      if (lx >= 0 && lx <= rect.width && ly >= 0 && ly <= rect.height) {
        glowMouse.current = { x: lx, y: ly };

        // Spawn ripple on fast movement
        const lpx = lastRipplePos.current.x;
        const lpy = lastRipplePos.current.y;
        if (Math.sqrt((lx - lpx) ** 2 + (ly - lpy) ** 2) > 55) {
          ripples.current.push({ x: lx, y: ly, born: performance.now() });
          if (ripples.current.length > 5) ripples.current.shift();
          lastRipplePos.current = { x: lx, y: ly };
        }
      } else {
        glowMouse.current = { x: -9999, y: -9999 };
      }
    };
    const onLeave = () => { glowMouse.current = { x: -9999, y: -9999 }; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
