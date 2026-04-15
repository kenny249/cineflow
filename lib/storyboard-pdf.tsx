import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { StoryboardFrame } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PdfTheme = "dark" | "light";
export type PdfFont =
  | "inter"
  | "montserrat"
  | "playfair"
  | "bebas"
  | "oswald"
  | "dm_sans";
export type PdfLayout = "1up" | "2up" | "3up";

export interface PdfSections {
  coverPage: boolean;
  frameImages: boolean;
  shotDetails: boolean;
  directorNotes: boolean;
  mood: boolean;
  frameNumbers: boolean;
}

export interface PdfBranding {
  agencyName: string;
  tagline: string;
  accentColor: string;
  showPoweredBy: boolean;
  logoUrl?: string;
}

export interface StoryboardPdfSettings {
  theme: PdfTheme;
  font: PdfFont;
  layout: PdfLayout;
  sections: PdfSections;
  branding: PdfBranding;
}

// ─── Font Registration ────────────────────────────────────────────────────────

const CDN = "https://cdn.jsdelivr.net/npm/@fontsource";

const FONT_URLS: Record<PdfFont, { regular: string; bold?: string }> = {
  inter: {
    regular: `${CDN}/inter@5/files/inter-latin-400-normal.woff`,
    bold: `${CDN}/inter@5/files/inter-latin-700-normal.woff`,
  },
  montserrat: {
    regular: `${CDN}/montserrat@5/files/montserrat-latin-400-normal.woff`,
    bold: `${CDN}/montserrat@5/files/montserrat-latin-700-normal.woff`,
  },
  playfair: {
    regular: `${CDN}/playfair-display@5/files/playfair-display-latin-400-normal.woff`,
    bold: `${CDN}/playfair-display@5/files/playfair-display-latin-700-normal.woff`,
  },
  bebas: {
    regular: `${CDN}/bebas-neue@5/files/bebas-neue-latin-400-normal.woff`,
  },
  oswald: {
    regular: `${CDN}/oswald@5/files/oswald-latin-400-normal.woff`,
    bold: `${CDN}/oswald@5/files/oswald-latin-600-normal.woff`,
  },
  dm_sans: {
    regular: `${CDN}/dm-sans@5/files/dm-sans-latin-400-normal.woff`,
    bold: `${CDN}/dm-sans@5/files/dm-sans-latin-700-normal.woff`,
  },
};

const FONT_FAMILY_NAMES: Record<PdfFont, string> = {
  inter: "Inter",
  montserrat: "Montserrat",
  playfair: "Playfair",
  bebas: "Bebas",
  oswald: "Oswald",
  dm_sans: "DMSans",
};

// Fallback built-in fonts (always available)
const FALLBACK_FONTS: Record<PdfFont, { regular: string; bold: string }> = {
  inter: { regular: "Helvetica", bold: "Helvetica-Bold" },
  montserrat: { regular: "Helvetica", bold: "Helvetica-Bold" },
  playfair: { regular: "Times-Roman", bold: "Times-Bold" },
  bebas: { regular: "Helvetica-Bold", bold: "Helvetica-Bold" },
  oswald: { regular: "Helvetica", bold: "Helvetica-Bold" },
  dm_sans: { regular: "Helvetica", bold: "Helvetica-Bold" },
};

const registeredFonts = new Set<string>();

function registerFont(fontKey: PdfFont) {
  if (registeredFonts.has(fontKey)) return FONT_FAMILY_NAMES[fontKey];
  try {
    const urls = FONT_URLS[fontKey];
    const family = FONT_FAMILY_NAMES[fontKey];
    const srcs = [
      { src: urls.regular, fontWeight: 400 as const },
      ...(urls.bold ? [{ src: urls.bold, fontWeight: 700 as const }] : []),
    ];

    Font.register({ family, fonts: srcs });
    registeredFonts.add(fontKey);
    return family;
  } catch {
    return null;
  }
}

// ─── Theme Tokens ─────────────────────────────────────────────────────────────

function getTheme(theme: PdfTheme, accent: string) {
  if (theme === "dark") {
    return {
      bg: "#0a0a0a",
      surface: "#141414",
      border: "#2a2a2a",
      text: "#f5f5f5",
      subtext: "#888888",
      imagePlaceholder: "#1c1c1c",
      accent,
      coverGradient: "#0a0a0a",
    };
  }
  return {
    bg: "#ffffff",
    surface: "#f8f8f8",
    border: "#e5e5e5",
    text: "#0a0a0a",
    subtext: "#666666",
    imagePlaceholder: "#efefef",
    accent,
    coverGradient: "#ffffff",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShotType(t?: string) {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function totalRuntime(frames: StoryboardFrame[]) {
  let seconds = 0;
  for (const f of frames) {
    if (!f.shot_duration) continue;
    const parts = f.shot_duration.split(":").map(Number);
    if (parts.length === 3) seconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds += parts[0] * 60 + parts[1];
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function today() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

interface Props {
  frames: StoryboardFrame[];
  settings: StoryboardPdfSettings;
  projectTitle: string;
}

export function StoryboardPdfDocument({ frames, settings, projectTitle }: Props) {
  const { theme, font, layout, sections, branding } = settings;
  const t = getTheme(theme, branding.accentColor);

  // Try to register the custom font; fall back to built-in if it fails
  const registeredFamily = registerFont(font);
  const fontFamily = registeredFamily ?? FALLBACK_FONTS[font].regular;
  const fontFamilyBold = registeredFamily ?? FALLBACK_FONTS[font].bold;

  // Layout grid config
  const cols = layout === "1up" ? 1 : layout === "2up" ? 2 : 3;
  const pageOrientation = "landscape";

  const styles = StyleSheet.create({
    page: {
      backgroundColor: t.bg,
      fontFamily,
      paddingHorizontal: 30,
      paddingTop: 24,
      paddingBottom: 36,
    },
    // ── Cover ──────────────────────────────────────────────────────────────
    coverPage: {
      backgroundColor: t.bg,
      fontFamily,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 60,
    },
    coverLogo: {
      width: 72,
      height: 72,
      marginBottom: 24,
      borderRadius: 12,
      objectFit: "contain",
    },
    coverAgency: {
      fontSize: 11,
      letterSpacing: 4,
      textTransform: "uppercase",
      color: t.subtext,
      marginBottom: 14,
      fontFamily: fontFamilyBold,
    },
    coverTitle: {
      fontSize: 36,
      fontFamily: fontFamilyBold,
      color: t.text,
      textAlign: "center",
      lineHeight: 1.2,
      marginBottom: 10,
    },
    coverDivider: {
      width: 60,
      height: 3,
      backgroundColor: t.accent,
      borderRadius: 2,
      marginVertical: 20,
    },
    coverTagline: {
      fontSize: 13,
      color: t.subtext,
      textAlign: "center",
      marginBottom: 40,
    },
    coverStats: {
      flexDirection: "row",
      gap: 32,
    },
    coverStat: {
      alignItems: "center",
      gap: 4,
    },
    coverStatValue: {
      fontSize: 22,
      fontFamily: fontFamilyBold,
      color: t.accent,
    },
    coverStatLabel: {
      fontSize: 9,
      letterSpacing: 2,
      textTransform: "uppercase",
      color: t.subtext,
    },
    coverDate: {
      position: "absolute",
      bottom: 32,
      fontSize: 9,
      color: t.subtext,
      letterSpacing: 1,
    },
    coverWatermark: {
      position: "absolute",
      bottom: 32,
      right: 32,
      fontSize: 8,
      color: theme === "dark" ? "#333" : "#ccc",
    },
    // ── Page header ────────────────────────────────────────────────────────
    pageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingBottom: 10,
      borderBottom: `1 solid ${t.border}`,
    },
    pageHeaderLeft: {
      flexDirection: "column",
      gap: 2,
    },
    pageHeaderTitle: {
      fontSize: 11,
      fontFamily: fontFamilyBold,
      color: t.text,
      letterSpacing: 0.5,
    },
    pageHeaderSub: {
      fontSize: 8,
      color: t.subtext,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    accentDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.accent,
    },
    // ── Frame grid ─────────────────────────────────────────────────────────
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: cols === 1 ? 16 : cols === 2 ? 12 : 8,
    },
    frameCard: {
      width:
        cols === 1
          ? "100%"
          : cols === 2
          ? "48.5%"
          : "31.7%",
      backgroundColor: t.surface,
      borderRadius: 6,
      overflow: "hidden",
      border: `1 solid ${t.border}`,
    },
    frameImage: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: t.imagePlaceholder,
      objectFit: "cover",
    },
    imagePlaceholderBox: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: t.imagePlaceholder,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      fontSize: 8,
      color: t.subtext,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    frameBody: {
      padding: cols === 1 ? 12 : cols === 2 ? 10 : 7,
      gap: cols === 1 ? 6 : 4,
    },
    frameHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 6,
    },
    frameTitle: {
      fontSize: cols === 1 ? 11 : cols === 2 ? 10 : 8,
      fontFamily: fontFamilyBold,
      color: t.text,
      flex: 1,
    },
    frameNumber: {
      fontSize: 8,
      fontFamily: fontFamilyBold,
      color: t.accent,
      letterSpacing: 1,
    },
    shotBadge: {
      backgroundColor: t.accent + "22",
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    shotBadgeText: {
      fontSize: 7,
      color: t.accent,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      fontFamily: fontFamilyBold,
    },
    frameDesc: {
      fontSize: cols === 1 ? 9 : cols === 2 ? 8 : 7,
      color: t.subtext,
      lineHeight: 1.45,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 2,
    },
    metaChip: {
      fontSize: 7,
      color: t.subtext,
      backgroundColor: t.imagePlaceholder,
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    moodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 2,
    },
    moodDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: t.accent,
    },
    moodText: {
      fontSize: 7,
      color: t.subtext,
      fontStyle: "italic",
    },
    notesBox: {
      backgroundColor: t.imagePlaceholder,
      borderRadius: 4,
      padding: 6,
      marginTop: 4,
      borderLeft: `2 solid ${t.accent}`,
    },
    notesLabel: {
      fontSize: 7,
      fontFamily: fontFamilyBold,
      color: t.accent,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    notesText: {
      fontSize: 7,
      color: t.subtext,
      lineHeight: 1.4,
    },
    // ── Footer ─────────────────────────────────────────────────────────────
    pageFooter: {
      position: "absolute",
      bottom: 14,
      left: 30,
      right: 30,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLeft: {
      fontSize: 7,
      color: t.subtext,
      letterSpacing: 0.5,
    },
    footerRight: {
      fontSize: 7,
      color: theme === "dark" ? "#2a2a2a" : "#ccc",
    },
  });

  // ── Chunk frames into pages ─────────────────────────────────────────────
  const framesPerPage = cols === 1 ? 3 : cols === 2 ? 4 : 6;
  const framePages: StoryboardFrame[][] = [];
  for (let i = 0; i < frames.length; i += framesPerPage) {
    framePages.push(frames.slice(i, i + framesPerPage));
  }

  // ── Sub-components ──────────────────────────────────────────────────────

  const FrameCard = ({ frame, idx }: { frame: StoryboardFrame; idx: number }) => (
    <View style={styles.frameCard}>
      {/* Image */}
      {sections.frameImages && (
        frame.image_url ? (
          <Image src={frame.image_url} style={styles.frameImage} />
        ) : (
          <View style={styles.imagePlaceholderBox}>
            <Text style={styles.imagePlaceholderText}>No image</Text>
          </View>
        )
      )}

      <View style={styles.frameBody}>
        {/* Title row */}
        <View style={styles.frameHeaderRow}>
          {frame.title && (
            <Text style={styles.frameTitle}>{frame.title}</Text>
          )}
          {sections.frameNumbers && (
            <Text style={styles.frameNumber}>#{String(idx + 1).padStart(2, "0")}</Text>
          )}
        </View>

        {/* Shot type badge */}
        {sections.shotDetails && frame.shot_type && (
          <View style={styles.shotBadge}>
            <Text style={styles.shotBadgeText}>{formatShotType(frame.shot_type)}</Text>
          </View>
        )}

        {/* Description */}
        {frame.description && (
          <Text style={styles.frameDesc}>{frame.description}</Text>
        )}

        {/* Meta chips */}
        {sections.shotDetails && (frame.shot_duration || frame.camera_angle) && (
          <View style={styles.metaRow}>
            {frame.shot_duration && (
              <Text style={styles.metaChip}>{frame.shot_duration}</Text>
            )}
            {frame.camera_angle && (
              <Text style={styles.metaChip}>{frame.camera_angle}</Text>
            )}
          </View>
        )}

        {/* Mood */}
        {sections.mood && frame.mood && (
          <View style={styles.moodRow}>
            <View style={styles.moodDot} />
            <Text style={styles.moodText}>{frame.mood}</Text>
          </View>
        )}

        {/* Notes */}
        {sections.directorNotes && frame.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Director's Note</Text>
            <Text style={styles.notesText}>{frame.notes}</Text>
          </View>
        )}
      </View>
    </View>
  );

  const PageHeader = ({ pageNum, total }: { pageNum: number; total: number }) => (
    <View style={styles.pageHeader} fixed>
      <View style={styles.pageHeaderLeft}>
        <Text style={styles.pageHeaderTitle}>{projectTitle}</Text>
        <Text style={styles.pageHeaderSub}>
          {branding.agencyName
            ? `${branding.agencyName}  ·  Storyboard`
            : "Storyboard"}
        </Text>
      </View>
      <View style={styles.accentDot} />
    </View>
  );

  const PageFooter = () => (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerLeft}>{today()}</Text>
      {branding.showPoweredBy && (
        <Text style={styles.footerRight}>Made with CineFlow</Text>
      )}
    </View>
  );

  return (
    <Document>
      {/* Cover Page */}
      {sections.coverPage && (
        <Page size="A4" orientation={pageOrientation} style={styles.coverPage}>
          {branding.logoUrl && (
            <Image src={branding.logoUrl} style={styles.coverLogo} />
          )}
          {branding.agencyName && (
            <Text style={styles.coverAgency}>{branding.agencyName}</Text>
          )}
          <Text style={styles.coverTitle}>{projectTitle}</Text>
          <View style={styles.coverDivider} />
          {branding.tagline && (
            <Text style={styles.coverTagline}>{branding.tagline}</Text>
          )}
          <View style={styles.coverStats}>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatValue}>{frames.length}</Text>
              <Text style={styles.coverStatLabel}>Frames</Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatValue}>
                {frames.filter((f) => f.image_url).length}
              </Text>
              <Text style={styles.coverStatLabel}>Images</Text>
            </View>
            <View style={styles.coverStat}>
              <Text style={styles.coverStatValue}>{totalRuntime(frames)}</Text>
              <Text style={styles.coverStatLabel}>Runtime</Text>
            </View>
          </View>
          <Text style={styles.coverDate}>{today()}</Text>
          {branding.showPoweredBy && (
            <Text style={styles.coverWatermark}>Made with CineFlow</Text>
          )}
        </Page>
      )}

      {/* Frame Pages */}
      {framePages.map((pageFrames, pageIdx) => (
        <Page
          key={pageIdx}
          size="A4"
          orientation={pageOrientation}
          style={styles.page}
        >
          <PageHeader pageNum={pageIdx + 1} total={framePages.length} />
          <View style={styles.grid}>
            {pageFrames.map((frame, i) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                idx={pageIdx * framesPerPage + i}
              />
            ))}
          </View>
          <PageFooter />
        </Page>
      ))}
    </Document>
  );
}
