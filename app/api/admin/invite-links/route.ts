import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";
import { cookies } from "next/headers";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

function randomCode(length = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// POST — create a new invite link
export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Send email action
  if (body.action === "send-email") {
    return handleSendEmail(body);
  }

  const {
    plan = "lifetime",
    max_uses = 1,
    notes = null,
    headline = null,
    badge_text = "Founding Member",
    subtext = null,
    invitee_name = null,
    access_type = "founding",
    trial_days = 30,
    expires_at = null,
  } = body;

  const admin = getAdmin();
  const { data: link, error } = await admin
    .from("invite_links")
    .insert({
      code: randomCode(),
      plan,
      max_uses,
      notes,
      headline,
      badge_text,
      subtext,
      invitee_name,
      access_type,
      trial_days,
      expires_at,
      is_active: true,
      created_by: caller.id,
    })
    .select()
    .single();

  if (error) {
    console.error("[api/admin/invite-links POST]", error.message);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }

  return NextResponse.json({ link }, { status: 201 });
}

// PATCH — update link (toggle active, edit fields)
export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdmin();
  const { data: link, error } = await admin
    .from("invite_links")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  return NextResponse.json({ link });
}

// DELETE — remove an invite link
export async function DELETE(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = getAdmin();
  const { error } = await admin.from("invite_links").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ success: true });
}

async function handleSendEmail(body: {
  to_email: string;
  invite_code: string;
  invitee_name?: string;
  headline?: string;
  badge_text?: string;
  subtext?: string;
  plan?: string;
  access_type?: string;
}) {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) return NextResponse.json({ error: "Email not configured" }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();
  const inviteUrl = `${appUrl}/invite/${body.invite_code}`;
  const firstName = body.invitee_name?.split(" ")[0] ?? "";
  const badgeText = body.badge_text ?? "Founding Member";
  const headline = body.headline ?? `You've been personally invited to CineFlow`;
  const subtext = body.subtext ?? "Exclusive access. Free forever. No credit card.";
  const planLabel = body.plan === "solo" ? "Solo" : body.plan === "agency" ? "Agency" : "Studio";
  const accessLabel = body.access_type === "founding" ? "Free forever — no card, no catch"
    : body.access_type === "trial" ? `Extended ${body.access_type} trial`
    : "30-day free trial";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:48px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

      <!-- Logo -->
      <tr><td align="center" style="padding-bottom:32px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:rgba(212,168,83,0.1);border:1px solid rgba(212,168,83,0.3);border-radius:10px;padding:10px;margin-right:10px;">
              <span style="font-size:18px;">🎬</span>
            </td>
            <td style="padding-left:10px;">
              <span style="font-size:11px;font-weight:800;letter-spacing:0.3em;color:#d4a853;text-transform:uppercase;">CineFlow</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Card -->
      <tr><td style="background:linear-gradient(135deg,#111010 0%,#0d0c0c 100%);border:1px solid rgba(212,168,83,0.2);border-radius:24px;padding:48px 40px;box-shadow:0 0 80px rgba(212,168,83,0.06);">

        <!-- Badge -->
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
          <tr><td align="center" style="background:linear-gradient(135deg,#1c1a0f,#0e0d08);border:1px solid rgba(212,168,83,0.45);border-radius:100px;padding:6px 16px;">
            <span style="font-size:10px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;background:linear-gradient(90deg,#a0720a,#f0c84a,#d4a853,#f5d98e,#b8860b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
              ✦ ${badgeText}
            </span>
          </td></tr>
        </table>

        <!-- Headline -->
        <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#ffffff;text-align:center;line-height:1.3;">
          ${firstName ? `${firstName}, ${headline.charAt(0).toLowerCase()}${headline.slice(1)}` : headline}
        </h1>

        <!-- Subtext -->
        <p style="margin:0 0 32px;font-size:15px;color:#71717a;text-align:center;line-height:1.6;">
          ${subtext}
        </p>

        <!-- What you get -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background:rgba(212,168,83,0.04);border:1px solid rgba(212,168,83,0.12);border-radius:16px;padding:20px;">
          <tr>
            <td style="font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#d4a853;padding-bottom:12px;">What you get</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#a1a1aa;line-height:2;">
              ✓ &nbsp;${planLabel} plan — shot lists, call sheets, client portals<br/>
              ✓ &nbsp;Invoicing, scheduling &amp; crew management<br/>
              ✓ &nbsp;${accessLabel}<br/>
              ✓ &nbsp;Priority support &amp; early feature access
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${inviteUrl}" style="display:inline-block;background:#d4a853;color:#000000;font-size:15px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:14px;letter-spacing:0.01em;">
              Claim your invitation →
            </a>
          </td></tr>
        </table>

        <!-- Link fallback -->
        <p style="margin:24px 0 0;font-size:11px;color:#3f3f46;text-align:center;">
          Or copy this link: <a href="${inviteUrl}" style="color:#71717a;">${inviteUrl}</a>
        </p>

      </td></tr>

      <!-- Footer -->
      <tr><td align="center" style="padding-top:24px;">
        <p style="font-size:11px;color:#3f3f46;margin:0;">
          CineFlow by Maltav · <a href="${appUrl}" style="color:#3f3f46;">usecineflow.com</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "CineFlow <invite@usecineflow.com>",
    to: body.to_email,
    subject: `${firstName ? `${firstName}, you've` : "You've"} been invited to CineFlow`,
    html,
  });

  if (error) {
    console.error("[invite send-email]", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
