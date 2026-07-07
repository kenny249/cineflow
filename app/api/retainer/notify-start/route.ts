import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function formatMonthYear(my: string) {
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { retainerId, monthId } = await req.json();
    if (!retainerId || !monthId) return NextResponse.json({ error: "retainerId and monthId required" }, { status: 400 });

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [{ data: retainer }, { data: month }] = await Promise.all([
      service.from("retainers").select("client_name, client_email, template, portal_token, monthly_rate").eq("id", retainerId).single(),
      service.from("retainer_months").select("month_year").eq("id", monthId).single(),
    ]);

    if (!retainer?.client_email) {
      return NextResponse.json({ sent: 0, message: "No client email on retainer" });
    }

    const { data: ownerProfile } = await service
      .from("profiles")
      .select("business_name, company, full_name")
      .eq("id", user.id)
      .single();

    const agencyName = ownerProfile?.business_name || ownerProfile?.company || ownerProfile?.full_name || "Your agency";
    const monthLabel = formatMonthYear(month?.month_year ?? "");
    const clientFirst = retainer.client_name.split(" ")[0];
    const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
    const portalUrl = retainer.portal_token ? `${appUrl}/portal/retainer/${retainer.portal_token}` : null;

    // Build deliverable list from template
    const deliverableLines = (retainer.template as { label: string; quantity: number }[])
      .filter((t) => t.quantity > 0)
      .map((t) => `<li style="margin:4px 0;color:#a1a1aa;font-size:14px;">${t.quantity > 1 ? `${t.quantity}× ` : ""}${t.label}</li>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#18181b;padding:32px 40px;">
      <div style="display:inline-block;background:#d4a85320;border:1px solid #d4a85350;border-radius:999px;padding:4px 14px;margin-bottom:12px;">
        <span style="color:#d4a853;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Retainer</span>
      </div>
      <p style="margin:0 0 6px;color:#a1a1aa;font-size:13px;">Hi ${clientFirst},</p>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;line-height:1.3;">${monthLabel} is kicking off</h1>
      <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">${agencyName} is starting production on your content for this month.</p>
    </div>

    <!-- Deliverables -->
    <div style="padding:28px 40px;border-bottom:1px solid #f4f4f5;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#18181b;text-transform:uppercase;letter-spacing:0.5px;">This month includes</p>
      <ul style="margin:0;padding-left:16px;">
        ${deliverableLines}
      </ul>
    </div>

    <!-- CTA -->
    <div style="padding:28px 40px;text-align:center;">
      ${portalUrl ? `
      <a href="${portalUrl}" style="display:inline-block;background:#d4a853;color:#000;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:700;margin-bottom:12px;">
        Track Progress →
      </a>
      <br>
      <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">You can check the status of each deliverable in real time.</p>
      ` : `<p style="margin:0;font-size:13px;color:#71717a;">Your team will be in touch with updates as content is completed.</p>`}
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">
        Sent by <strong>${agencyName}</strong> via <a href="${appUrl}" style="color:#a1a1aa;">CineFlow</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const resend = new Resend(process.env.RESEND_API_KEY!);
    // Extract bare email in case RESEND_FROM_EMAIL is "Name <email@domain.com>"
    const fromEnv = process.env.RESEND_FROM_EMAIL ?? "noreply@usecineflow.com";
    const fromEmail = fromEnv.match(/<([^>]+)>/)?.[1] ?? fromEnv;

    const { error } = await resend.emails.send({
      from: `${agencyName} <${fromEmail}>`,
      to: [retainer.client_email],
      subject: `${monthLabel} is starting — here's what we're creating`,
      html,
    });

    if (error) {
      console.error("[retainer/notify-start] Resend error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sent: 1 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send";
    console.error("[retainer/notify-start]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
