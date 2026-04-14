import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#090909",
            fontFamily: "sans-serif",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 50% 35%, rgba(212,168,83,0.14) 0%, rgba(212,168,83,0.03) 32%, transparent 65%)",
              display: "flex",
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "24px",
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "16px",
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="34" height="34" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f0c97a" />
                    <stop offset="100%" stopColor="#d4a853" />
                  </linearGradient>
                </defs>
                <polygon points="11,8.5 11,23.5 23,16" fill="url(#g)" />
              </svg>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                letterSpacing: "-2px",
                lineHeight: 1,
                fontWeight: 800,
                fontSize: "92px",
                color: "#ffffff",
              }}
            >
              CINE
              <span style={{ color: "#d4a853", display: "flex" }}>FLOW</span>
            </div>

            <div
              style={{
                fontSize: "30px",
                color: "rgba(255,255,255,0.64)",
                letterSpacing: "0.4px",
                display: "flex",
              }}
            >
              Project workspace for film teams.
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: "38px",
              fontSize: "20px",
              color: "rgba(255,255,255,0.34)",
              letterSpacing: "0.6px",
              display: "flex",
            }}
          >
            usecineflow.com
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("[/api/og] ImageResponse failed:", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
