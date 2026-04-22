import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MapPin, Mail, Phone, Globe, Instagram, ExternalLink, Star } from "lucide-react";
import type { CrewProfile } from "@/types";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const AVAIL_COLOR: Record<string, string> = {
  available: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  booked: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  unavailable: "text-zinc-400 border-zinc-500/20 bg-zinc-500/10",
};

export default async function PublicCrewProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("crew_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!data) notFound();

  const profile = data as CrewProfile;
  const initials = profile.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Nav bar */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <a href="/" className="text-[0.6rem] font-bold tracking-[0.35em] text-[#d4a853] uppercase">CineFlow</a>
        <a
          href="/login"
          className="rounded-lg border border-[#d4a853]/30 bg-[#d4a853]/10 px-4 py-1.5 text-xs font-semibold text-[#d4a853] hover:bg-[#d4a853]/20 transition-colors"
        >
          Join the network
        </a>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Profile header */}
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#d4a853]/10 text-[#d4a853] text-2xl font-bold border border-[#d4a853]/20">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
              {profile.is_claimed && (
                <span className="rounded-full bg-[#d4a853]/10 border border-[#d4a853]/20 px-2 py-0.5 text-[10px] font-bold text-[#d4a853] uppercase tracking-wider">
                  CineFlow Pro
                </span>
              )}
            </div>
            <p className="text-base text-zinc-400 mt-0.5">{profile.primary_role}</p>
            {location && (
              <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
                <MapPin className="h-3.5 w-3.5" />{location}
              </p>
            )}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${AVAIL_COLOR[profile.availability]}`}>
                {profile.availability === "available" ? "Available for work" : profile.availability === "booked" ? "Currently booked" : "Not available"}
              </span>
              {(profile.day_rate_min || profile.day_rate_max) && (
                <span className="text-sm text-zinc-400">
                  {profile.day_rate_min && profile.day_rate_max
                    ? `$${profile.day_rate_min.toLocaleString()}–$${profile.day_rate_max.toLocaleString()}/day`
                    : profile.day_rate_min
                      ? `From $${profile.day_rate_min.toLocaleString()}/day`
                      : `Up to $${profile.day_rate_max!.toLocaleString()}/day`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <p className="text-sm text-zinc-400 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Contact */}
        <div className="flex flex-wrap gap-3">
          {profile.email && (
            <a href={`mailto:${profile.email}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 hover:border-[#d4a853]/30 hover:text-white transition-colors">
              <Mail className="h-4 w-4 text-[#d4a853]" /> {profile.email}
            </a>
          )}
          {profile.phone && (
            <a href={`tel:${profile.phone}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 hover:border-[#d4a853]/30 hover:text-white transition-colors">
              <Phone className="h-4 w-4 text-[#d4a853]" /> {profile.phone}
            </a>
          )}
          {profile.instagram && (
            <a href={`https://instagram.com/${profile.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 hover:border-[#d4a853]/30 hover:text-white transition-colors">
              <Instagram className="h-4 w-4 text-[#d4a853]" /> {profile.instagram}
            </a>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-zinc-300 hover:border-[#d4a853]/30 hover:text-white transition-colors">
              <Globe className="h-4 w-4 text-[#d4a853]" /> Website
            </a>
          )}
          {profile.reel_url && (
            <a href={profile.reel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-[#d4a853]/30 bg-[#d4a853]/10 px-4 py-2.5 text-sm font-semibold text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors">
              <ExternalLink className="h-4 w-4" /> View Reel
            </a>
          )}
        </div>

        {/* Skills + Gear */}
        <div className="grid gap-5 sm:grid-cols-2">
          {profile.skills.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((s) => (
                  <span key={s} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400">{s}</span>
                ))}
              </div>
            </div>
          )}
          {profile.gear.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Gear</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.gear.map((g) => (
                  <span key={g} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400">{g}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="rounded-xl border border-[#d4a853]/15 bg-[#d4a853]/[0.04] p-6 text-center">
          <p className="text-sm font-semibold text-white mb-1">Find more film professionals like {profile.name.split(" ")[0]}</p>
          <p className="text-xs text-zinc-500 mb-4">CineFlow is the production platform built for video agencies and filmmakers.</p>
          <a href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#d4a853] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#e0b55e] transition-colors">
            Join CineFlow free →
          </a>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("crew_profiles")
    .select("name, primary_role, city, state")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "Crew Profile | CineFlow" };

  const location = [data.city, data.state].filter(Boolean).join(", ");
  return {
    title: `${data.name} — ${data.primary_role}${location ? ` in ${location}` : ""} | CineFlow`,
    description: `${data.name} is a ${data.primary_role}${location ? ` based in ${location}` : ""}. Connect on CineFlow.`,
  };
}
