"use client";

import { useRouter } from "next/navigation";
import { X, Zap, ScrollText, UsersRound, Clapperboard, Camera } from "lucide-react";

const STUDIO_FEATURES = [
  { icon: ScrollText,  label: "Scripts",         desc: "AI-powered script breakdowns" },
  { icon: UsersRound,  label: "Team",             desc: "Add collaborators to projects" },
  { icon: Clapperboard,label: "Storyboard",       desc: "Visual storyboard builder" },
  { icon: Camera,      label: "Shot Lists",       desc: "Shot planning and export" },
];

interface UpgradePlanModalProps {
  featureLabel: string;
  onClose: () => void;
}

export function UpgradePlanModal({ featureLabel, onClose }: UpgradePlanModalProps) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[#d4a853]/20 bg-[#0d0d0d] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10">
            <Zap className="h-5 w-5 text-[#d4a853]" />
          </div>
          <h2 className="text-base font-bold text-white">
            {featureLabel} is on Studio
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Upgrade to unlock this and everything below.
          </p>
        </div>

        {/* Feature list */}
        <div className="mb-5 space-y-2">
          {STUDIO_FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <Icon className="h-4 w-4 shrink-0 text-[#d4a853]" />
              <div>
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[10px] text-white/40">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => { router.push("/upgrade"); onClose(); }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition hover:bg-[#e0b55e] active:scale-[0.98]"
        >
          <Zap className="h-4 w-4" />
          Upgrade to Studio — $79/mo
        </button>
        <p className="mt-2 text-center text-[10px] text-white/25">
          Cancel anytime · No contracts
        </p>
      </div>
    </div>
  );
}
