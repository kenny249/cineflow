"use client";

import { cn } from "@/lib/utils";

export function FoundingMemberBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "group relative inline-flex cursor-default select-none items-center gap-1 overflow-hidden rounded-full border border-[#d4a853]/40 bg-[#d4a853]/10 px-2.5 py-0.5",
        className
      )}
    >
      {/* Shimmer sweep on hover */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#d4a853]/30 to-transparent transition-transform duration-700 ease-in-out group-hover:translate-x-full" />

      <span className="relative z-10 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d4a853]">
        ✦ Founding Member
      </span>
    </div>
  );
}
