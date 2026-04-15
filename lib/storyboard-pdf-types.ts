// Shared types for storyboard PDF export — client-safe (no @react-pdf imports)

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
