// Curated Unsplash photo IDs for cinematic project thumbnails
const CINEMATIC_PHOTO_IDS = [
  "1536440136628-849c177e76a1", // dark cinema auditorium
  "1478720568477-152d9b164e26", // neon-lit rain street
  "1440404653325-ab127d49be6",  // NYC night taxi
  "1507003211169-0a1dd7228f2d", // silhouette at window
  "1485846234645-a62644f84728", // film strip closeup
  "1535016120720-40c646be5580", // pro cinema camera
  "1492691527719-9d1e07e534b4", // behind-the-scenes shoot
  "1452701958568-d8c4fcf4c0d7", // dramatic cinematic landscape
  "1574375927818-2b8dfcc7fb38", // dark atmospheric
  "1460627390041-532a28402358", // backstage theater
  "1517604931442-7e0c8ed2963c", // camera lens bokeh
  "1611532736597-de2d4265fba3", // dramatic portrait
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCinematicImageUrl(seed: string, variant = 0): string {
  const idx = (hashString(seed) + variant) % CINEMATIC_PHOTO_IDS.length;
  const photoId = CINEMATIC_PHOTO_IDS[idx];
  return `https://images.unsplash.com/photo-${photoId}?w=1280&h=720&q=80&fit=crop&auto=format`;
}

export const CINEMATIC_COUNT = CINEMATIC_PHOTO_IDS.length;
