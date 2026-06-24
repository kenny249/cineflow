"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080808", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#d4a853" }}>
              CINEFLOW
            </p>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "#fff" }}>
              Something went wrong
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#71717a", maxWidth: 360 }}>
              An unexpected error occurred. Please refresh the page or try again.
              {error.digest && (
                <span style={{ display: "block", marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "#3f3f46" }}>
                  ref: {error.digest}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={reset}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#d4a853", color: "#000",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
