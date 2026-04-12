"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Film } from "lucide-react";

function AuthConfirmInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function confirm() {
      const supabase = createClient();
      const code       = searchParams.get("code");
      const tokenHash  = searchParams.get("token_hash");
      const type       = searchParams.get("type") ?? "magiclink";
      const next       = searchParams.get("next") ?? "/welcome";

      try {
        if (code) {
          // PKCE flow — link opened in same browser that submitted the form
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          // Token-hash flow — Supabase direct OTP verification (no PKCE verifier needed)
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
          });
          if (error) throw error;
        } else {
          // Implicit flow — Supabase SDK auto-processes #access_token hash on init
          // Give the SDK a moment to detect and set the session from the URL hash
          await new Promise((r) => setTimeout(r, 100));
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error(
              "The magic link may have expired or already been used. Please request a new one."
            );
          }
        }

        // Upsert a profile row so the user always exists in the profiles table
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .upsert(
              { id: user.id, email: user.email, updated_at: new Date().toISOString() },
              { onConflict: "id" }
            );
        }

        window.location.replace(next);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Authentication failed. Please try again.";
        setError(msg);
      }
    }

    confirm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#060606] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <Film className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-red-400">Sign-in failed</p>
          <p className="max-w-xs text-sm text-zinc-500">{error}</p>
        </div>
        <a
          href="/login"
          className="rounded-xl border border-white/10 px-6 py-3 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#060606]">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 shadow-[0_0_40px_rgba(212,168,83,0.2)]">
        <Film className="h-7 w-7 text-[#d4a853]" />
      </div>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-zinc-600">
        Opening your studio…
      </p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#060606]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
        </div>
      }
    >
      <AuthConfirmInner />
    </Suspense>
  );
}
