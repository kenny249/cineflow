"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.is_demo === true) {
        setIsDemo(true);
      }
    });
  }, []);

  if (!isDemo || dismissed) return null;

  return (
    <div className="relative flex items-center justify-between gap-3 border-b border-[#d4a853]/20 bg-[#d4a853]/[0.07] px-4 py-2">
      <div className="flex items-center gap-2 text-xs text-[#d4a853]">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold">Demo Mode</span>
        <span className="hidden text-[#d4a853]/70 sm:inline">
          — You&apos;re exploring with sample data. Nothing you do here affects a real account.
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="/login"
          className="rounded-lg border border-[#d4a853]/40 bg-[#d4a853]/10 px-3 py-1 text-[11px] font-bold text-[#d4a853] transition-colors hover:bg-[#d4a853]/20"
        >
          Create real account
        </a>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-[#d4a853]/50 transition-colors hover:text-[#d4a853]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
