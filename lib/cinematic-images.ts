// Picsum seed suffixes for variation — deterministic per project
const CINEMATIC_SUFFIXES = [
  "cinema", "film", "noir", "reel", "lens",
  "frame", "scene", "studio", "shot", "focus",
  "director", "take",
];

export const CINEMATIC_COUNT = CINEMATIC_SUFFIXES.length;

export function getCinematicImageUrl(seed: string, variant = 0): string {
  const suffix = CINEMATIC_SUFFIXES[variant % CINEMATIC_SUFFIXES.length];
  // picsum seed gives a consistent image for the same string
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}-${suffix}/1280/720`;
}
