import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Invoice, PaymentSettings } from "@/types";
import { getPaymentCredentials } from "@/lib/payment-credentials";

// Runs daily at 9 AM UTC (vercel.json schedule).
// Does two things per run:
//  1. Flips sent/partial invoices past their due date → "overdue"
//  2. Sends reminder emails: 3 days before due, day of due, and once when overdue

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

function he(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function buildReminderEmail({
  type,
  invoice,
  bizName,
  bizEmail,
  payUrl,
  appUrl,
  total,
}: {
  type: "due_soon" | "due_today" | "overdue";
  invoice: Invoice;
  bizName: string;
  bizEmail: string;
  payUrl: string;
  appUrl: string;
  total: number;
}) {
  const subjects: Record<typeof type, string> = {
    due_soon:  `Reminder: Invoice ${invoice.invoice_number} is due in 3 days`,
    due_today: `Payment due today: Invoice ${invoice.invoice_number}`,
    overdue:   `Overdue: Invoice ${invoice.invoice_number} — action required`,
  };

  const headlines: Record<typeof type, string> = {
    due_soon:  "Your payment is due soon",
    due_today: "Payment is due today",
    overdue:   "This invoice is past due",
  };

  const accentColors: Record<typeof type, string> = {
    due_soon:  "#d4a853",
    due_today: "#d4a853",
    overdue:   "#ef4444",
  };

  const accent = accentColors[type];
  const headline = headlines[type];
  const dueLabel = invoice.due_date ? formatDate(invoice.due_date) : "";

  return {
    subject: subjects[type],
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#18181b;padding:28px 36px;display:flex;justify-content:space-between;align-items:center;">
      <p style="margin:0;font-size:17px;font-weight:700;color:#fff;">${he(bizName)}</p>
      <p style="margin:0;font-size:22px;font-weight:900;color:${accent};letter-spacing:-0.5px;">INVOICE</p>
    </div>

    <!-- Alert band -->
    <div style="background:${type === "overdue" ? "#fef2f2" : "#fffbeb"};border-bottom:3px solid ${accent};padding:18px 36px;">
      <p style="margin:0;font-size:16px;font-weight:700;color:${type === "overdue" ? "#991b1b" : "#92400e"};">${he(headline)}</p>
      ${dueLabel ? `<p style="margin:4px 0 0;font-size:13px;color:${type === "overdue" ? "#b91c1c" : "#a16207"};">
        ${type === "overdue" ? "Was due" : "Due"}: ${dueLabel}
      </p>` : ""}
    </div>

    <!-- Invoice summary -->
    <div style="padding:24px 36px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#71717a;">Invoice</td>
          <td style="padding:6px 0;font-weight:600;color:#18181b;text-align:right;font-family:monospace;">${he(invoice.invoice_number)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#71717a;">Client</td>
          <td style="padding:6px 0;font-weight:600;color:#18181b;text-align:right;">${he(invoice.client_name) || "—"}</td>
        </tr>
        ${invoice.description ? `<tr>
          <td style="padding:6px 0;color:#71717a;vertical-align:top;">Description</td>
          <td style="padding:6px 0;color:#3f3f46;text-align:right;">${he(invoice.description)}</td>
        </tr>` : ""}
        <tr style="border-top:2px solid #e4e4e7;">
          <td style="padding:12px 0 6px;font-weight:700;color:#18181b;font-size:16px;">
            ${type === "overdue" ? "Balance Due" : "Total Due"}
          </td>
          <td style="padding:12px 0 6px;font-weight:700;color:${accent};font-size:18px;text-align:right;">${fmt(total)}</td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:8px 36px 32px;text-align:center;">
      <a href="${payUrl}"
         style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
        View Invoice &amp; Pay →
      </a>
      <p style="margin:12px 0 0;font-size:11px;color:#a1a1aa;">
        <a href="${payUrl}" style="color:#71717a;">${payUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:14px 36px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">
        Sent via <strong>CineFlow</strong> · ${appUrl}
        ${bizEmail ? ` · <a href="mailto:${he(bizEmail)}" style="color:#a1a1aa;">${he(bizEmail)}</a>` : ""}
      </p>
    </div>
  </div>
</body>
</html>`,
  };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = getAdmin();
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

  const todayStr = new Date().toISOString().slice(0, 10);
  const in3Days = new Date();
  in3Days.setUTCDate(in3Days.getUTCDate() + 3);
  const in3DaysStr = in3Days.toISOString().slice(0, 10);

  // Fetch all active (unpaid) invoices that have a due date and a client email
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*, created_by, reminders_sent, reminders_enabled")
    .in("status", ["sent", "partial", "overdue"])
    .not("due_date", "is", null)
    .not("client_email", "is", null)
    .neq("reminders_enabled", false);

  if (error) {
    console.error("[cron/invoice-reminders] db error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invoices?.length) {
    return NextResponse.json({ processed: 0 });
  }

  // Batch-load all owner profiles and credentials
  const ownerIds = [...new Set(invoices.map((i) => i.created_by).filter(Boolean))];
  const [{ data: profiles }, { data: credentials }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, company, business_name, email, payment_settings").in("id", ownerIds),
    supabase.from("payment_credentials").select("user_id, resend_api_key").in("user_id", ownerIds),
  ]);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const credMap = Object.fromEntries((credentials ?? []).map((c) => [c.user_id, c]));

  let overdueFlipped = 0;
  let remindersSent = 0;

  for (const inv of invoices as (Invoice & { created_by: string; reminders_sent: Record<string, string> })[]) {
    const reminders: Record<string, string> = inv.reminders_sent ?? {};
    const updates: Record<string, unknown> = {};

    // ── 1. Auto-flip to overdue ──────────────────────────────────────────────
    if (inv.due_date && inv.due_date < todayStr && inv.status !== "overdue") {
      updates.status = "overdue";
      overdueFlipped++;
    }

    // ── 2. Reminder emails ───────────────────────────────────────────────────
    const profile = profileMap[inv.created_by];
    if (!profile || !inv.client_email) continue;

    const ps = (profile.payment_settings ?? {}) as PaymentSettings;
    const resendKey = credMap[inv.created_by]?.resend_api_key || process.env.RESEND_API_KEY;
    if (!resendKey) continue;

    const bizName = profile.business_name || profile.company || profile.full_name || "Your Studio";
    const bizEmail = profile.email ?? "";
    const fromName = (ps as Record<string, string>).invoice_from_name || bizName;
    const fromEmail = (ps as Record<string, string>).invoice_from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const payUrl = `${appUrl}/pay/${inv.id}`;

    const lineItems = inv.line_items ?? [];
    const subtotal = lineItems.length > 0
      ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
      : inv.amount;
    const tax = subtotal * ((inv.tax_rate ?? 0) / 100);
    const total = subtotal + tax - (inv.amount_paid ?? 0);

    const resend = new Resend(resendKey);

    const reminderTypes: { key: string; type: "due_soon" | "due_today" | "overdue"; condition: boolean }[] = [
      {
        key: "due_soon",
        type: "due_soon",
        condition: inv.due_date === in3DaysStr && !reminders.due_soon,
      },
      {
        key: "due_today",
        type: "due_today",
        condition: inv.due_date === todayStr && !reminders.due_today,
      },
      {
        key: "overdue",
        type: "overdue",
        // Send once when overdue (either flipped today or already overdue but reminder not sent)
        condition: (inv.due_date! < todayStr) && !reminders.overdue,
      },
    ];

    for (const { key, type, condition } of reminderTypes) {
      if (!condition) continue;
      try {
        const { subject, html } = buildReminderEmail({
          type,
          invoice: inv,
          bizName,
          bizEmail,
          payUrl,
          appUrl,
          total,
        });
        const { error: emailErr } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [inv.client_email as string],
          subject,
          html,
        });
        if (!emailErr) {
          reminders[key] = todayStr;
          remindersSent++;
        } else {
          console.warn(`[cron/invoice-reminders] email failed for ${inv.id} (${type}):`, emailErr.message);
        }
      } catch (e) {
        console.error(`[cron/invoice-reminders] send error for ${inv.id} (${type}):`, e);
      }
    }

    // Write back any status change or reminder tracking
    updates.reminders_sent = reminders;
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabase.from("invoices").update(updates).eq("id", inv.id);
    }
  }

  return NextResponse.json({ processed: invoices.length, overdueFlipped, remindersSent });
}
