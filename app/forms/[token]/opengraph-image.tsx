import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";

export default async function OGImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let agencyName = "Studio";
  let formTitle = "Client Intake Form";

  try {
    const res = await fetch(`${APP_URL}/api/forms/${token}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      agencyName = data?.agency?.name ?? "Studio";
      formTitle = data?.form?.title ?? "Client Intake Form";
    }
  } catch {
    // fallback values used
  }

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
        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#d4a853" }} />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "0 80px", textAlign: "center" }}>
          {/* Agency name */}
          <div style={{ fontSize: 52, fontWeight: 800, color: "#ffffff", letterSpacing: "-1px", lineHeight: 1.1 }}>
            {agencyName}
          </div>

          {/* Sent you a form */}
          <div style={{ fontSize: 30, color: "#a1a1aa", fontWeight: 400 }}>
            sent you a form
          </div>

          {/* Form title pill */}
          <div
            style={{
              marginTop: 8,
              backgroundColor: "#27272a",
              border: "1px solid #3f3f46",
              borderRadius: 12,
              padding: "14px 32px",
              fontSize: 22,
              color: "#d4a853",
              fontWeight: 600,
            }}
          >
            {formTitle}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 16,
            color: "#52525b",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Powered by Cineflow
        </div>
      </div>
    ),
    { ...size }
  );
}
