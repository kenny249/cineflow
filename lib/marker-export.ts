// Turns a resolved cut list (label + quote + real source timestamps) into a
// marker/caption file for a specific editor, so an editor never has to
// manually scrub for a soundbite CineFlow already found for them.
//
// Format notes (confidence varies — see individual builders):
// - Premiere Pro CSV marker import: well-documented, high confidence.
// - FCPXML markers: documented format, but XML validation is strict —
//   this generates a self-contained reference timeline (a gap clip sized to
//   the source audio, with markers at each real timestamp), not markers
//   attached to footage already in your library. Verify on a real import.
// - DaVinci Resolve: markers import via EDL (not CSV) using the legacy
//   "* LOC:" locator comment convention. Medium confidence — the exact
//   dummy-event/LOC arrangement isn't something we could verify without a
//   real Resolve import.
// - SRT: universal fallback, importable as captions almost anywhere.

export interface MarkerCut {
  label: string;
  quote: string;
  start: number; // seconds, real source timestamp
  end: number;
}

export type NleTarget = "fcpx" | "premiere" | "resolve" | "universal";

export const NLE_LABELS: Record<NleTarget, string> = {
  fcpx: "Final Cut Pro",
  premiere: "Premiere Pro",
  resolve: "DaVinci Resolve",
  universal: "Captions (Universal)",
};

const DEFAULT_FPS = 30; // widest-compatible assumption for web/social-first output; noted in exported filenames

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function secToTimecode(totalSeconds: number, fps: number): string {
  const totalFrames = Math.max(0, Math.round(totalSeconds * fps));
  const framesPerHour = fps * 3600;
  const framesPerMinute = fps * 60;
  const h = Math.floor(totalFrames / framesPerHour);
  const remH = totalFrames % framesPerHour;
  const m = Math.floor(remH / framesPerMinute);
  const remM = remH % framesPerMinute;
  const s = Math.floor(remM / fps);
  const f = remM % fps;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

function secToSrtTime(totalSeconds: number): string {
  const ms = Math.max(0, Math.round(totalSeconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(msRem)}`;
}

function cutName(c: MarkerCut): string {
  // Strip stray newlines — every format below treats a marker name as a
  // single line (XML attribute, CSV field, or EDL comment line).
  const quote = c.quote.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return `${c.label}: ${quote}`;
}

// ── Final Cut Pro (FCPXML) ──────────────────────────────────────────────────
// Builds a new reference project — a gap clip spanning the source audio's
// duration, with markers at each real timestamp. Import via File > Import >
// XML. This is a standalone reference timeline, not markers attached to
// footage already in your library — line it up against your real clip by
// matching the 0:00 start point.
function buildFcpxml(cuts: MarkerCut[], totalDurationSec: number): string {
  const fps = DEFAULT_FPS;
  const frameDur = "100/3000s"; // 30fps frame duration, expressed as a rational
  const toRational = (secs: number) => `${Math.round(secs * fps) * 100}/3000s`;

  const markers = cuts
    .map((c) => `                <marker start="${toRational(c.start)}" duration="${frameDur}" value="${xmlEscape(cutName(c))}"/>`)
    .join("\n");

  const totalRational = toRational(Math.max(totalDurationSec, ...cuts.map((c) => c.end), 1));

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.11">
    <resources>
        <format id="r1" name="FFVideoFormat1080p30" frameDuration="${frameDur}" width="1920" height="1080"/>
    </resources>
    <library>
        <event name="CineFlow Soundbites">
            <project name="CineFlow Soundbites — Reference">
                <sequence format="r1" duration="${totalRational}" tcStart="0s" tcFormat="NDF">
                    <spine>
                        <gap name="Reference" offset="0s" duration="${totalRational}" start="0s">
${markers}
                        </gap>
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
`;
}

// ── Premiere Pro (CSV marker import) ────────────────────────────────────────
// Markers panel → Import Marker List. Columns: Marker Name, Description,
// In, Out. Timecodes assume 30fps — adjust in Premiere if your project
// differs.
function buildPremiereCsv(cuts: MarkerCut[]): string {
  const fps = DEFAULT_FPS;
  const header = "Marker Name,Description,In,Out,Duration,Marker Type";
  const rows = cuts.map((c) => {
    const inTc = secToTimecode(c.start, fps);
    const outTc = secToTimecode(c.end, fps);
    const durTc = secToTimecode(Math.max(0, c.end - c.start), fps);
    return [
      csvEscape(c.label),
      csvEscape(c.quote),
      inTc,
      outTc,
      durTc,
      "Comment",
    ].join(",");
  });
  return [header, ...rows].join("\r\n") + "\r\n";
}

// ── DaVinci Resolve (marker EDL) ─────────────────────────────────────────────
// Timeline > Import > Timeline Markers from EDL. Uses the legacy "* LOC:"
// locator convention. Timecodes assume 30fps non-drop-frame.
function buildResolveEdl(cuts: MarkerCut[]): string {
  const fps = DEFAULT_FPS;
  const lines = [
    "TITLE: CineFlow Soundbites",
    "FCM: NON-DROP FRAME",
    "",
    "001  AX       V     C        00:00:00:00 00:00:00:01 00:00:00:00 00:00:00:01",
  ];
  cuts.forEach((c) => {
    const tc = secToTimecode(c.start, fps);
    const name = cutName(c).slice(0, 60); // keep LOC lines readable/short
    lines.push(`* LOC: ${tc} YELLOW ${name}`);
  });
  return lines.join("\n") + "\n";
}

// ── Universal (SRT captions) ─────────────────────────────────────────────────
// Import as a caption/subtitle track — works in virtually every NLE and most
// consumer editors that have no native marker-import path.
function buildSrt(cuts: MarkerCut[]): string {
  return cuts
    .map((c, i) => {
      const idx = i + 1;
      const start = secToSrtTime(c.start);
      const end = secToSrtTime(Math.max(c.end, c.start + 0.5));
      return `${idx}\n${start} --> ${end}\n[${c.label}] ${c.quote}\n`;
    })
    .join("\n");
}

export interface MarkerFile {
  filename: string;
  content: string;
}

export function buildMarkerFile(target: NleTarget, cuts: MarkerCut[], totalDurationSec: number): MarkerFile {
  switch (target) {
    case "fcpx":
      return { filename: "cineflow-markers.fcpxml", content: buildFcpxml(cuts, totalDurationSec) };
    case "premiere":
      return { filename: "cineflow-markers-30fps.csv", content: buildPremiereCsv(cuts) };
    case "resolve":
      return { filename: "cineflow-markers-30fps.edl", content: buildResolveEdl(cuts) };
    case "universal":
      return { filename: "cineflow-captions.srt", content: buildSrt(cuts) };
  }
}
