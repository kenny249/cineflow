import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import type { PaymentSettings } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://usecineflow.com";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { form_id, to_email, to_name } = body as { form_id: string; to_email: string; to_name?: string };
  if (!form_id || !to_email) return NextResponse.json({ error: "form_id and to_email required" }, { status: 400 });

  const [{ data: form }, { data: profile }] = await Promise.all([
    supabase.from("cine_forms").select("id, title, token, description").eq("id", form_id).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const ps = (profile?.payment_settings ?? {}) as PaymentSettings & Record<string, string>;
  const resendKey = ps.resend_api_key || process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "Resend API key not configured. Add it in Settings → Invoice Email." }, { status: 400 });

  const bizName = profile?.business_name || profile?.company || profile?.full_name || "Your Studio";
  const fromEmail = ps.invoice_from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const formUrl = `${APP_URL}/forms/${form.token}`;

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: `${bizName} <${fromEmail}>`,
    to: [to_email],
    subject: `${bizName} sent you a form: ${form.title}`,
    html: buildFormEmail({ bizName, formTitle: form.title, formDescription: form.description, formUrl, toName: to_name }),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function buildFormEmail({
  bizName,
  formTitle,
  formDescription,
  formUrl,
  toName,
}: {
  bizName: string;
  formTitle: string;
  formDescription?: string | null;
  formUrl: string;
  toName?: string;
}) {
  const greeting = toName ? `Hi ${toName},` : "Hi there,";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:28px 36px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff">${bizName}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#71717a">Sent you a form to complete</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 36px">
            <p style="margin:0 0 8px;font-size:15px;color:#18181b">${greeting}</p>
            <p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.6">
              ${bizName} has sent you <strong>${formTitle}</strong>${formDescription ? ` — ${formDescription}` : ""}. Please take a moment to fill it out.
            </p>
            <a href="${formUrl}" style="display:inline-block;background:#d4a853;color:#000000;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px">
              Open Form →
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa">
              Or copy this link: <a href="${formUrl}" style="color:#d4a853">${formUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 36px 24px;border-top:1px solid #f4f4f5">
            <p style="margin:0;font-size:11px;color:#a1a1aa;text-align:center">Powered by Cineflow · <a href="https://usecineflow.com" style="color:#a1a1aa">usecineflow.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
