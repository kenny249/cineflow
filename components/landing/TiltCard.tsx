"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface Props {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}

// Subtle mouse-tracked perspective tilt — kept restrained (default 3deg) so it
// reads as a physical object catching light, not a showy tilt.js demo effect.
// A slow, heavy spring (low stiffness, higher mass) so it settles calmly
// instead of snapping to the cursor — that snappiness read as jarring.
// Applied to a wrapper so it composes cleanly with a child's own CSS hover
// transform (lift/scale) instead of both fighting over the same property.
export function TiltCard({ children, className, maxTilt = 3 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springX = useSpring(px, { stiffness: 55, damping: 20, mass: 1 });
  const springY = useSpring(py, { stiffness: 55, damping: 20, mass: 1 });

  const rotateX = useTransform(springY, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(springX, [0, 1], [-maxTilt, maxTilt]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
