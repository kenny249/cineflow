import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static — no fetch calls (edge functions can't reliably call their own origin).
// generateMetadata in page.tsx handles the dynamic title/description text.
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
        {/* Gold top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            backgroundColor: "#d4a853",
          }}
        />

        {/* Icon */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: "#27272a",
            border: "1.5px solid #3f3f46",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 36 }}>📋</div>
        </div>

        {/* Text */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            marginBottom: 12,
          }}
        >
          You&apos;ve been sent a form
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#a1a1aa",
            fontWeight: 400,
          }}
        >
          Review and complete your intake questionnaire
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 17,
            color: "#52525b",
          }}
        >
          Powered by Cineflow
        </div>
      </div>
    ),
    { ...size }
  );
}
