import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ─── Types (mirrored from CallSheetGenerator) ──────────────────────────────

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
export interface CSSheet {
  schedule: CSScheduleItem[];
  warning: string | null;
}
export interface CSFormData {
  shootDate: string;
  callTime: string;
  wrapTime: string;
  hospital: string;
  weather: string;
  confidential: boolean;
  directorNote: string;
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
}

// ─── Constants ─────────────────────────────────────────────────────────────

const GOLD  = "#d4a853";
const BLACK = "#111111";
const GRAY  = "#6b7280";
const LGRAY = "#9ca3af";
const BORDER = "#e5e7eb";
const FBORDER = "#f3f4f6";
const WHITE = "#ffffff";
const FAINT = "#f9fafb";

const DEPT_ORDER = [
  "Production", "Direction", "Camera", "Lighting", "Grip", "Sound",
  "Art", "Wardrobe", "Hair & Makeup", "Talent", "Other",
];

const ROW_BG: Record<CSScheduleItem["type"], string> = {
  logistics: "#fffbeb",
  setup:     "#eff6ff",
  shoot:     WHITE,
  break:     "#f5f3ff",
  move:      "#fff7ed",
  wrap:      FAINT,
};
const ROW_DOT: Record<CSScheduleItem["type"], string> = {
  logistics: GOLD,
  setup:     "#60a5fa",
  shoot:     "#34d399",
  break:     "#a78bfa",
  move:      "#fb923c",
  wrap:      LGRAY,
};
const TYPE_LABEL: Record<CSScheduleItem["type"], string> = {
  logistics: "LOGISTICS",
  setup:     "SETUP",
  shoot:     "SHOOT",
  break:     "BREAK",
  move:      "MOVE",
  wrap:      "WRAP",
};

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

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: WHITE,
    paddingHorizontal: 32,
    paddingVertical: 28,
    fontSize: 9,
    color: BLACK,
  },

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
  confidentialBadge: { borderWidth: 1.5, borderColor: BLACK, paddingHorizontal: 5, paddingVertical: 2, fontSize: 6, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
  genBy: { fontSize: 6, color: LGRAY, marginTop: 3 },

  // Call time bar
  callBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: BLACK, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 },
  callBarLabel: { fontSize: 6, fontFamily: "Helvetica-Bold", letterSpacing: 2, textTransform: "uppercase", color: LGRAY, marginBottom: 2 },
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
  sectionTitle: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 2, color: BLACK },
  sectionLine: { flex: 1, height: 1, backgroundColor: BORDER, marginLeft: 6 },

  // Crew
  crewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  crewCard: { width: "48.5%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, overflow: "hidden" },
  crewDeptHeader: { backgroundColor: FAINT, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8, paddingVertical: 4 },
  crewDeptLabel: { fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#374151" },
  crewRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: FBORDER, paddingHorizontal: 8, paddingVertical: 4 },
  crewName: { fontSize: 8, fontFamily: "Helvetica-Bold", flex: 1 },
  crewRole: { fontSize: 7, color: GRAY, flex: 1 },
  crewPhone: { fontSize: 6, color: LGRAY, width: 70 },
  crewCall: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 38, textAlign: "right" },

  // Locations
  locGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  locCard: { width: "48.5%", borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8 },
  locNameRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  locBubble: { width: 14, height: 14, backgroundColor: BLACK, borderRadius: 7, alignItems: "center", justifyContent: "center", marginRight: 5 },
  locBubbleText: { fontSize: 6, fontFamily: "Helvetica-Bold", color: WHITE },
  locName: { fontSize: 9, fontFamily: "Helvetica-Bold", flex: 1 },
  locDetail: { fontSize: 7, color: "#374151", marginBottom: 1, marginLeft: 19 },
  locMuted: { fontSize: 7, color: GRAY, marginBottom: 1, marginLeft: 19 },

  // Legend
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendLabel: { fontSize: 6, color: GRAY },

  // Schedule
  schedTable: { marginBottom: 14 },
  schedHead: { flexDirection: "row", backgroundColor: BLACK, paddingHorizontal: 8, paddingVertical: 5 },
  schedHeadCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: WHITE },
  schedRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 8, paddingVertical: 4 },
  schedTime: { width: 52, flexDirection: "row", alignItems: "center", gap: 4 },
  schedDot: { width: 6, height: 6, borderRadius: 3 },
  schedTimeText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  schedDesc: { flex: 1, fontSize: 8, paddingRight: 8 },
  schedLoc: { width: 110, fontSize: 7, color: GRAY },

  // Director note
  noteBox: { borderWidth: 1, borderColor: BORDER, borderLeftWidth: 3, borderLeftColor: BLACK, borderRadius: 3, padding: 8, marginBottom: 12 },
  noteLabel: { fontSize: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 2, color: LGRAY, marginBottom: 4 },
  noteText: { fontSize: 8, lineHeight: 1.7, fontFamily: "Helvetica-Oblique" },

  // Footer
  footer: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 5, fontSize: 6, color: LGRAY, textAlign: "center" },
});

// ─── Sub-components ────────────────────────────────────────────────────────

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

// ─── Main Document ─────────────────────────────────────────────────────────

export function CallSheetPDFDocument({
  project,
  profile,
  formData,
  crew,
  locations,
  sheet,
}: {
  project: CSProject;
  profile: CSProfile | null;
  formData: CSFormData;
  crew: CSCrewMember[];
  locations: CSLocation[];
  sheet: CSSheet;
}) {
  const deptMap = groupByDept(crew);
  const producerName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <Document title={`Call Sheet — ${project.title}`} author="Cineflow">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            {profile?.logo_url && (
              <Image src={profile.logo_url} style={s.logo} />
            )}
            <Text style={s.bizName}>{profile?.business_name || "Production Company"}</Text>
            {producerName ? <Text style={s.producerName}>{producerName}</Text> : null}
          </View>

          <View style={s.headerCenter}>
            <Text style={s.projectTitle}>{project.title}</Text>
            {project.client_name ? <Text style={s.clientLine}>Client: {project.client_name}</Text> : null}
            <Text style={s.callSheetLabel}>CALL SHEET — {fmtDate(formData.shootDate)}</Text>
          </View>

          <View style={s.headerRight}>
            {formData.confidential && (
              <Text style={s.confidentialBadge}>CONFIDENTIAL</Text>
            )}
            <Text style={s.genBy}>Generated by Cineflow</Text>
          </View>
        </View>

        {/* ── General call time bar ── */}
        <View style={s.callBar}>
          <View>
            <Text style={s.callBarLabel}>General Crew Call</Text>
            <Text style={s.callTime}>{formData.callTime || "TBD"}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={s.callBarLabel}>Wrap</Text>
            <Text style={s.wrapTime}>{formData.wrapTime || "TBD"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.callBarLabel}>Weather</Text>
            <Text style={s.callBarSmall}>{formData.weather || "—"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.callBarLabel}>Nearest Hospital</Text>
            <Text style={s.callBarSmall}>{formData.hospital || "See location contact"}</Text>
          </View>
        </View>

        {/* ── Warning ── */}
        {sheet.warning ? (
          <View style={s.warningBox}>
            <Text style={s.warningText}>
              <Text style={s.warningLabel}>⚠ NOTE: </Text>
              {sheet.warning}
            </Text>
          </View>
        ) : null}

        {/* ── Crew Call Times ── */}
        {crew.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <SectionHeader>Crew Call Times</SectionHeader>
            <View style={s.crewGrid}>
              {Array.from(deptMap.entries()).map(([dept, members]) => (
                <View key={dept} style={s.crewCard}>
                  <View style={s.crewDeptHeader}>
                    <Text style={s.crewDeptLabel}>{dept}</Text>
                  </View>
                  {members.map((m) => (
                    <View key={m.id} style={s.crewRow}>
                      <Text style={s.crewName}>{m.name}</Text>
                      <Text style={s.crewRole}>{m.role}</Text>
                      {m.phone ? <Text style={s.crewPhone}>{m.phone}</Text> : <Text style={s.crewPhone} />}
                      <Text style={s.crewCall}>{m.callTime || formData.callTime || "—"}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Locations ── */}
        {locations.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <SectionHeader>Locations</SectionHeader>
            <View style={s.locGrid}>
              {locations.map((loc, i) => (
                <View key={loc.id} style={s.locCard}>
                  <View style={s.locNameRow}>
                    <View style={s.locBubble}>
                      <Text style={s.locBubbleText}>{i + 1}</Text>
                    </View>
                    <Text style={s.locName}>{loc.name}</Text>
                  </View>
                  {loc.address ? <Text style={s.locDetail}>{loc.address}</Text> : null}
                  {loc.parkingNotes ? <Text style={s.locMuted}>Parking: {loc.parkingNotes}</Text> : null}
                  {loc.contact_name ? (
                    <Text style={s.locMuted}>
                      Contact: {loc.contact_name}{loc.contact_phone ? ` · ${loc.contact_phone}` : ""}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Shooting Schedule ── */}
        <View style={s.schedTable}>
          <SectionHeader>Shooting Schedule</SectionHeader>
          <Legend />
          <View>
            <View style={s.schedHead}>
              <Text style={[s.schedHeadCell, { width: 52 }]}>Time</Text>
              <Text style={[s.schedHeadCell, { flex: 1 }]}>Description</Text>
              <Text style={[s.schedHeadCell, { width: 110 }]}>Location</Text>
            </View>
            {sheet.schedule.map((item, i) => (
              <View key={i} style={[s.schedRow, { backgroundColor: ROW_BG[item.type] ?? WHITE }]}>
                <View style={s.schedTime}>
                  <View style={[s.schedDot, { backgroundColor: ROW_DOT[item.type] ?? LGRAY }]} />
                  <Text style={s.schedTimeText}>{item.time}</Text>
                </View>
                <Text style={s.schedDesc}>{item.label}</Text>
                <Text style={s.schedLoc}>{item.location || "—"}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Director's Note ── */}
        {formData.directorNote ? (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>Director's Note</Text>
            <Text style={s.noteText}>{formData.directorNote}</Text>
          </View>
        ) : null}

        {/* ── Footer ── */}
        <Text style={s.footer}>
          Generated with Cineflow · {new Date().toLocaleDateString()}
          {formData.confidential ? " · CONFIDENTIAL — Do not distribute" : ""}
        </Text>
      </Page>
    </Document>
  );
}
