import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { PaymentSettings } from "@/types";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// GET /api/contracts/sign?token=xxx — fetch contract data for signing page
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = getAdmin();
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id, title, description, file_url, status, recipient_name, recipient_email, signed_at, signature_fields, sender_signed_at, signed_pdf_url")
    .eq("signing_token", token)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

// POST /api/contracts/sign?token=xxx — submit signature
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(`sign:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  let body: { signer_name: string; signer_email?: string; signature_data: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.signer_name?.trim()) {
    return NextResponse.json({ error: "Signer name is required" }, { status: 400 });
  }
  if (!body.signature_data?.trim()) {
    return NextResponse.json({ error: "Signature is required" }, { status: 400 });
  }

  const supabase = getAdmin();

  // Fetch contract by token (include fields needed for confirmation emails)
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("id, title, status, signing_token, created_by, recipient_email, recipient_name")
    .eq("signing_token", token)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  if (contract.status === "signed") {
    return NextResponse.json({ error: "Contract has already been signed" }, { status: 409 });
  }

  if (contract.status === "voided") {
    return NextResponse.json({ error: "This contract has been voided" }, { status: 410 });
  }

  // Save signature
  const { error: sigErr } = await supabase.from("contract_signatures").insert({
    contract_id: contract.id,
    signer_name: body.signer_name.trim(),
    signer_email: body.signer_email?.trim() || null,
    signature_data: body.signature_data,
    ip_address: ip,
  });

  if (sigErr) {
    return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
  }

  const now = new Date().toISOString();

  // Mark contract as signed
  await supabase
    .from("contracts")
    .update({ status: "signed", signed_at: now, updated_at: now })
    .eq("id", contract.id);

  const origin = req.headers.get("origin") ?? req.nextUrl.origin;

  // Fire stamp + confirmation emails in background — don't block the signing response
  Promise.all([
    fetch(`${origin}/api/contracts/stamp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: contract.id }),
    }).catch(() => {}),
    sendSignedConfirmations({ supabase, contract, body, origin, now }).catch(() => {}),
  ]);

  return NextResponse.json({ success: true });
}

// ── Confirmation emails ───────────────────────────────────────────────────────

async function sendSignedConfirmations({
  supabase,
  contract,
  body,
  origin,
  now,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  contract: { id: string; title: string; signing_token: string; created_by: string; recipient_email: string | null; recipient_name: string | null };
  body: { signer_name: string; signer_email?: string };
  origin: string;
  now: string;
}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, business_name, company, payment_settings")
    .eq("id", contract.created_by)
    .single();

  if (!profile) return;

  const ps = (profile.payment_settings ?? {}) as PaymentSettings;
  const resendKey = ps.resend_api_key || process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
  const bizName = profile.business_name || profile.company || profile.full_name || "Studio";
  const fromName = ps.invoice_from_name || bizName;
  const fromEmail = ps.invoice_from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const certUrl = `${appUrl}/sign/${contract.signing_token}/certificate`;
  const signedDate = new Date(now).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const promises: Promise<unknown>[] = [];

  // Email to agency — notify that contract was signed
  if (profile.email) {
    const agencyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#18181b;padding:32px 40px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${bizName}</p>
      <p style="margin:8px 0 0;font-size:28px;font-weight:900;color:#10b981;letter-spacing:-0.5px;">CONTRACT SIGNED</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.6;">
        <strong>${body.signer_name}</strong> signed your contract on ${signedDate}.
      </p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Contract</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#18181b;">${contract.title}</p>
        ${body.signer_email ? `<p style="margin:6px 0 0;font-size:13px;color:#71717a;">${body.signer_email}</p>` : ""}
      </div>
      <div style="text-align:center;">
        <a href="${certUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
          View Certificate →
        </a>
      </div>
    </div>
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">Sent via <strong>Cineflow</strong> · ${appUrl}</p>
    </div>
  </div>
</body>
</html>`;

    promises.push(resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [profile.email],
      subject: `✅ ${body.signer_name} signed "${contract.title}"`,
      html: agencyHtml,
    }));
  }

  // Email to signer — confirmation receipt
  const signerEmail = body.signer_email || contract.recipient_email;
  if (signerEmail) {
    const signerHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#18181b;padding:32px 40px;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${bizName}</p>
      <p style="margin:8px 0 0;font-size:28px;font-weight:900;color:#10b981;letter-spacing:-0.5px;">SIGNED</p>
    </div>
    <div style="padding:32px 40px;">
      <p style="margin:0 0 8px;font-size:15px;color:#18181b;">Hi ${body.signer_name},</p>
      <p style="margin:0 0 20px;font-size:14px;color:#3f3f46;line-height:1.6;">
        Your signature has been received. Here's a copy for your records.
      </p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Contract</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#18181b;">${contract.title}</p>
        <p style="margin:6px 0 0;font-size:13px;color:#71717a;">Signed ${signedDate}</p>
      </div>
      <div style="text-align:center;">
        <a href="${certUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
          View Signing Certificate →
        </a>
      </div>
    </div>
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">Sent via <strong>Cineflow</strong> · ${appUrl}</p>
    </div>
  </div>
</body>
</html>`;

    promises.push(resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [signerEmail],
      subject: `Your signed copy of "${contract.title}"`,
      html: signerHtml,
    }));
  }

  await Promise.all(promises);
}
