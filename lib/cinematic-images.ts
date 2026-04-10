// Film-noir inspired gradient palettes — no external URLs, works offline
const CINEMATIC_PALETTES: [string, string][] = [
  ["#0d0d1a", "#1e1230"],  // deep indigo
  ["#0a1420", "#0e2535"],  // ocean noir
  ["#1a1208", "#2e200a"],  // amber noir
  ["#0a1a12", "#10281a"],  // forest noir
  ["#1a0a0a", "#2e1212"],  // crimson noir
  ["#0a0a1a", "#141438"],  // midnight blue
  ["#121828", "#182640"],  // steel blue
  ["#201815", "#342510"],  // leather noir
  ["#0f1520", "#182540"],  // dusk blue
  ["#191520", "#282038"],  // twilight slate
  ["#10180f", "#1a2a18"],  // pine noir
  ["#1e1020", "#30183a"],  // plum noir
];

export const CINEMATIC_COUNT = CINEMATIC_PALETTES.length;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Returns a CSS gradient string — use as inline `background` style. No network needed. */
export function getCinematicGradient(seed: string, variant = 0): string {
  const idx = (hashString(seed) + variant) % CINEMATIC_PALETTES.length;
  const [c1, c2] = CINEMATIC_PALETTES[idx];
  return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

/**
 * Returns a self-contained SVG data URI — usable as an <img> src with zero
 * network requests. Safe for SSR (uses encodeURIComponent, not btoa).
 */
export function getCinematicImageUrl(seed: string, variant = 0): string {
  const idx = (hashString(seed) + variant) % CINEMATIC_PALETTES.length;
  const [c1, c2] = CINEMATIC_PALETTES[idx];
  // Triangle overlay creates a diagonal gradient-like effect without url(#id) refs
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">` +
    `<rect width="1280" height="720" fill="${c1}"/>` +
    `<polygon points="1280,0 1280,720 0,720" fill="${c2}" opacity="0.75"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
