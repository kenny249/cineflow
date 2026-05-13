import { createHmac } from "crypto";

const SECRET = process.env.CALENDAR_ICS_SECRET ?? "dev-calendar-secret-change-me";

export function generateCalendarToken(userId: string): string {
  const encoded = Buffer.from(userId).toString("base64url");
  const hmac = createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${encoded}.${hmac}`;
}

export function verifyCalendarToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  try {
    const userId = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    const expected = createHmac("sha256", SECRET).update(userId).digest("base64url");
    if (expected !== token.slice(dot + 1)) return null;
    return userId;
  } catch {
    return null;
  }
}
