"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Film } from "lucide-react";

function CallbackInner() {
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const tokenHash = searchParams.get("token_hash");
    const code      = searchParams.get("code");
    const type      = searchParams.get("type") ?? "email";
    const next      = searchParams.get("next") ?? "/welcome";

    if (!tokenHash && !code) {
      setErrorMsg("No authentication token found. Please request a new magic link.");
      return;
    }

    const supabase = createClient();

    async function exchange() {
      const isInvite = type === "invite";

      let user = null;
      let lastMsg = "Authentication failed.";

      if (code) {
        // PKCE flow — invite links and some magic links use this path
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.user) {
          user = data.user;
        } else if (error) {
          lastMsg = error.message;
        }
      } else {
        // token_hash flow — OTP / magic link
        const types: Array<"email" | "magiclink" | "invite"> = isInvite
          ? ["invite"]
          : type === "email"
            ? ["email", "magiclink"]
            : ["magiclink", "email"];

        for (const t of types) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash!,
            type: t,
          });
          if (!error && data.user) {
            user = data.user;
            break;
          }
          if (error) lastMsg = error.message;
        }
      }

      if (!user) {
        setErrorMsg(`${lastMsg} Try opening the magic link from your iPhone's Mail app or Safari instead of Gmail or Chrome.`);
        return;
      }

      // Upsert profile — persist plan from user_metadata (non-fatal if it fails)
      try {
        const meta = user.user_metadata ?? {};
        const plan = (meta.plan as string) ?? "studio_beta";

        if (isInvite && meta.workspace_id) {
          // Invited member: set workspace_id and mark team_members row active
          await supabase.from("profiles").upsert(
            {
              id: user.id,
              plan,
              workspace_id: meta.workspace_id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );
          // Link team_members row to the real user_id and activate it
          await supabase
            .from("team_members")
            .update({ user_id: user.id, status: "active" })
            .eq("invited_by", meta.workspace_id)
            .eq("email", user.email ?? "")
            .eq("status", "pending");

          if (meta.invited_as) {
            const parts = (meta.invited_as as string).split(" ");
            await supabase.from("profiles").update({
              first_name: parts[0] ?? null,
              last_name: parts.slice(1).join(" ") || null,
            }).eq("id", user.id);
            localStorage.setItem("cf_display_name", meta.invited_as as string);
          }
        } else {
          // Owner signup: workspace_id = their own uid so they can invite members
          await supabase.from("profiles").upsert(
            { id: user.id, email: user.email, plan, workspace_id: user.id, updated_at: new Date().toISOString() },
            { onConflict: "id" }
          );
          sessionStorage.setItem("cf_plan", plan);

          // Seed localStorage display name from real profile so nav shows correct name
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          if (profile?.first_name || profile?.last_name) {
            const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
            localStorage.setItem("cf_display_name", fullName);
          }
        }
      } catch { /* non-fatal */ }

      window.location.replace(next);
    }

    exchange();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMsg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#060606] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <Film className="h-7 w-7 text-red-400" />
        </div>
        <div>
          <p className="mb-1 text-sm font-semibold text-red-400">Could not sign in</p>
          <p className="max-w-xs text-sm text-zinc-500">{errorMsg}</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <a
            href="/login"
            className="rounded-xl bg-[#d4a853] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Request a new link
          </a>
          <p className="text-[11px] text-zinc-600">
            Tip: open the email in Apple Mail or Safari for the best experience.
          </p>
        </div>
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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#060606]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#d4a853]/20 border-t-[#d4a853]" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
