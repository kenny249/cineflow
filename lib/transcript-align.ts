// Matches an AI-picked quote back to its real position in the source audio,
// using Whisper's word-level timestamps. The AI only ever sees plain text, so
// it can't know real timing — this is what grounds its picks in reality.

export interface WhisperWord {
  word: string;
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

export interface QuoteTimestamp {
  start: number;
  end: number;
}

// Sliding-window token match. Tolerates minor punctuation/casing drift between
// Whisper's raw words and the AI's cleaned-up quote; requires a strong match
// (60%+) before trusting a result — an honest "unavailable" beats a wrong number.
export function findQuoteTimestamp(quote: string, words: WhisperWord[]): QuoteTimestamp | null {
  const quoteTokens = normalize(quote).split(" ").filter(Boolean);
  if (quoteTokens.length === 0 || words.length === 0) return null;

  const wordTokens = words.map((w) => normalize(w.word)).filter((t) => t.length > 0);
  if (wordTokens.length === 0) return null;

  let bestScore = 0;
  let bestStart = -1;
  let bestLen = quoteTokens.length;

  for (const lenDelta of [0, 1, -1, 2, -2]) {
    const winLen = quoteTokens.length + lenDelta;
    if (winLen <= 0 || winLen > wordTokens.length) continue;
    for (let i = 0; i <= wordTokens.length - winLen; i++) {
      const cmpLen = Math.min(winLen, quoteTokens.length);
      let matches = 0;
      for (let j = 0; j < cmpLen; j++) {
        if (wordTokens[i + j] === quoteTokens[j]) matches++;
      }
      const score = matches / quoteTokens.length;
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
        // Only span what was actually verified — using winLen here would let a
        // longer fallback window (lenDelta > 0) push the end timestamp past
        // words that were never compared, quietly cutting extra trailing audio.
        bestLen = cmpLen;
      }
    }
  }

  if (bestScore < 0.6 || bestStart === -1) return null;

  const endIdx = Math.min(bestStart + bestLen - 1, words.length - 1);
  return { start: words[bestStart].start, end: words[endIdx].end };
}
