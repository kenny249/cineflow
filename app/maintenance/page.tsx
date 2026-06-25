import { createClient } from "@supabase/supabase-js";
import { Film } from "lucide-react";

async function getMessage(): Promise<string> {
  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await admin
      .from("site_settings")
      .select("maintenance_message")
      .eq("id", 1)
      .single();
    return data?.maintenance_message ?? "We'll be back shortly.";
  } catch {
    return "We'll be back shortly.";
  }
}

export default async function MaintenancePage() {
  const message = await getMessage();

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4">
      {/* Ambient top glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(212,168,83,0.06),transparent)]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d4a853]/30 bg-[#d4a853]/10 shadow-[0_0_40px_rgba(212,168,83,0.15)]">
            <Film className="h-6 w-6 text-[#d4a853]" />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-tight text-white">CINEFLOW</p>
            <p className="text-[10px] tracking-widest text-white/25 uppercase">by Maltav</p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="mb-6 flex items-center gap-2 rounded-full border border-[#d4a853]/20 bg-[#d4a853]/[0.06] px-4 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#d4a853]/50 duration-1000" />
            <span className="relative h-2 w-2 rounded-full bg-[#d4a853]" />
          </span>
          <span className="text-xs font-medium text-[#d4a853]">Maintenance in Progress</span>
        </div>

        <h1 className="mb-3 text-2xl font-bold text-white">
          We&apos;ll be right back.
        </h1>
        <p className="text-sm leading-relaxed text-white/50">{message}</p>

        <p className="mt-10 text-[11px] text-white/20">
          Already have an account?{" "}
          <a href="/login" className="text-white/40 underline underline-offset-2 hover:text-white/60 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
