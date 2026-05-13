import { createHmac } from "crypto";

const SECRET = process.env.CALENDAR_ICS_SECRET ?? "dev-calendar-secret-change-me";
const SEP = "--";

export function generateCalendarToken(userId: string): string {
  const encoded = Buffer.from(userId).toString("base64url");
  const hmac = createHmac("sha256", SECRET).update(userId).digest("base64url");
  return `${encoded}${SEP}${hmac}`;
}

export function verifyCalendarToken(token: string): string | null {
  const idx = token.indexOf(SEP);
  if (idx === -1) return null;
  try {
    const userId = Buffer.from(token.slice(0, idx), "base64url").toString("utf8");
    const expected = createHmac("sha256", SECRET).update(userId).digest("base64url");
    if (expected !== token.slice(idx + SEP.length)) return null;
    return userId;
  } catch {
    return null;
  }
}
