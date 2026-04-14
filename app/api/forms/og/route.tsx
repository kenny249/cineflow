import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    let agencyName = "Your Studio";
    let logoDataUrl: string | null = null;

    if (token) {
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
          agencyName =
            profile.business_name || profile.company || profile.full_name || "Your Studio";
          if (profile.logo_url) {
            logoDataUrl = await fetchLogoAsBase64(profile.logo_url);
          }
        }
      }
    }

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

          {/* Agency logo or name */}
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUrl}
              style={{
                height: 90,
                maxWidth: 360,
                objectFit: "contain",
                marginBottom: 28,
              }}
              alt={agencyName}
            />
          ) : (
            <div
              style={{
                fontSize: 60,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-2px",
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
              fontSize: logoDataUrl ? 38 : 32,
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
              width: 52,
              height: 3,
              backgroundColor: "#d4a853",
              borderRadius: 2,
              display: "flex",
            }}
          />

          {/* Agency name below logo */}
          {logoDataUrl && (
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
      { width: 1200, height: 630 }
    );
  } catch (e) {
    console.error("OG image generation failed", e);
    return new NextResponse("Failed to generate image", { status: 500 });
  }
}
