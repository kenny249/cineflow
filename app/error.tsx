"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Film, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080808] px-6">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10">
        <Film className="h-7 w-7 text-[#d4a853]" />
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Something went wrong</h1>
      <p className="mb-8 max-w-sm text-center text-sm text-zinc-500">
        An unexpected error occurred. Try again, or go back to your dashboard.
        {error.digest && (
          <span className="mt-2 block font-mono text-xs text-zinc-700">ref: {error.digest}</span>
        )}
      </p>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.08]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl bg-[#d4a853] px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
