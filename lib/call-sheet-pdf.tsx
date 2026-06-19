import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CSCrewMember {
  id: string;
  name: string;
  role: string;
  department?: string | null;
  phone?: string | null;
  callTime: string;
}
export interface CSLocation {
  id: string;
  name: string;
  address?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  parkingNotes: string;
}
export interface CSScheduleItem {
  time: string;
  label: string;
  location: string | null;
  type: "logistics" | "setup" | "shoot" | "break" | "move" | "wrap";
}
export interface CSCoverageAssignment {
  person: string;
  role: string;
  equipment: string;
  responsibilities: string[];
  callTime?: string;
}
export interface CSStaticCamera {
  name: string;
  role: string;
}
export interface CSKeyMoment {
  label: string;
  description: string;
  type: "pre" | "during" | "post" | "logistics";
}
export interface CSRunOfShowItem {
  setTime: string;
  endTime?: string;
  artist: string;
  duration: string;
  stage: string;
  notes: string;
}

export type CSSheet =
  | { format: "scripted" | "interview"; schedule: CSScheduleItem[]; warning: string | null }
  | { format: "live_event"; coverage: CSCoverageAssignment[]; staticCameras: CSStaticCamera[]; keyMoments: CSKeyMoment[]; runOfShow?: CSRunOfShowItem[]; warning: string | null };

export interface CSFormData {
  format?: string;
  shootDate: string;
  callTime: string;
  wrapTime: string;
  hospital: string;
  weather: string;
  confidential: boolean;
  directorNote: string;
  emergencyContact?: string;
  walkieChannels?: string;
  doorsTime?: string;
  soundCheckTime?: string;
  showTime?: string;
  loadInTime?: string;
  shootDay?: string;
  scriptRevision?: string;
  interviewSubjects?: string;
  dresscode?: string;
}
export interface CSProfile {
  first_name?: string;
  last_name?: string;
  business_name?: string;
  logo_url?: string;
}
export interface CSProject {
  title: string;
  client_name?: string | null;
  client_logo_url?: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const GOLD   = "#d4a853";
const BLACK  = "#111111";
const GRAY   = "#6b7280";
const LGRAY  = "#9ca3af";
const BORDER = "#e5e7eb";
const FBORDER = "#f3f4f6";
const WHITE  = "#ffffff";
const FAINT  = "#f9fafb";

const DEPT_ORDER = [
  "Production", "Direction", "Camera", "Lighting", "Grip", "Sound",
  "Art", "Wardrobe", "Hair & Makeup", "Talent", "Other",
];

const ROW_BG: Record<CSScheduleItem["type"], string> = {
  logistics: "#fffbeb", setup: "#eff6ff", shoot: WHITE,
  break: "#f5f3ff", move: "#fff7ed", wrap: FAINT,
};
const ROW_DOT: Record<CSScheduleItem["type"], string> = {
  logistics: GOLD, setup: "#60a5fa", shoot: "#34d399",
  break: "#a78bfa", move: "#fb923c", wrap: LGRAY,
};
const TYPE_LABEL: Record<CSScheduleItem["type"], string> = {
  logistics: "LOGISTICS", setup: "SETUP", shoot: "SHOOT",
  break: "BREAK", move: "MOVE", wrap: "WRAP",
};

const MOMENT_DOT: Record<CSKeyMoment["type"], string> = {
  pre: "#60a5fa", during: "#34d399", post: "#a78bfa", logistics: GOLD,
};

function to12h(t: string): string {
  if (!t || !t.includes(":")) return t || "TBD";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function groupByDept(crew: CSCrewMember[]) {
  const map = new Map<string, CSCrewMember[]>();
  for (const m of crew) {
    const dept = m.department || "Other";
    if (!map.has(dept)) map.set(dept, []);
    map.get(dept)!.push(m);
  }
  const sorted = new Map<string, CSCrewMember[]>();
  for (const d of DEPT_ORDER) if (map.has(d)) sorted.set(d, map.get(d)!);
  for (const [d, v] of map) if (!sorted.has(d)) sorted.set(d, v);
  return sorted;
}

function fmtDate(iso: string) {
  if (!iso) return "Date TBD";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: WHITE, paddingHorizontal: 32, paddingVertical: 28, fontSize: 10, color: BLACK },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 10, marginBottom: 12, borderBottomWidth: 2.5, borderBottomColor: BLACK },
  headerLeft: { width: 110 },
  headerCenter: { flex: 1, paddingHorizontal: 16, alignItems: "center" },
  headerRight: { width: 110, alignItems: "flex-end" },
  logo: { height: 30, objectFit: "contain", marginBottom: 3 },
  bizName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK },
  producerName: { fontSize: 7, color: GRAY, marginTop: 1 },
  projectTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  clientLine: { fontSize: 7, color: GRAY, marginTop: 2 },
  callSheetLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", marginTop: 2 },
  confidentialBadge: { borderWidth: 1.5, borderColor: BLACK, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  genBy: { fontSize: 7, color: LGRAY, marginTop: 3 },
  clientLogo: { height: 28, maxWidth: 100, objectFit: "contain", marginBottom: 5 },

  // Call time bar
  callBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: BLACK, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 },
  callBarLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 2, textTransform: "uppercase", color: LGRAY, marginBottom: 2 },
  callTime: { fontSize: 24, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 1 },
  wrapTime: { fontSize: 16, fontFamily: "Helvetica-Bold", color: WHITE },
  callBarSmall: { fontSize: 9, fontFamily: "Helvetica-Bold", color: WHITE },

  // Warning
  warningBox: { flexDirection: "row", borderWidth: 1, borderColor: "#fbbf24", backgroundColor: "#fffbeb", borderRadius: 3, padding: 7, marginBottom: 10 },
  warningText: { fontSize: 8, color: "#92400e", flex: 1 },
  warningLabel: { fontFamily: "Helvetica-Bold", marginRight: 4 },

  // Section header
  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  sectionBar: { width: 3, height: 11, backgroundColor: BLACK, borderRadius: 1, marginRight: 6 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 2, color: BLACK },
  sectionLine: { flex: 1, height: 1, backgroundColor: BORDER, marginLeft: 6 },

  // Crew call times
  crewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  crewCard: { width: "48.5%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" },
  crewDeptHeader: { backgroundColor: FAINT, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8, paddingVertical: 4 },
  crewDeptLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151" },
  crewRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 4 },
  crewName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  crewRole: { fontSize: 8, color: GRAY, flex: 1 },
  crewPhone: { fontSize: 7, color: LGRAY, width: 70 },
  crewCall: { fontSize: 9, fontFamily: "Helvetica-Bold", width: 38, textAlign: "right" },

  // Crew contact table (live event)
  crewTableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 4 },
  crewTableName: { fontSize: 9, fontFamily: "Helvetica-Bold", width: "22%" },
  crewTableRole: { fontSize: 8, color: GRAY, width: "30%" },
  crewTablePhone: { fontSize: 8, color: LGRAY, flex: 1 },
  crewTableCall: { fontSize: 9, fontFamily: "Helvetica-Bold", width: 55, textAlign: "right" },

  // Locations
  locGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  locCard: { width: "48.5%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8 },
  locNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  locBubble: { width: 14, height: 14, backgroundColor: BLACK, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 5 },
  locBubbleText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE },
  locName: { fontSize: 10, fontFamily: "Helvetica-Bold", flex: 1 },
  locDetail: { fontSize: 8, color: "#374151", marginBottom: 1, marginLeft: 19 },
  locMuted: { fontSize: 8, color: GRAY, marginBottom: 1, marginLeft: 19 },

  // Legend
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 7, color: GRAY },

  // Scripted schedule
  schedTable: { marginBottom: 14 },
  schedHead: { flexDirection: "row", backgroundColor: BLACK, paddingHorizontal: 8, paddingVertical: 5 },
  schedHeadCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE },
  schedRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8, paddingVertical: 4 },
  schedTime: { width: 52, flexDirection: "row", alignItems: "center", gap: 4 },
  schedDot: { width: 6, height: 6, borderRadius: 3 },
  schedTimeText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  schedDesc: { flex: 1, fontSize: 9, paddingRight: 8 },
  schedLoc: { width: 110, fontSize: 8, color: GRAY },

  // Coverage (live event)
  covGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  covCard: { width: "48.5%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" },
  covHeader: { backgroundColor: BLACK, paddingHorizontal: 9, paddingVertical: 7 },
  covPerson: { fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE },
  covRole: { fontSize: 8, color: LGRAY, marginTop: 2 },
  covEquip: { fontSize: 8, color: GOLD, marginTop: 2 },
  covBody: { padding: 9 },
  covBullet: { flexDirection: "row", marginBottom: 4, gap: 5 },
  covDot: { fontSize: 9, color: GRAY, marginTop: 0 },
  covText: { fontSize: 8, color: "#374151", flex: 1, lineHeight: 1.5 },

  // Static cameras
  staticTable: { marginBottom: 14 },
  staticRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 5 },
  staticName: { fontSize: 9, fontFamily: "Helvetica-Bold", width: "30%" },
  staticRole: { fontSize: 8, color: GRAY, width: "70%", lineHeight: 1.4 },

  // Key moments
  momTable: { marginBottom: 14 },
  momRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 6 },
  momDotWrap: { flexDirection: "row", alignItems: "flex-start", gap: 5, width: "44%" },
  momDot: { width: 6, height: 6, borderRadius: 3, marginTop: 1.5, flexShrink: 0 },
  momLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1, lineHeight: 1.4 },
  momDesc: { fontSize: 8, color: "#374151", width: "56%", lineHeight: 1.5 },

  // Run of Show
  rosTable: { marginBottom: 14 },
  rosHeadRow: { flexDirection: "row", backgroundColor: BLACK, paddingHorizontal: 8, paddingVertical: 5 },
  rosHeadCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE, textTransform: "uppercase", letterSpacing: 1.2 },
  rosRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 5 },
  rosTime: { fontSize: 9, fontFamily: "Helvetica-Bold", width: 120, color: BLACK },
  rosArtist: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  rosStage: { fontSize: 8, color: GRAY, width: 60 },
  rosNotes: { fontSize: 7, color: LGRAY, width: 80 },

  // Director note
  noteBox: { borderWidth: 1, borderColor: BORDER, borderLeftWidth: 3, borderLeftColor: BLACK, borderRadius: 3, padding: 8, marginBottom: 12 },
  noteLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 2, color: LGRAY, marginBottom: 4 },
  noteText: { fontSize: 8, lineHeight: 1.7, fontFamily: "Helvetica-Oblique" },

  // Footer
  footer: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5, fontSize: 7, color: LGRAY, textAlign: "center" },
});

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle}>{children}</Text>
      <View style={s.sectionLine} />
    </View>
  );
}

function Legend() {
  return (
    <View style={s.legendRow}>
      {(Object.entries(ROW_DOT) as [CSScheduleItem["type"], string][]).map(([type, color]) => (
        <View key={type} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: color }]} />
          <Text style={s.legendLabel}>{TYPE_LABEL[type]}</Text>
        </View>
      ))}
    </View>
  );
}

function PageHeader({ project, profile, formData }: { project: CSProject; profile: CSProfile | null; formData: CSFormData }) {
  const producerName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : "";
  return (
    <>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          {profile?.logo_url && <Image src={profile.logo_url} style={s.logo} />}
          <Text style={s.bizName}>{profile?.business_name || "Production Company"}</Text>
          {producerName ? <Text style={s.producerName}>{producerName}</Text> : null}
        </View>
        <View style={s.headerCenter}>
          <Text style={s.projectTitle}>{project.title}</Text>
          {project.client_name ? <Text style={s.clientLine}>Client: {project.client_name}</Text> : null}
          <Text style={s.callSheetLabel}>CALL SHEET — {fmtDate(formData.shootDate)}</Text>
        </View>
        <View style={s.headerRight}>
          {project.client_logo_url && <Image src={project.client_logo_url} style={s.clientLogo} />}
          {formData.confidential && <Text style={s.confidentialBadge}>CONFIDENTIAL</Text>}
          <Text style={s.genBy}>Generated by Cineflow</Text>
        </View>
      </View>

      {/* Call bar — large crew call left, compact times right */}
      <View style={[s.callBar, { marginBottom: 6, alignItems: "stretch" }]}>
        <View style={{ paddingRight: 14, borderRightWidth: 1, borderRightColor: "#333", marginRight: 4 }}>
          <Text style={s.callBarLabel}>General Crew Call</Text>
          <Text style={s.callTime}>{to12h(formData.callTime)}</Text>
        </View>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {formData.format === "live_event" ? (<>
            {formData.loadInTime ? <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Load-In</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.loadInTime)}</Text>
            </View> : null}
            {formData.soundCheckTime ? <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Sound Check</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.soundCheckTime)}</Text>
            </View> : null}
            {formData.doorsTime ? <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Doors Open</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.doorsTime)}</Text>
            </View> : null}
            {formData.showTime ? <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Show Start</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.showTime)}</Text>
            </View> : null}
            <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Wrap</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.wrapTime)}</Text>
            </View>
          </>) : (<>
            {(formData.shootDay || formData.scriptRevision) ? <View style={{ alignItems: "center" }}>
              {formData.shootDay ? <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: WHITE }}>{formData.shootDay}</Text> : null}
              {formData.scriptRevision ? <Text style={{ fontSize: 7, color: LGRAY, marginTop: 2 }}>{formData.scriptRevision}</Text> : null}
            </View> : null}
            <View style={{ alignItems: "center" }}>
              <Text style={s.callBarLabel}>Wrap</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: WHITE }}>{to12h(formData.wrapTime)}</Text>
            </View>
          </>)}
        </View>
      </View>

      {/* Supplemental strip — key contact, weather, hospital, walkie, subjects */}
      {(formData.emergencyContact || formData.weather || formData.hospital || formData.walkieChannels || formData.dresscode || formData.interviewSubjects) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, backgroundColor: FAINT, borderWidth: 1, borderColor: BORDER, borderRadius: 3, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 }}>
          {formData.emergencyContact ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Key Contact: </Text>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: BLACK }}>{formData.emergencyContact}</Text>
            </View>
          ) : null}
          {formData.weather ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Weather: </Text>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: BLACK }}>{formData.weather}</Text>
            </View>
          ) : null}
          {formData.hospital ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Hospital: </Text>
              <Text style={{ fontSize: 7, color: BLACK }}>{formData.hospital}</Text>
            </View>
          ) : null}
          {formData.walkieChannels ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Walkie: </Text>
              <Text style={{ fontSize: 7, color: BLACK }}>{formData.walkieChannels}</Text>
            </View>
          ) : null}
          {formData.dresscode ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Attire: </Text>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: BLACK }}>{formData.dresscode}</Text>
            </View>
          ) : null}
          {formData.interviewSubjects ? (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: GRAY }}>Subject(s): </Text>
              <Text style={{ fontSize: 7, color: BLACK }}>{formData.interviewSubjects}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function LocationsSection({ locations }: { locations: CSLocation[] }) {
  if (locations.length === 0) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <SectionHeader>Locations</SectionHeader>
      <View style={s.locGrid}>
        {locations.map((loc, i) => (
          <View key={loc.id} style={s.locCard}>
            <View style={s.locNameRow}>
              <View style={s.locBubble}><Text style={s.locBubbleText}>{i + 1}</Text></View>
              <Text style={s.locName}>{loc.name}</Text>
            </View>
            {loc.address ? <Text style={s.locDetail}>{loc.address}</Text> : null}
            {loc.parkingNotes ? <Text style={s.locMuted}>Parking: {loc.parkingNotes}</Text> : null}
            {loc.contact_name ? (
              <Text style={s.locMuted}>Contact: {loc.contact_name}{loc.contact_phone ? ` · ${loc.contact_phone}` : ""}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Document ───────────────────────────────────────────────────────────

export function CallSheetPDFDocument({
  project, profile, formData, crew, locations, sheet,
}: {
  project: CSProject;
  profile: CSProfile | null;
  formData: CSFormData;
  crew: CSCrewMember[];
  locations: CSLocation[];
  sheet: CSSheet;
}) {
  if (sheet.format === "live_event") {
    return (
      <Document title={`Call Sheet — ${project.title}`} author="Cineflow">
        <Page size="A4" style={s.page}>
          <PageHeader project={project} profile={profile} formData={formData} />

          {sheet.warning ? (
            <View style={s.warningBox}>
              <Text style={s.warningText}><Text style={s.warningLabel}>⚠ NOTE: </Text>{sheet.warning}</Text>
            </View>
          ) : null}

          <LocationsSection locations={locations} />

          {/* Crew Call Times — near top so crew finds their time immediately */}
          {crew.length > 0 && (
            <View style={{ marginBottom: 14 }} wrap={false}>
              <SectionHeader>Crew Call Times</SectionHeader>
              <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", backgroundColor: FAINT, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", width: "25%" }}>Name</Text>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", flex: 1 }}>Role</Text>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", width: "25%" }}>Phone</Text>
                  <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151", width: 52, textAlign: "right" }}>Call Time</Text>
                </View>
                {crew.map((m, i) => (
                  <View key={m.id} style={[s.crewTableRow, { backgroundColor: i % 2 === 0 ? WHITE : FAINT }]} wrap={false}>
                    <Text style={[s.crewTableName, { width: "25%" }]}>{m.name}</Text>
                    <Text style={[s.crewTableRole, { flex: 1 }]}>{m.role}</Text>
                    <Text style={[s.crewTablePhone, { width: "25%" }]}>{m.phone || "—"}</Text>
                    <Text style={[s.crewTableCall, { width: 52 }]}>{to12h(m.callTime || formData.callTime)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Run of Show */}
          {(sheet.runOfShow ?? []).length > 0 && (
            <View style={s.rosTable} wrap={false}>
              <SectionHeader>Run of Show</SectionHeader>
              <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" }}>
                <View style={s.rosHeadRow}>
                  <Text style={[s.rosHeadCell, { width: 120 }]}>Time</Text>
                  <Text style={[s.rosHeadCell, { flex: 1 }]}>Artist / Act</Text>
                  <Text style={[s.rosHeadCell, { width: 60 }]}>Stage</Text>
                  <Text style={[s.rosHeadCell, { width: 80 }]}>Notes</Text>
                </View>
                {(sheet.runOfShow ?? []).map((item, i) => (
                  <View key={i} style={[s.rosRow, { backgroundColor: i % 2 === 0 ? WHITE : FAINT }]} wrap={false}>
                    <Text style={s.rosTime}>
                      {to12h(item.setTime)}{item.endTime ? ` – ${to12h(item.endTime)}` : ""}
                    </Text>
                    <Text style={s.rosArtist}>{item.artist}</Text>
                    <Text style={s.rosStage}>{item.stage || "—"}</Text>
                    <Text style={s.rosNotes}>{item.notes || ""}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Coverage Assignments — call time shown in each card header */}
          {(sheet.coverage ?? []).length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <SectionHeader>Coverage Assignments</SectionHeader>
              <View style={s.covGrid}>
                {(sheet.coverage ?? []).map((c, i) => {
                  const person = c.person ?? "";
                  const member = crew.find((m) => (m.name ?? "").toLowerCase() === person.toLowerCase());
                  const callTime = to12h(c.callTime || member?.callTime || formData.callTime);
                  return (
                    <View key={i} style={s.covCard} wrap={false}>
                      <View style={[s.covHeader, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.covPerson}>{person}</Text>
                          <Text style={s.covRole}>{c.role ?? ""}</Text>
                          {c.equipment ? <Text style={s.covEquip}>{c.equipment}</Text> : null}
                        </View>
                        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, textTransform: "uppercase", color: LGRAY, marginBottom: 2 }}>CALL</Text>
                          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: WHITE }}>{callTime}</Text>
                        </View>
                      </View>
                      <View style={s.covBody}>
                        {(c.responsibilities ?? []).map((r, j) => (
                          <View key={j} style={s.covBullet}>
                            <Text style={s.covDot}>•</Text>
                            <Text style={s.covText}>{r ?? ""}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Static Cameras */}
          {(sheet.staticCameras ?? []).length > 0 && (
            <View style={s.staticTable} wrap={false}>
              <SectionHeader>Static / Mounted Cameras</SectionHeader>
              <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" }}>
                {(sheet.staticCameras ?? []).map((cam, i) => (
                  <View key={i} style={[s.staticRow, { backgroundColor: i % 2 === 0 ? FAINT : WHITE }]} wrap={false}>
                    <Text style={s.staticName}>{cam.name}</Text>
                    <Text style={s.staticRole}>{cam.role}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Key Moments */}
          {(sheet.keyMoments ?? []).length > 0 && (
            <View style={s.momTable}>
              <SectionHeader>Key Moments</SectionHeader>
              {/* Legend */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 5 }}>
                {([ ["pre", "Pre-Show"], ["during", "During"], ["post", "Post-Show"], ["logistics", "Logistics"] ] as const).map(([type, label]) => (
                  <View key={type} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: MOMENT_DOT[type] }} />
                    <Text style={{ fontSize: 7, color: GRAY }}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" }}>
                {(sheet.keyMoments ?? []).map((m, i) => (
                  <View key={i} style={[s.momRow, { backgroundColor: WHITE }]} wrap={false}>
                    <View style={s.momDotWrap}>
                      <View style={[s.momDot, { backgroundColor: MOMENT_DOT[m.type] ?? LGRAY }]} />
                      <Text style={s.momLabel}>{m.label}</Text>
                    </View>
                    <Text style={s.momDesc}>{m.description}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {formData.directorNote ? (
            <View style={s.noteBox}>
              <Text style={s.noteLabel}>Director's Note</Text>
              <Text style={s.noteText}>{formData.directorNote}</Text>
            </View>
          ) : null}

          <Text style={s.footer}>
            Generated with Cineflow · {new Date().toLocaleDateString()}
            {formData.confidential ? " · CONFIDENTIAL — Do not distribute" : ""}
          </Text>
        </Page>
      </Document>
    );
  }

  // Scripted / Interview layout
  const deptMap = groupByDept(crew);

  return (
    <Document title={`Call Sheet — ${project.title}`} author="Cineflow">
      <Page size="A4" style={s.page}>
        <PageHeader project={project} profile={profile} formData={formData} />

        {sheet.warning ? (
          <View style={s.warningBox}>
            <Text style={s.warningText}><Text style={s.warningLabel}>⚠ NOTE: </Text>{sheet.warning}</Text>
          </View>
        ) : null}

        {crew.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <SectionHeader>Crew Call Times</SectionHeader>
            <View style={s.crewGrid}>
              {Array.from(deptMap.entries()).map(([dept, members]) => (
                <View key={dept} style={s.crewCard} wrap={false}>
                  <View style={s.crewDeptHeader}>
                    <Text style={s.crewDeptLabel}>{dept}</Text>
                  </View>
                  {members.map((m) => (
                    <View key={m.id} style={s.crewRow}>
                      <Text style={s.crewName}>{m.name}</Text>
                      <Text style={s.crewRole}>{m.role}</Text>
                      {m.phone ? <Text style={s.crewPhone}>{m.phone}</Text> : <Text style={s.crewPhone} />}
                      <Text style={s.crewCall}>{to12h(m.callTime || formData.callTime)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        <LocationsSection locations={locations} />

        <View style={s.schedTable}>
          <SectionHeader>Shooting Schedule</SectionHeader>
          <Legend />
          <View>
            <View style={s.schedHead} fixed>
              <Text style={[s.schedHeadCell, { width: 52 }]}>Time</Text>
              <Text style={[s.schedHeadCell, { flex: 1 }]}>Description</Text>
              <Text style={[s.schedHeadCell, { width: 110 }]}>Location</Text>
            </View>
            {(sheet.schedule ?? []).map((item, i) => (
              <View key={i} style={[s.schedRow, { backgroundColor: ROW_BG[item.type] ?? WHITE }]} wrap={false}>
                <View style={s.schedTime}>
                  <View style={[s.schedDot, { backgroundColor: ROW_DOT[item.type] ?? LGRAY }]} />
                  <Text style={s.schedTimeText}>{to12h(item.time)}</Text>
                </View>
                <Text style={s.schedDesc}>{item.label}</Text>
                <Text style={s.schedLoc}>{item.location || "—"}</Text>
              </View>
            ))}
          </View>
        </View>

        {formData.directorNote ? (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>Director's Note</Text>
            <Text style={s.noteText}>{formData.directorNote}</Text>
          </View>
        ) : null}

        <Text style={s.footer}>
          Generated with Cineflow · {new Date().toLocaleDateString()}
          {formData.confidential ? " · CONFIDENTIAL — Do not distribute" : ""}
        </Text>
      </Page>
    </Document>
  );
}
