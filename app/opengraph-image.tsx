import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cineflow — Creative Project Management for Filmmakers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PERFS = Array.from({ length: 22 });

export default function Image() {
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
          background: "#0a0a0a",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {/* Ambient gold glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "900px",
            height: "600px",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(212,168,83,0.12) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Top film strip */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "72px",
            background: "#111111",
            display: "flex",
            alignItems: "center",
            paddingLeft: "20px",
            gap: "16px",
            borderBottom: "1px solid rgba(212,168,83,0.08)",
          }}
        >
          {PERFS.map((_, i) => (
            <div
              key={i}
              style={{
                width: "36px",
                height: "38px",
                borderRadius: "5px",
                background: "rgba(212,168,83,0.18)",
                flexShrink: 0,
                display: "flex",
              }}
            />
          ))}
        </div>

        {/* Bottom film strip */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "72px",
            background: "#111111",
            display: "flex",
            alignItems: "center",
            paddingLeft: "20px",
            gap: "16px",
            borderTop: "1px solid rgba(212,168,83,0.08)",
          }}
        >
          {PERFS.map((_, i) => (
            <div
              key={i}
              style={{
                width: "36px",
                height: "38px",
                borderRadius: "5px",
                background: "rgba(212,168,83,0.18)",
                flexShrink: 0,
                display: "flex",
              }}
            />
          ))}
        </div>

        {/* Center content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0px",
            zIndex: 1,
          }}
        >
          {/* Film icon badge */}
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "16px",
              background: "rgba(212,168,83,0.1)",
              border: "1.5px solid rgba(212,168,83,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "28px",
            }}
          >
            {/* SVG film strip icon */}
            <svg width="38" height="38" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="9" width="28" height="14" rx="2" fill="#1c1c1c"/>
              <rect x="4" y="11" width="3.5" height="4" rx="0.8" fill="#d4a853"/>
              <rect x="4" y="17" width="3.5" height="4" rx="0.8" fill="#d4a853"/>
              <rect x="24.5" y="11" width="3.5" height="4" rx="0.8" fill="#d4a853"/>
              <rect x="24.5" y="17" width="3.5" height="4" rx="0.8" fill="#d4a853"/>
              <rect x="9" y="10" width="14" height="12" rx="1" fill="#2a2a2a"/>
              <polygon points="13.5,13 13.5,19 20,16" fill="#d4a853"/>
            </svg>
          </div>

          {/* Wordmark */}
          <div
            style={{
              fontSize: "100px",
              fontWeight: 800,
              letterSpacing: "-3px",
              color: "#ffffff",
              lineHeight: 1,
              display: "flex",
            }}
          >
            CINE
            <span style={{ color: "#d4a853", display: "flex" }}>FLOW</span>
          </div>

          {/* Gold divider */}
          <div
            style={{
              width: "240px",
              height: "2px",
              background:
                "linear-gradient(90deg, transparent 0%, #d4a853 30%, #d4a853 70%, transparent 100%)",
              margin: "28px 0 24px",
              display: "flex",
            }}
          />

          {/* Tagline */}
          <div
            style={{
              fontSize: "22px",
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "4px",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            Creative project management for filmmakers
          </div>
        </div>

        {/* URL badge bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "88px",
            right: "56px",
            fontSize: "16px",
            color: "rgba(212,168,83,0.65)",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          usecineflow.com
        </div>
      </div>
    ),
    { ...size }
  );
}
