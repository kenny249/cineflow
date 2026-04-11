import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { StoryboardFrame } from "@/types";

async function getShare(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usecineflow.com";
  const res = await fetch(`${baseUrl}/api/storyboard-share?token=${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { share } = await res.json();
  return share as { title: string; frames: StoryboardFrame[] } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const share = await getShare(params.token);
  return {
    title: share ? `${share.title} — CineFlow` : "Storyboard — CineFlow",
    description: "A cinematic storyboard presentation powered by CineFlow.",
  };
}

export default async function BoardPage({ params }: { params: { token: string } }) {
  const share = await getShare(params.token);
  if (!share) notFound();

  const { title, frames } = share;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Cinematic header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a]/90 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Wordmark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="CineFlow">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#d4a853" fillOpacity="0.15" />
            <path d="M7 8h2v8H7V8zm4-2h2v12h-2V6zm4 4h2v4h-2v-4z" fill="#d4a853" />
          </svg>
          <span className="text-sm font-bold tracking-widest text-[#d4a853] uppercase">CineFlow</span>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-white/80">{title}</p>
          <p className="text-[10px] text-white/30 uppercase tracking-widest">Storyboard Presentation</p>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.4em] text-[#d4a853]">
          Production Storyboard
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
          {title}
        </h1>
        <p className="mt-5 text-sm text-white/40">
          {frames.length} frame{frames.length !== 1 ? "s" : ""} &middot; Scroll to explore
        </p>
        <div className="mt-8 h-px w-24 bg-gradient-to-r from-transparent via-[#d4a853]/40 to-transparent" />
      </section>

      {/* ── Frames ── */}
      <main className="mx-auto max-w-5xl px-4 pb-32 space-y-0">
        {frames.map((frame, i) => (
          <FrameSection key={frame.id ?? i} frame={frame} index={i} />
        ))}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-6 py-10 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="#d4a853" fillOpacity="0.15" />
            <path d="M7 8h2v8H7V8zm4-2h2v12h-2V6zm4 4h2v4h-2v-4z" fill="#d4a853" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest text-[#d4a853]">CineFlow</span>
        </div>
        <p className="text-[11px] text-white/25">
          Powered by CineFlow &middot; usecineflow.com
        </p>
      </footer>
    </div>
  );
}

// ─── FrameSection ─────────────────────────────────────────────────────────────

function FrameSection({ frame, index }: { frame: StoryboardFrame; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <section className="relative py-16 sm:py-24">
      {/* Divider line */}
      {index > 0 && (
        <div className="absolute inset-x-0 top-0 flex items-center">
          <div className="h-px flex-1 bg-white/[0.04]" />
          <span className="mx-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/15">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="h-px flex-1 bg-white/[0.04]" />
        </div>
      )}

      <div
        className={`flex flex-col gap-10 sm:flex-row sm:items-center ${
          isEven ? "sm:flex-row" : "sm:flex-row-reverse"
        }`}
      >
        {/* Image */}
        <div className="w-full sm:w-[55%] shrink-0">
          {frame.image_url ? (
            <div className="overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.image_url}
                alt={frame.title ?? `Frame ${index + 1}`}
                className="w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-900">
              <span className="text-[10px] uppercase tracking-widest text-white/20">No image</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4">
          {/* Frame number */}
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#d4a853]/60">
            Frame {String(index + 1).padStart(2, "0")}
          </span>

          {/* Title */}
          <h2 className="text-2xl font-bold leading-snug text-white sm:text-3xl">
            {frame.title || "Untitled Frame"}
          </h2>

          {/* Description */}
          {frame.description && (
            <p className="text-[15px] leading-relaxed text-white/55">{frame.description}</p>
          )}

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {frame.shot_type && (
              <span className="rounded-full border border-[#d4a853]/20 bg-[#d4a853]/[0.07] px-3 py-1 text-[11px] font-medium text-[#d4a853]">
                {frame.shot_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
            {frame.mood && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/50">
                {frame.mood}
              </span>
            )}
            {frame.camera_angle && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/40">
                {frame.camera_angle}
              </span>
            )}
            {frame.shot_duration && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/40">
                {frame.shot_duration}
              </span>
            )}
          </div>

          {/* Notes */}
          {frame.notes && (
            <p className="border-l-2 border-[#d4a853]/30 pl-4 text-[13px] italic text-white/35">
              {frame.notes}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
