// Groups Whisper's flat word-level timestamps into readable, timestamped
// chunks — the same building block used by the on-screen synced transcript
// (components/editor-tools/SyncedTranscript.tsx) and the PDF export
// (lib/transcript-pdf.tsx), so what you see on screen and what prints match.
//
// There's no real diarization here (Whisper doesn't provide speaker turns),
// so a "cue" is a plain sentence/pause-bounded chunk, not a speaker turn.
// Breaks happen at whichever comes first: a real pause in the audio, a
// sentence-ending word if the cue has already accrued a reasonable amount of
// content, or a hard word-count ceiling — so a transcript with no punctuation
// at all (word timestamps sometimes come back stripped of it) still breaks
// into sane-length chunks instead of running on as one giant paragraph.

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptCue {
  start: number;
  end: number;
  text: string;
  words: WhisperWord[];
}

const PAUSE_BREAK_SEC = 0.6;
const MAX_CUE_WORDS = 18;
const MIN_WORDS_BEFORE_SENTENCE_BREAK = 4;
const SENTENCE_END_RE = /[.!?]["')\]]?$/;

export function buildTranscriptCues(words: WhisperWord[]): TranscriptCue[] {
  if (!words.length) return [];
  const cues: TranscriptCue[] = [];
  let current: WhisperWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    cues.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      // Whisper's word tokens are space-separated already; tidy up the one
      // artifact that leaves behind — a space before trailing punctuation —
      // without trying to fully re-punctuate/re-case anything ourselves.
      text: current.map((w) => w.word).join(" ").replace(/\s+([,.!?;:])/g, "$1"),
      words: current,
    });
    current = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    current.push(w);
    const next = words[i + 1];
    if (!next) {
      flush();
      continue;
    }
    const gap = next.start - w.end;
    const endsSentence = SENTENCE_END_RE.test(w.word.trim());
    const longEnoughForSentenceBreak = endsSentence && current.length >= MIN_WORDS_BEFORE_SENTENCE_BREAK;
    const hitWordCeiling = current.length >= MAX_CUE_WORDS;
    if (gap >= PAUSE_BREAK_SEC || longEnoughForSentenceBreak || hitWordCeiling) {
      flush();
    }
  }
  flush();
  return cues;
}

// "1:05" under an hour, "1:01:05" once it runs long — matches how every
// media player on earth formats a clock, so it needs no explanation.
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Index of the word active at `time`, or -1 before the first word starts /
// after speech has ended entirely. Binary search so this stays cheap to call
// on every `timeupdate` tick even for a multi-hour, thousands-of-words file.
export function activeWordIndexAt(words: WhisperWord[], time: number): number {
  if (!words.length || time < words[0].start) return -1;
  let lo = 0, hi = words.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= time) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
