// Matches an AI-picked quote back to its real position in the source audio,
// using Whisper's word-level timestamps. The AI only ever sees plain text, so
// it can't know real timing — this is what grounds its picks in reality.

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface QuoteTimestamp {
  start: number;
  end: number;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface WindowMatch {
  idx: number;
  len: number;
  score: number;
}

// Best-scoring contiguous window of roughly `phraseTokens.length` tokens,
// searched within [from, to) of wordTokens. `len` is always what was
// actually compared (never a longer, unverified span) so a caller can trust
// idx..idx+len-1 as the real matched range.
function bestWindow(
  phraseTokens: string[],
  wordTokens: string[],
  from: number,
  to: number,
  minScore: number
): WindowMatch | null {
  let best: WindowMatch | null = null;
  for (const lenDelta of [0, 1, -1, 2, -2]) {
    const winLen = phraseTokens.length + lenDelta;
    if (winLen <= 0) continue;
    const upper = Math.min(to, wordTokens.length) - winLen;
    for (let i = Math.max(0, from); i <= upper; i++) {
      const cmpLen = Math.min(winLen, phraseTokens.length);
      let matches = 0;
      for (let j = 0; j < cmpLen; j++) {
        if (wordTokens[i + j] === phraseTokens[j]) matches++;
      }
      const score = matches / phraseTokens.length;
      if (!best || score > best.score) best = { idx: i, len: cmpLen, score };
    }
  }
  if (!best || best.score < minScore) return null;
  return best;
}

const WHOLE_MATCH_THRESHOLD = 0.8;
const SHORT_QUOTE_THRESHOLD = 0.55;
const START_ANCHOR_LEN = 6;
const START_ANCHOR_THRESHOLD = 0.65;
const END_ANCHOR_LEN = 4;
const END_ANCHOR_THRESHOLD = 0.6;
const MAX_QUOTE_SPAN_WORDS = 220; // generous cap on how far the end can be from the start

export function findQuoteTimestamp(quote: string, words: WhisperWord[]): QuoteTimestamp | null {
  const quoteTokens = normalize(quote).split(" ").filter(Boolean);
  if (quoteTokens.length === 0 || words.length === 0) return null;

  // Must stay 1:1 with `words` — filtering here would desync every index
  // this function returns from the words it actually came from.
  const wordTokens = words.map((w) => normalize(w.word));

  const toResult = (m: WindowMatch): QuoteTimestamp => {
    const endIdx = Math.min(m.idx + m.len - 1, words.length - 1);
    return { start: words[m.idx].start, end: words[endIdx].end };
  };

  // Fast path: the quote matches cleanly and contiguously — most precise
  // when the AI quoted verbatim with no cleanup.
  const whole = bestWindow(quoteTokens, wordTokens, 0, wordTokens.length, WHOLE_MATCH_THRESHOLD);
  if (whole) return toResult(whole);

  // Too short to meaningfully split into distinct start/end anchors —
  // relax the threshold on a direct match instead of anchor-splitting.
  if (quoteTokens.length <= START_ANCHOR_LEN + END_ANCHOR_LEN) {
    const loose = bestWindow(quoteTokens, wordTokens, 0, wordTokens.length, SHORT_QUOTE_THRESHOLD);
    return loose ? toResult(loose) : null;
  }

  // Real speech is disfluent — "it's it's it's hard to explain" commonly
  // becomes "it's hard to explain" once the AI quotes it. That breaks a
  // strict positional match across the whole quote even though it's a real
  // quote. Anchor on just the first and last few words instead, and span
  // whatever sits between them in the source — the middle content doesn't
  // matter for a physical audio trim, only where it starts and ends.
  const startPhrase = quoteTokens.slice(0, START_ANCHOR_LEN);
  const endPhrase = quoteTokens.slice(-END_ANCHOR_LEN);

  const startMatch = bestWindow(startPhrase, wordTokens, 0, wordTokens.length, START_ANCHOR_THRESHOLD);
  if (!startMatch) return null;

  const searchFrom = startMatch.idx + startMatch.len;
  const searchTo = Math.min(wordTokens.length, searchFrom + MAX_QUOTE_SPAN_WORDS);
  const endMatch = bestWindow(endPhrase, wordTokens, searchFrom, searchTo, END_ANCHOR_THRESHOLD);
  if (!endMatch) return null;

  const endIdx = Math.min(endMatch.idx + endMatch.len - 1, words.length - 1);
  return { start: words[startMatch.idx].start, end: words[endIdx].end };
}
