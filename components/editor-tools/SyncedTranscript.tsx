"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buildTranscriptCues, formatClock, activeWordIndexAt, type WhisperWord } from "@/lib/transcript-cues";

interface SyncedTranscriptProps {
  text: string;
  words: WhisperWord[];
  audioUrl: string | null;
  // Seconds to jump to once the audio is ready — set from a PDF's deep
  // link (?t=135). Applied once; ignored on subsequent re-renders.
  seekToSeconds?: number | null;
  className?: string;
}

// The interactive, Rev-style transcript: a native audio player synced
// bidirectionally with timestamped text below it — click a word to seek
// there, and the word under playback highlights as it plays. Falls back to
// the old plain-text block whenever word timestamps aren't available at all
// (older transcripts saved before this existed), so nothing regresses.
export function SyncedTranscript({ text, words, audioUrl, seekToSeconds, className }: SyncedTranscriptProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const activeIndexRef = useRef(-1);
  const seekedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const cues = useMemo(() => buildTranscriptCues(words), [words]);

  // Flat index -> which cue it belongs to, so a click on any word can find
  // and highlight its own span without re-scanning cues each time.
  useEffect(() => {
    wordRefs.current = new Array(words.length).fill(null);
    activeIndexRef.current = -1;
  }, [words]);

  useEffect(() => {
    seekedRef.current = false;
  }, [audioUrl]);

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play().catch(() => {});
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const idx = activeWordIndexAt(words, audio.currentTime);
    if (idx === activeIndexRef.current) return;
    const prevEl = activeIndexRef.current >= 0 ? wordRefs.current[activeIndexRef.current] : null;
    prevEl?.classList.remove("bg-[#d4a853]/25", "text-foreground");
    const nextEl = idx >= 0 ? wordRefs.current[idx] : null;
    nextEl?.classList.add("bg-[#d4a853]/25", "text-foreground");
    if (nextEl && isPlaying) {
      nextEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    activeIndexRef.current = idx;
  }

  function handleLoadedMetadata() {
    if (seekedRef.current) return;
    if (seekToSeconds != null && audioRef.current) {
      seekedRef.current = true;
      seekTo(seekToSeconds);
    }
  }

  if (words.length === 0) {
    // No timestamp data at all — same plain rendering as before this
    // feature existed.
    return (
      <p className={cn("whitespace-pre-wrap text-sm leading-7 text-foreground/80", className)}>{text}</p>
    );
  }

  let wordCursor = 0;

  return (
    <div className={className}>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="mb-4 w-full [&::-webkit-media-controls-panel]:bg-transparent"
        />
      )}

      <div className="space-y-3">
        {cues.map((cue, ci) => {
          const startIdx = wordCursor;
          wordCursor += cue.words.length;
          return (
            <p key={ci} className="text-sm leading-7 text-foreground/80">
              <button
                type="button"
                onClick={() => seekTo(cue.start)}
                disabled={!audioUrl}
                title={audioUrl ? "Jump to this moment" : undefined}
                className={cn(
                  "mr-2 inline-block select-none rounded-md px-1.5 py-0.5 align-middle text-[10px] font-mono font-semibold tabular-nums",
                  audioUrl
                    ? "cursor-pointer bg-white/[0.06] text-[#d4a853] hover:bg-[#d4a853]/15 transition-colors"
                    : "bg-white/[0.04] text-muted-foreground/60"
                )}
              >
                {formatClock(cue.start)}
              </button>
              {cue.words.map((w, wi) => {
                const flatIdx = startIdx + wi;
                return (
                  <span
                    key={flatIdx}
                    ref={(el) => { wordRefs.current[flatIdx] = el; }}
                    onClick={() => seekTo(w.start)}
                    className={cn(
                      "rounded px-0.5 transition-colors",
                      audioUrl && "cursor-pointer hover:bg-white/[0.08]"
                    )}
                  >
                    {w.word}{" "}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}
