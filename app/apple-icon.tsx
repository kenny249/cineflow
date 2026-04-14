import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0d0d0d 0%, #111111 100%)",
        }}
      >
        {/* Gold glow */}
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(212,168,83,0.18) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Play triangle */}
        <svg width="80" height="80" viewBox="0 0 32 32">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0c97a" />
              <stop offset="100%" stopColor="#d4a853" />
            </linearGradient>
          </defs>
          <polygon points="10,8 10,24 24,16" fill="url(#g)" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
