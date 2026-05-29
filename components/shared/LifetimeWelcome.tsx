"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";

const STORAGE_KEY = "cf_lifetime_welcomed";

const ease = [0.16, 1, 0.3, 1] as const;

function FadeUp({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease }}
    >
      {children}
    </motion.div>
  );
}

export function LifetimeWelcome({ plan }: { plan: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (plan !== "lifetime") return;
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, [plan]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="lifetime-welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, #1c1508 0%, #090909 65%)",
          }}
          onClick={dismiss}
        >
          {/* Ambient gold glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="h-[500px] w-[500px] rounded-full bg-[#d4a853]/[0.07] blur-[140px]" />
          </div>

          {/* Content card — stop click propagation so only backdrop dismisses */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ delay: 0.1, duration: 0.8, ease }}
            className="relative z-10 flex flex-col items-center text-center px-10 max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Crown */}
            <FadeUp delay={0.25}>
              <Crown
                className="h-9 w-9 text-[#d4a853] mb-7"
                strokeWidth={1.25}
              />
            </FadeUp>

            {/* LIFETIME ACCESS mono label */}
            <FadeUp delay={0.4}>
              <p className="font-mono text-[10px] tracking-[0.28em] text-[#d4a853]/80 uppercase mb-5">
                Lifetime Access
              </p>
            </FadeUp>

            {/* CineFlow wordmark gradient */}
            <FadeUp delay={0.55}>
              <h1
                className="text-[2.6rem] font-bold tracking-tight leading-none mb-7"
                style={{
                  background:
                    "linear-gradient(140deg, #c49840 0%, #f0c96e 45%, #c49840 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                CineFlow
              </h1>
            </FadeUp>

            {/* Gold rule */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.7, ease }}
              className="w-12 h-px bg-[#d4a853]/35 mb-7"
            />

            {/* Headline copy */}
            <FadeUp delay={0.85}>
              <p className="text-[15px] text-white/75 leading-relaxed mb-2">
                You've been gifted lifetime access.
              </p>
              <p className="text-[13px] text-white/35 leading-relaxed mb-8">
                Every feature. Every update. Forever.
              </p>
            </FadeUp>

            {/* Benefits */}
            <FadeUp delay={1.0}>
              <div className="flex flex-col gap-2 mb-10 text-[12px] text-white/30 leading-relaxed">
                <span>Full Studio access — no subscription needed</span>
                <span>All future features as they ship</span>
                <span>Priority support, always</span>
              </div>
            </FadeUp>

            {/* CTA */}
            <FadeUp delay={1.15}>
              <button
                onClick={dismiss}
                className="bg-[#d4a853] text-black text-[13px] font-semibold tracking-wide rounded-xl px-9 py-3.5 transition-all duration-150 hover:bg-[#e0b968] active:scale-[0.97]"
              >
                Start Exploring
              </button>
            </FadeUp>

            {/* Footnote */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.55, duration: 0.8 }}
              className="mt-6 text-[10px] text-white/18 tracking-wider"
            >
              This screen won't appear again.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
