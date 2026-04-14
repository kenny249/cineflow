import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#18181b",
            fontFamily: "system-ui, -apple-system, sans-serif",
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: "0", left: "0", right: "0", height: "6px", backgroundColor: "#d4a853", display: "flex" }} />

          <div
            style={{
              width: "88px",
              height: "88px",
              borderRadius: "24px",
              backgroundColor: "#27272a",
              border: "2px solid #3f3f46",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "32px",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="16" x2="13" y2="16" />
            </svg>
          </div>

          <div style={{ fontSize: "54px", fontWeight: "800", color: "#ffffff", letterSpacing: "-2px", marginBottom: "16px", display: "flex" }}>
            You have been sent a form
          </div>

          <div style={{ fontSize: "26px", color: "#a1a1aa", display: "flex" }}>
            Review and complete your intake questionnaire
          </div>

          <div style={{ position: "absolute", bottom: "34px", fontSize: "18px", color: "#52525b", display: "flex" }}>
            Powered by Cineflow
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("OG image generation failed", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
