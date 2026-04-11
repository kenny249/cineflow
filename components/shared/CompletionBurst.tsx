"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Particle = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  size: number;
  /** width > size → elongated DNA-strand particle */
  width: number;
  rotation: number;
};

const COLORS = [
  "#d4a853", "#e0b866", "#fff5d2", "#b8904a",
  "#f0c060", "#c8922a", "#ffffff", "#d4a85380",
];

function createBurst(originX: number, originY: number, startId: number): Particle[] {
  const COUNT = 14;
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const dist = 28 + Math.random() * 72;
    const isDna = Math.random() < 0.38; // ~40% elongated DNA strands
    const size = isDna ? 1.5 + Math.random() : 2.5 + Math.random() * 3;
    return {
      id: startId + i,
      x: originX,
      y: originY,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size,
      width: isDna ? size * (3 + Math.random() * 4) : size,
      rotation: Math.random() * 360,
    };
  });
}

export function useCompletionBurst() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const counter = useRef(0);

  const fire = useCallback((clientX: number, clientY: number) => {
    const newPs = createBurst(clientX, clientY, counter.current);
    counter.current += newPs.length;
    setParticles((prev) => [...prev, ...newPs]);
    const ids = new Set(newPs.map((p) => p.id));
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, 950);
  }, []);

  return { fire, particles };
}

export function BurstRenderer({ particles }: { particles: Particle[] }) {
  if (particles.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            style={{
              position: "fixed",
              left: p.x,
              top: p.y,
              width: p.width,
              height: p.size,
              borderRadius: 9999,
              background: p.color,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}99`,
              translateX: "-50%",
              translateY: "-50%",
              rotate: p.rotation,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 0.1 }}
            transition={{ duration: 0.65, ease: [0.2, 0.8, 0.4, 1] }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
