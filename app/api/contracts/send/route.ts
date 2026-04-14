import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import type { PaymentSettings } from "@/types";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { contractId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.contractId) return NextResponse.json({ error: "contractId required" }, { status: 400 });

  // Load contract + profile
  const [{ data: contract, error: contractErr }, { data: profile }] = await Promise.all([
    supabase.from("contracts").select("*").eq("id", body.contractId).eq("created_by", user.id).single(),
    supabase.from("profiles").select("full_name, company, business_name, email, payment_settings").eq("id", user.id).single(),
  ]);

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!contract.recipient_email) {
    return NextResponse.json({ error: "Recipient email is required to send. Edit the contract first." }, { status: 400 });
  }

  const ps = (profile?.payment_settings ?? {}) as PaymentSettings;
  const resendKey = ps.resend_api_key || process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Resend API key not configured. Add it in Settings → Invoice Email." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";
  const signingUrl = `${appUrl}/sign/${contract.signing_token}`;
  const bizName = profile?.business_name || profile?.company || profile?.full_name || "Studio";
  const fromName = ps.invoice_from_name || bizName;
  const fromEmail = ps.invoice_from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const recipientName = contract.recipient_name || contract.recipient_email;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#18181b;padding:32px 40px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${bizName}</p>
      <p style="margin:8px 0 0;font-size:28px;font-weight:900;color:#d4a853;letter-spacing:-0.5px;">CONTRACT</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 8px;font-size:15px;color:#18181b;">Hi ${recipientName},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.6;">
        <strong>${bizName}</strong> has sent you a contract for your review and signature.
      </p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Contract</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#18181b;">${contract.title}</p>
        ${contract.description ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${contract.description}</p>` : ""}
      </div>
      <div style="text-align:center;">
        <a href="${signingUrl}" style="display:inline-block;background:#d4a853;color:#000;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
          Review &amp; Sign →
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">
          Or visit: <a href="${signingUrl}" style="color:#71717a;">${signingUrl}</a>
        </p>
      </div>
    </div>
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">Sent via <strong>Cineflow</strong> · ${appUrl}</p>
    </div>
  </div>
</body>
</html>`;

  const resend = new Resend(resendKey);
  const { error: emailError } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [contract.recipient_email],
    subject: `${bizName} sent you a contract: ${contract.title}`,
    html,
  });

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 400 });
  }

  // Mark as sent
  await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", body.contractId)
    .eq("status", "draft");

  return NextResponse.json({ success: true, signingUrl });
}
