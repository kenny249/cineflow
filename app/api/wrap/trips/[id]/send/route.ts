import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getAdmin();

  const { data: trip, error: tripErr } = await admin
    .from("wrap_trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (tripErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  await admin.from("wrap_trips").update({ status: "sent" }).eq("id", id);

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com";
  const reportUrl = `${origin}/wrap/report/${id}`;

  let emailSent = false;
  if (trip.client_email) {
    const { error: emailErr } = await resend.emails.send({
      from: "Wrap by CineFlow <noreply@usecineflow.com>",
      to: trip.client_email,
      subject: `Expense report ready: ${trip.name}`,
      html: buildEmail({ trip, reportUrl }),
    });
    emailSent = !emailErr;
  }

  return NextResponse.json({ ok: true, emailSent });
}

function buildEmail({ trip, reportUrl }: { trip: Record<string, string | null>; reportUrl: string }) {
  const greeting = trip.client_name ? `Hi ${trip.client_name},` : "Hi,";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#0a0a0a;padding:24px 32px;">
      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.35em;color:#d4a853;text-transform:uppercase;">Wrap · by CineFlow</p>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#09090b;letter-spacing:-0.3px;">${trip.name}</h1>
      <p style="margin:0 0 28px;font-size:14px;color:#71717a;">Expense report</p>
      <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;">${greeting}</p>
      <p style="margin:0 0 28px;font-size:15px;color:#52525b;line-height:1.6;">
        Your expense report is ready for review. Click below to see the full breakdown and submit payment.
      </p>
      <a href="${reportUrl}"
         style="display:inline-block;background:#d4a853;color:#000000;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:-0.2px;">
        View &amp; Pay Expense Report
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
        Or copy this link:<br>
        <a href="${reportUrl}" style="color:#d4a853;word-break:break-all;">${reportUrl}</a>
      </p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f4f4f5;">
      <p style="margin:0;font-size:12px;color:#d4d4d8;">
        Sent via <a href="https://www.usecineflow.com" style="color:#a1a1aa;text-decoration:none;">Wrap by CineFlow</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
