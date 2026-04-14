import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// No emoji, no external fetch — emoji requires a bundled font in edge runtime
// and will silently crash ImageResponse, causing fallback to the root OG image.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#18181b",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Gold accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#d4a853",
            display: "flex",
          }}
        />

        {/* Form icon — SVG only, no emoji */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 22,
            backgroundColor: "#27272a",
            border: "1.5px solid #3f3f46",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg
            width="38"
            height="38"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d4a853"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1.5px",
            marginBottom: 14,
            display: "flex",
          }}
        >
          You have been sent a form
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: 26,
            color: "#a1a1aa",
            fontWeight: 400,
            display: "flex",
          }}
        >
          Review and complete your intake questionnaire
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 34,
            fontSize: 17,
            color: "#52525b",
            display: "flex",
          }}
        >
          Powered by Cineflow
        </div>
      </div>
    ),
    { ...size }
  );
}
