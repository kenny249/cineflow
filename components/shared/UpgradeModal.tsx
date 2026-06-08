"use client";

import { X, Zap, Users, ScrollText, Building2 } from "lucide-react";
import Link from "next/link";

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  team: <Users className="h-5 w-5 text-[#d4a853]" />,
  scripts: <ScrollText className="h-5 w-5 text-[#d4a853]" />,
  collaborators: <Users className="h-5 w-5 text-[#d4a853]" />,
  default: <Building2 className="h-5 w-5 text-[#d4a853]" />,
};

interface Props {
  feature: "team" | "scripts" | "collaborators" | string;
  title: string;
  description: string;
  onClose: () => void;
}

export function UpgradeModal({ feature, title, description, onClose }: Props) {
  const icon = FEATURE_ICONS[feature] ?? FEATURE_ICONS.default;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0d0d0d] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4a853]/20 bg-[#d4a853]/10">
          {icon}
        </div>

        {/* Copy */}
        <h2 className="mb-2 text-lg font-bold text-white">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-zinc-400">{description}</p>

        {/* What you get */}
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-2">
          {[
            "Unlimited project collaborators",
            "Team management with roles",
            "Scripts library & AI breakdown",
            "Everything in Solo, and more",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#d4a853] shrink-0" />
              <span className="text-xs text-zinc-300">{item}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/upgrade"
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4a853] py-3 text-sm font-bold text-black transition-all hover:bg-[#e0b55e] active:scale-[0.98]"
        >
          <Zap className="h-4 w-4" />
          Upgrade to Studio
        </Link>

        <p className="mt-3 text-center text-[11px] text-zinc-600">
          From $79/month · Cancel anytime
        </p>
      </div>
    </div>
  );
}
