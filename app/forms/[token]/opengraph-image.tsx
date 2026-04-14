import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

// No runtime export = Node.js default.
// Edge runtime was crashing silently; Node.js is reliable for ImageResponse + Supabase.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "You have been sent a form";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function OGImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let agencyName = "Studio";
  let logoUrl: string | null = null;

  try {
    const supabase = getAdmin();

    const { data: form } = await supabase
      .from("forms")
      .select("created_by")
      .eq("token", token)
      .maybeSingle();

    if (form?.created_by) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, company, full_name, logo_url")
        .eq("id", form.created_by)
        .maybeSingle();

      if (profile) {
        agencyName = profile.business_name || profile.company || profile.full_name || "Studio";
        logoUrl = profile.logo_url ?? null;
      }
    }
  } catch {
    // use fallback values
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
        {/* Gold top bar */}
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

        {/* Agency logo (base64 data URL — no extra fetch needed) */}
        {logoUrl ? (
          <img
            src={logoUrl}
            style={{
              height: 80,
              maxWidth: 340,
              objectFit: "contain",
              marginBottom: 28,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-1.5px",
              marginBottom: 24,
              display: "flex",
            }}
          >
            {agencyName}
          </div>
        )}

        {/* "sent you a form" */}
        <div
          style={{
            fontSize: logoUrl ? 38 : 32,
            color: "#a1a1aa",
            marginBottom: 36,
            display: "flex",
          }}
        >
          sent you a form
        </div>

        {/* Gold divider */}
        <div
          style={{
            width: 48,
            height: 3,
            backgroundColor: "#d4a853",
            borderRadius: 2,
            display: "flex",
          }}
        />

        {/* Agency name below logo */}
        {logoUrl && (
          <div
            style={{
              marginTop: 24,
              fontSize: 22,
              color: "#71717a",
              display: "flex",
            }}
          >
            {agencyName}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 16,
            color: "#3f3f46",
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
