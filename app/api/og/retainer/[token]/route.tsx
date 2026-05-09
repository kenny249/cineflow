import { ImageResponse } from "next/og";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "edge";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function formatMonthYear(my: string) {
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = getAdmin();

  const { data: retainer } = await supabase
    .from("retainers")
    .select("id, client_name, template, created_by")
    .eq("portal_token", token)
    .single();

  const { data: profile } = retainer
    ? await supabase
        .from("profiles")
        .select("business_name, company, full_name")
        .eq("id", retainer.created_by)
        .single()
    : { data: null };

  const { data: months } = retainer
    ? await supabase
        .from("retainer_months")
        .select("month_year, status")
        .eq("retainer_id", retainer?.id ?? "")
        .order("month_year", { ascending: false })
        .limit(1)
    : { data: null };

  const clientName = retainer?.client_name ?? "Client Portal";
  const agencyName = profile?.business_name || profile?.company || profile?.full_name || "Studio";
  const activeMonth = months?.[0];
  const monthLabel = activeMonth ? formatMonthYear(activeMonth.month_year) : null;
  const template = retainer?.template ?? [];
  const deliverableSummary = template
    .map((t: { quantity: number; label: string }) => `${t.quantity}× ${t.label}`)
    .join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "#0b0b0b",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: -80,
            width: 500,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(212,168,83,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 56px 0",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid rgba(212,168,83,0.4)",
                background: "rgba(212,168,83,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🎬
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "#d4a853", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>
                CINEFLOW
              </span>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, letterSpacing: 3 }}>
                CLIENT PORTAL
              </span>
            </div>
          </div>

          {/* Agency name */}
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
            {agencyName}
          </span>
        </div>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 56px",
            gap: 16,
          }}
        >
          {/* Client name */}
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            {clientName}
          </div>

          {/* Month + status row */}
          {monthLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
              <span
                style={{
                  fontSize: 22,
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 500,
                }}
              >
                {monthLabel}
              </span>
              {activeMonth?.status && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color:
                      activeMonth.status === "active" ? "#34d399" :
                      activeMonth.status === "wrapped" ? "#60a5fa" :
                      activeMonth.status === "invoiced" ? "#a78bfa" :
                      "rgba(255,255,255,0.3)",
                    background:
                      activeMonth.status === "active" ? "rgba(52,211,153,0.12)" :
                      activeMonth.status === "wrapped" ? "rgba(96,165,250,0.12)" :
                      activeMonth.status === "invoiced" ? "rgba(167,139,250,0.12)" :
                      "rgba(255,255,255,0.06)",
                    padding: "5px 14px",
                    borderRadius: 100,
                    border: `1px solid ${
                      activeMonth.status === "active" ? "rgba(52,211,153,0.25)" :
                      activeMonth.status === "wrapped" ? "rgba(96,165,250,0.25)" :
                      activeMonth.status === "invoiced" ? "rgba(167,139,250,0.25)" :
                      "rgba(255,255,255,0.1)"
                    }`,
                  }}
                >
                  {activeMonth.status}
                </span>
              )}
            </div>
          )}

          {/* Deliverable summary */}
          {deliverableSummary && (
            <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", marginTop: 4 }}>
              {deliverableSummary}
            </span>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 56px 36px",
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.15)" }}>
            usecineflow.com · Retainer Portal
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
