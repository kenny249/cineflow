import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function emailClientConfirmation({ clientName, description, quoteType, amount }: {
  clientName: string; description: string; quoteType: string; amount: string;
}) {
  return {
    subject: "Your proposal has been confirmed",
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding-bottom:32px;"><span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#d4a853;text-transform:uppercase;">CineFlow</span></td></tr>
<tr><td style="background:#111111;border:1px solid #222222;border-radius:12px;padding:36px 32px;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">You're confirmed, ${clientName}!</h1>
<p style="margin:0 0 24px;font-size:15px;color:#888888;line-height:1.6;">Your ${quoteType === "retainer" ? "retainer proposal" : "project quote"} has been accepted. Your production team has been notified and will be in touch shortly.</p>
<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#555555;">Project</p>
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#ffffff;">${description}</p>
<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#555555;">Total</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#d4a853;">${amount}</p>
</div>
<p style="margin:0;font-size:13px;color:#666666;line-height:1.6;">Keep this email for your records. Your team will reach out with next steps.</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}

function emailOwnerNotification({ ownerName, clientName, description, clientEmail }: {
  ownerName: string; clientName: string; description: string; clientEmail: string;
}) {
  return {
    subject: `${clientName} accepted your proposal`,
    html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="padding-bottom:32px;"><span style="font-size:13px;font-weight:700;letter-spacing:0.12em;color:#d4a853;text-transform:uppercase;">CineFlow</span></td></tr>
<tr><td style="background:#111111;border:1px solid #222222;border-radius:12px;padding:36px 32px;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Proposal accepted!</h1>
<p style="margin:0 0 24px;font-size:15px;color:#888888;line-height:1.6;">Hi ${ownerName}, <strong style="color:#ffffff;">${clientName}</strong> has signed off on your proposal.</p>
<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#555555;">Project</p>
<p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#ffffff;">${description}</p>
<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#555555;">Client</p>
<p style="margin:0;font-size:14px;color:#ffffff;">${clientName}${clientEmail ? ` &middot; <a href="mailto:${clientEmail}" style="color:#d4a853;text-decoration:none;">${clientEmail}</a>` : ""}</p>
</div>
<p style="margin:0;font-size:13px;color:#666666;">Log in to CineFlow to convert this proposal into a project and send your first invoice.</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}

async function sendQuoteEmails(supabase: ReturnType<typeof getAdminClient>, quoteId: string, acceptedName: string, acceptedEmail?: string) {
  try {
    if (!resend) return;

    const { data: quote } = await supabase
      .from("quotes")
      .select("description, client_name, created_by, quote_type, amount, monthly_rate, retainer_months")
      .eq("id", quoteId)
      .single();

    if (!quote) return;

    const description = quote.description || quote.client_name || "Your project";
    const amount = quote.quote_type === "retainer"
      ? `${fmt(quote.monthly_rate ?? 0)}/mo × ${quote.retainer_months ?? 1} months`
      : fmt(quote.amount ?? 0);

    // Email the client if they provided an address
    if (acceptedEmail) {
      const tpl = emailClientConfirmation({
        clientName: acceptedName,
        description,
        quoteType: quote.quote_type,
        amount,
      });
      await resend.emails.send({ from: FROM, to: acceptedEmail, subject: tpl.subject, html: tpl.html });
    }

    // Email the owner
    if (quote.created_by) {
      const { data: { user: ownerUser } } = await supabase.auth.admin.getUserById(quote.created_by);
      if (ownerUser?.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, full_name")
          .eq("id", quote.created_by)
          .single();
        const ownerName = (profile as any)?.full_name
          || [(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ")
          || "there";
        const tpl = emailOwnerNotification({
          ownerName,
          clientName: acceptedName,
          description,
          clientEmail: acceptedEmail ?? "",
        });
        await resend.emails.send({ from: FROM, to: ownerUser.email, subject: tpl.subject, html: tpl.html });
      }
    }
  } catch {
    // Non-fatal — don't fail the acceptance if email fails
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name, email, declined } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: quote } = await supabase
      .from("quotes")
      .select("id, status")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (["accepted", "declined"].includes(quote.status)) {
      return NextResponse.json({ ok: true, already: true });
    }

    if (declined) {
      await supabase
        .from("quotes")
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
        })
        .eq("id", quote.id);
      return NextResponse.json({ ok: true, status: "declined" });
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email?.trim() ?? null;

    await supabase
      .from("quotes")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_name: trimmedName,
        accepted_email: trimmedEmail,
      })
      .eq("id", quote.id);

    // Fire-and-forget email notifications
    sendQuoteEmails(supabase, quote.id, trimmedName, trimmedEmail ?? undefined);

    return NextResponse.json({ ok: true, status: "accepted" });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
