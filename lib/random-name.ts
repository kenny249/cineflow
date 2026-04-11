const FIRST_NAMES = [
  "Ava", "Miles", "Zara", "Kai", "Nova", "Rex", "Lyra", "Jett",
  "Nora", "Ace", "Iris", "Cole", "Eden", "Finn", "Luna", "Dash",
  "Skye", "Rome", "Vera", "Axel", "Cleo", "Blaze", "Sora", "Cruz",
];

const LAST_NAMES = [
  "Storm", "Vance", "Cross", "Blake", "Stone", "Raye", "Onyx", "Vale",
  "Haze", "Croft", "Stark", "Grey", "Nox", "Sloane", "Ash", "Wolfe",
  "Caine", "Reed", "Lux", "Mast", "Ford", "North", "West", "Sage",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateDisplayName(): string {
  return `${randomFrom(FIRST_NAMES)} ${randomFrom(LAST_NAMES)}`;
}

const STORAGE_KEY = "cf_display_name";

export function getOrCreateDisplayName(): string {
  if (typeof window === "undefined") return "Studio User";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  const name = generateDisplayName();
  localStorage.setItem(STORAGE_KEY, name);
  return name;
}

export function setDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, name);
}

export function resetDisplayName(): string {
  if (typeof window === "undefined") return "Studio User";
  const name = generateDisplayName();
  localStorage.setItem(STORAGE_KEY, name);
  return name;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
