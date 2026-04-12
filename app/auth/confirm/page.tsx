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

    const supabase = createClient();
    const next = searchParams.get("next") ?? "/welcome";
    let done = false;

    async function finish(userId: string, userEmail: string | undefined) {
      if (done) return;
      done = true;
      try {
        await supabase
          .from("profiles")
          .upsert(
            { id: userId, email: userEmail, updated_at: new Date().toISOString() },
            { onConflict: "id" }
          );
      } catch { /* non-fatal */ }
      window.location.replace(next);
    }

    // Primary: listen for the SIGNED_IN event.
    // With implicit flow, the Supabase SDK detects the #access_token hash on
    // page load and fires this event automatically — no verifier needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          subscription.unsubscribe();
          clearTimeout(timeout);
          finish(session.user.id, session.user.email);
        }
      }
    );

    // Secondary: in case the session was already set before the listener
    // registered (e.g. fast hydration), check immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        subscription.unsubscribe();
        clearTimeout(timeout);
        finish(session.user.id, session.user.email);
      }
    });

    // Fallback: if nothing fires after 6 seconds the link is expired/used.
    const timeout = setTimeout(() => {
      if (done) return;
      subscription.unsubscribe();
      setError("This link has expired or was already used. Request a new one.");
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#060606] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <Film className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-red-400">Link expired</p>
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
