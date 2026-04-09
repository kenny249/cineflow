// Stable picsum photo IDs — hardcoded so no redirect, no API key needed
const CINEMATIC_IDS = [
  10, 15, 20, 26, 42, 48, 62, 77, 91, 103, 112, 126,
];

export const CINEMATIC_COUNT = CINEMATIC_IDS.length;

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCinematicImageUrl(seed: string, variant = 0): string {
  const idx = (hashString(seed) + variant) % CINEMATIC_IDS.length;
  const id = CINEMATIC_IDS[idx];
  // Direct CDN URL — no redirect, works everywhere
  return `https://fastly.picsum.photos/id/${id}/1280/720.jpg`;
}
