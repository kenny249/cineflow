import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PrintButton } from "./PrintButton";

// ─── Types (mirrors CallSheetGenerator internals) ──────────────────────────────

interface CrewWithCall {
  id: string;
  name: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  callTime: string;
}

interface LocationWithParking {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  parkingNotes: string;
}

interface ScheduleItem {
  time: string;
  label: string;
  location: string | null;
  type: "logistics" | "setup" | "shoot" | "break" | "move" | "wrap";
}

interface CoverageAssignment {
  person: string;
  role: string;
  equipment: string;
  responsibilities: string[];
  callTime?: string;
}

interface StaticCamera { name: string; role: string }
interface KeyMoment { label: string; description: string; type: string }
interface RunOfShowItem { setTime: string; endTime?: string; artist: string; duration: string; stage: string; notes: string }

interface ScriptedSheet   { format: "scripted";   schedule: ScheduleItem[]; warning: string | null }
interface LiveEventSheet  { format: "live_event"; coverage: CoverageAssignment[]; staticCameras: StaticCamera[]; keyMoments: KeyMoment[]; runOfShow: RunOfShowItem[]; warning: string | null }
interface InterviewSheet  { format: "interview";  schedule: ScheduleItem[]; warning: string | null }
type GeneratedSheet = ScriptedSheet | LiveEventSheet | InterviewSheet;

interface FormData {
  shootDate: string;
  callTime: string;
  wrapTime: string;
  hospital: string;
  weather: string;
  confidential: boolean;
  directorNote: string;
  emergencyContact: string;
  walkieChannels: string;
  doorsTime: string;
  soundCheckTime: string;
  showTime: string;
  loadInTime: string;
  dresscode: string;
}

interface SheetData {
  sheet?: GeneratedSheet;
  crew?: CrewWithCall[];
  locations?: LocationWithParking[];
  formData?: Partial<FormData>;
}

interface CallSheet {
  id: string;
  title: string;
  shoot_date: string | null;
  data: SheetData;
  project: { id: string; title: string } | null;
}

// ─── Data fetch ────────────────────────────────────────────────────────────────

async function getCallSheet(token: string): Promise<CallSheet | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://usecineflow.com"}/api/call-sheets/public/${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const cs = await getCallSheet(token);
  const title = cs ? `${cs.title} — CineFlow` : "Call Sheet — CineFlow";
  return { title, description: "Shared call sheet from CineFlow." };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(t: string | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

const SCHEDULE_TYPE_COLOR: Record<string, string> = {
  shoot:     "#d4a853",
  setup:     "#60a5fa",
  logistics: "#a78bfa",
  break:     "#34d399",
  move:      "#fb923c",
  wrap:      "#f87171",
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function PublicCallSheetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cs = await getCallSheet(token);
  if (!cs) notFound();

  const { sheet, crew = [], locations = [], formData = {} } = cs.data ?? {};

  const primaryLocation = locations[0];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .page-break { page-break-before: always; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div className="min-h-screen bg-zinc-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="mx-auto max-w-3xl bg-white shadow-lg rounded-2xl overflow-hidden print:shadow-none print:rounded-none">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ background: "#18181b" }} className="px-8 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p style={{ color: "#d4a853", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>
                  CineFlow · Call Sheet
                </p>
                <h1 style={{ color: "white", fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  {cs.title}
                </h1>
                {cs.project && (
                  <p style={{ color: "#a1a1aa", fontSize: 13, marginTop: 4, margin: 0 }}>
                    {cs.project.title}
                  </p>
                )}
              </div>
              {formData.confidential && (
                <span style={{ background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 6 }}>
                  CONFIDENTIAL
                </span>
              )}
            </div>

            {/* Key info bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {formData.shootDate && (
                <div>
                  <p style={{ color: "#71717a", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Date</p>
                  <p style={{ color: "white", fontSize: 13, fontWeight: 600, margin: 0 }}>{fmtDate(formData.shootDate)}</p>
                </div>
              )}
              {formData.callTime && (
                <div>
                  <p style={{ color: "#71717a", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>General Call</p>
                  <p style={{ color: "#d4a853", fontSize: 13, fontWeight: 700, margin: 0 }}>{fmtTime(formData.callTime)}</p>
                </div>
              )}
              {formData.wrapTime && (
                <div>
                  <p style={{ color: "#71717a", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Estimated Wrap</p>
                  <p style={{ color: "white", fontSize: 13, fontWeight: 600, margin: 0 }}>{fmtTime(formData.wrapTime)}</p>
                </div>
              )}
              {primaryLocation && (
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ color: "#71717a", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Location</p>
                  <p style={{ color: "white", fontSize: 13, fontWeight: 600, margin: 0 }}>{primaryLocation.name}</p>
                  {primaryLocation.address && <p style={{ color: "#a1a1aa", fontSize: 11, margin: 0 }}>{primaryLocation.address}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── Body ──────────────────────────────────────────────────────── */}
          <div style={{ padding: "24px 32px" }}>

            {/* Director note */}
            {formData.directorNote && (
              <div style={{ background: "#fafafa", border: "1px solid #e4e4e7", borderLeft: "3px solid #d4a853", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d4a853", marginBottom: 6 }}>Director's Note</p>
                <p style={{ fontSize: 13, color: "#3f3f46", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{formData.directorNote}</p>
              </div>
            )}

            {/* Info pills */}
            {(formData.weather || formData.hospital || formData.emergencyContact || formData.walkieChannels || formData.dresscode) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                {formData.weather && <InfoPill label="Weather" value={formData.weather} />}
                {formData.hospital && <InfoPill label="Nearest Hospital" value={formData.hospital} />}
                {formData.emergencyContact && <InfoPill label="Emergency Contact" value={formData.emergencyContact} />}
                {formData.walkieChannels && <InfoPill label="Walkie Channels" value={formData.walkieChannels} />}
                {formData.dresscode && <InfoPill label="Dress Code" value={formData.dresscode} />}
              </div>
            )}

            {/* Live event times */}
            {sheet?.format === "live_event" && (formData.doorsTime || formData.soundCheckTime || formData.showTime || formData.loadInTime) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                {formData.loadInTime && <InfoPill label="Load In" value={fmtTime(formData.loadInTime)} />}
                {formData.doorsTime && <InfoPill label="Doors" value={fmtTime(formData.doorsTime)} />}
                {formData.soundCheckTime && <InfoPill label="Sound Check" value={fmtTime(formData.soundCheckTime)} />}
                {formData.showTime && <InfoPill label="Show Time" value={fmtTime(formData.showTime)} />}
              </div>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <Section title="Crew">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Name", "Role", "Call Time", "Phone"].map((h) => (
                        <th key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a1a1aa", textAlign: "left", padding: "0 8px 8px 0", borderBottom: "1px solid #e4e4e7" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crew.map((m, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#fafafa" }}>
                        <td style={{ fontSize: 13, fontWeight: 600, color: "#18181b", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{m.name}</td>
                        <td style={{ fontSize: 12, color: "#71717a", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{m.role}</td>
                        <td style={{ fontSize: 13, fontWeight: 700, color: "#d4a853", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5", fontFamily: "monospace" }}>
                          {m.callTime ? fmtTime(m.callTime) : <span style={{ color: "#d4a853", fontWeight: 700 }}>{fmtTime(formData.callTime ?? "")}</span>}
                        </td>
                        <td style={{ fontSize: 12, color: "#71717a", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{m.phone ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Schedule (scripted + interview) */}
            {(sheet?.format === "scripted" || sheet?.format === "interview") && sheet.schedule?.length > 0 && (
              <Section title="Schedule">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sheet.schedule.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: "1px solid #f4f4f5" }}>
                      <div style={{ width: 60, fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#18181b", flexShrink: 0, paddingTop: 1 }}>
                        {fmtTime(item.time)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#18181b", margin: 0 }}>{item.label}</p>
                        {item.location && <p style={{ fontSize: 11, color: "#71717a", margin: "2px 0 0" }}>{item.location}</p>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${SCHEDULE_TYPE_COLOR[item.type] ?? "#9ca3af"}18`, color: SCHEDULE_TYPE_COLOR[item.type] ?? "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}>
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Coverage (live event) */}
            {sheet?.format === "live_event" && sheet.coverage?.length > 0 && (
              <Section title="Camera Coverage">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sheet.coverage.map((c, i) => (
                    <div key={i} style={{ background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 10, padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", margin: 0 }}>{c.person}</p>
                          <p style={{ fontSize: 12, color: "#71717a", margin: "2px 0 0" }}>{c.role}</p>
                        </div>
                        {c.callTime && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#d4a853", fontFamily: "monospace", flexShrink: 0 }}>{fmtTime(c.callTime)}</span>
                        )}
                      </div>
                      {c.equipment && (
                        <p style={{ fontSize: 12, color: "#71717a", margin: "0 0 6px" }}><strong>Equipment:</strong> {c.equipment}</p>
                      )}
                      {c.responsibilities?.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {c.responsibilities.map((r, j) => (
                            <li key={j} style={{ fontSize: 12, color: "#52525b", margin: "2px 0" }}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Run of show */}
            {sheet?.format === "live_event" && sheet.runOfShow?.length > 0 && (
              <Section title="Run of Show">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Set Time", "Artist / Act", "Duration", "Stage", "Notes"].map((h) => (
                        <th key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a1a1aa", textAlign: "left", padding: "0 8px 8px 0", borderBottom: "1px solid #e4e4e7" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.runOfShow.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "#18181b", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5", whiteSpace: "nowrap" }}>{fmtTime(r.setTime)}{r.endTime ? `–${fmtTime(r.endTime)}` : ""}</td>
                        <td style={{ fontSize: 13, fontWeight: 600, color: "#18181b", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{r.artist}</td>
                        <td style={{ fontSize: 12, color: "#71717a", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5", whiteSpace: "nowrap" }}>{r.duration}</td>
                        <td style={{ fontSize: 12, color: "#71717a", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{r.stage}</td>
                        <td style={{ fontSize: 12, color: "#71717a", padding: "8px 8px 8px 0", borderBottom: "1px solid #f4f4f5" }}>{r.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {/* Key moments */}
            {sheet?.format === "live_event" && sheet.keyMoments?.length > 0 && (
              <Section title="Key Moments">
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sheet.keyMoments.map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid #f4f4f5" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.type === "pre" ? "#60a5fa" : m.type === "during" ? "#d4a853" : m.type === "post" ? "#34d399" : "#a78bfa", display: "inline-block", flexShrink: 0, marginTop: 4 }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#18181b", margin: 0 }}>{m.label}</p>
                        <p style={{ fontSize: 12, color: "#71717a", margin: "2px 0 0" }}>{m.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* All locations */}
            {locations.length > 0 && (
              <Section title="Locations">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {locations.map((loc, i) => (
                    <div key={i} style={{ padding: "10px 14px", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#18181b", margin: 0 }}>{loc.name}</p>
                      {loc.address && <p style={{ fontSize: 12, color: "#71717a", margin: "3px 0 0" }}>{loc.address}</p>}
                      {loc.parkingNotes && <p style={{ fontSize: 12, color: "#52525b", margin: "4px 0 0" }}><strong>Parking:</strong> {loc.parkingNotes}</p>}
                      {loc.notes && <p style={{ fontSize: 12, color: "#52525b", margin: "4px 0 0" }}>{loc.notes}</p>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

          </div>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div style={{ background: "#fafafa", borderTop: "1px solid #f4f4f5", padding: "12px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 11, color: "#a1a1aa", margin: 0 }}>
              Shared via <strong>CineFlow</strong>
            </p>
            <div className="no-print"><PrintButton /></div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid #e4e4e7" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, padding: "6px 12px" }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a1a1aa", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 12, color: "#18181b", margin: 0, fontWeight: 500 }}>{value}</p>
    </div>
  );
}
