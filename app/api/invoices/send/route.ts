import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import type { Invoice, PaymentSettings } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

function buildPaymentInstructions(invoice: Invoice, ps: PaymentSettings, total: number): string {
  const method = invoice.payment_method;
  if (!method) return "";

  if ((method === "stripe" || method === "paypal") && invoice.payment_link) {
    return `
    <div style="margin-top:0;padding:20px 40px 0;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Pay Online</p>
      <a href="${invoice.payment_link}" style="display:inline-block;background:#d4a853;color:#000;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:14px;font-weight:700;">
        Pay ${fmt(total)} Now →
      </a>
    </div>`;
  }

  if (method === "zelle" && ps.zelle_contact) {
    return `
    <div style="border-top:1px solid #f4f4f5;padding:20px 40px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Pay via Zelle</p>
      <table style="font-size:13px;border-collapse:collapse;">
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;white-space:nowrap;">Send to</td><td style="color:#18181b;font-weight:600;">${ps.zelle_contact}</td></tr>
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Amount</td><td style="color:#18181b;font-weight:600;">${fmt(total)}</td></tr>
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Memo</td><td style="color:#18181b;">${invoice.invoice_number}</td></tr>
      </table>
    </div>`;
  }

  if (method === "ach" && (ps.ach_routing || ps.ach_account)) {
    return `
    <div style="border-top:1px solid #f4f4f5;padding:20px 40px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">ACH / Bank Transfer</p>
      <table style="font-size:13px;border-collapse:collapse;">
        ${ps.ach_bank_name ? `<tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;white-space:nowrap;">Bank</td><td style="color:#18181b;font-weight:600;">${ps.ach_bank_name}</td></tr>` : ""}
        ${ps.ach_routing ? `<tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Routing #</td><td style="color:#18181b;font-family:monospace;font-weight:600;">${ps.ach_routing}</td></tr>` : ""}
        ${ps.ach_account ? `<tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Account #</td><td style="color:#18181b;font-family:monospace;font-weight:600;">${ps.ach_account}</td></tr>` : ""}
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Amount</td><td style="color:#18181b;font-weight:600;">${fmt(total)}</td></tr>
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Reference</td><td style="color:#18181b;">${invoice.invoice_number}</td></tr>
      </table>
    </div>`;
  }

  if (method === "wire" && ps.wire_instructions) {
    return `
    <div style="border-top:1px solid #f4f4f5;padding:20px 40px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Wire Transfer</p>
      <pre style="margin:0;font-family:inherit;font-size:13px;color:#3f3f46;white-space:pre-wrap;">${ps.wire_instructions}</pre>
    </div>`;
  }

  if (method === "check" && (ps.check_payable_to || ps.check_mail_to)) {
    return `
    <div style="border-top:1px solid #f4f4f5;padding:20px 40px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Pay by Check</p>
      <table style="font-size:13px;border-collapse:collapse;">
        ${ps.check_payable_to ? `<tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;white-space:nowrap;">Payable to</td><td style="color:#18181b;font-weight:600;">${ps.check_payable_to}</td></tr>` : ""}
        ${ps.check_mail_to ? `<tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;vertical-align:top;">Mail to</td><td style="color:#18181b;font-weight:600;white-space:pre-wrap;">${ps.check_mail_to}</td></tr>` : ""}
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Amount</td><td style="color:#18181b;font-weight:600;">${fmt(total)}</td></tr>
        <tr><td style="color:#a1a1aa;padding:2px 16px 2px 0;">Memo</td><td style="color:#18181b;">${invoice.invoice_number}</td></tr>
      </table>
    </div>`;
  }

  return "";
}

function buildEmailHtml({
  invoice,
  total,
  bizName,
  bizEmail,
  payUrl,
  appUrl,
  paymentSettings,
}: {
  invoice: Invoice;
  total: number;
  bizName: string;
  bizEmail: string;
  payUrl: string;
  appUrl: string;
  paymentSettings: PaymentSettings;
}) {
  const lineItems = invoice.line_items ?? [];
  const subtotal = lineItems.length > 0
    ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
    : invoice.amount;
  const taxRate = invoice.tax_rate ?? 0;
  const taxAmount = subtotal * (taxRate / 100);
  const balanceDue = total - invoice.amount_paid;
  const paymentInstructions = buildPaymentInstructions(invoice, paymentSettings, balanceDue);

  const lineRows = lineItems.length > 0
    ? lineItems.map((li) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#3f3f46;font-size:14px;">${li.description || "—"}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:14px;text-align:right;">${li.quantity}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:14px;text-align:right;">${fmt(li.rate)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#18181b;font-size:14px;font-weight:600;text-align:right;">${fmt(li.quantity * li.rate)}</td>
        </tr>
      `).join("")
    : `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#3f3f46;font-size:14px;">${invoice.description || "Services rendered"}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:14px;text-align:right;">1</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#71717a;font-size:14px;text-align:right;">${fmt(invoice.amount)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #f4f4f5;color:#18181b;font-size:14px;font-weight:600;text-align:right;">${fmt(invoice.amount)}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#18181b;padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <p style="margin:0;font-size:18px;font-weight:700;color:#fff;">${bizName}</p>
        ${bizEmail ? `<p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">${bizEmail}</p>` : ""}
      </div>
      <div style="text-align:right;">
        <p style="margin:0;font-size:28px;font-weight:900;color:#d4a853;letter-spacing:-0.5px;">INVOICE</p>
        <p style="margin:4px 0 0;font-family:monospace;font-size:14px;font-weight:600;color:#fff;">${invoice.invoice_number}</p>
        ${invoice.due_date ? `<p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">Due: ${formatDate(invoice.due_date)}</p>` : ""}
        ${invoice.payment_terms ? `<p style="margin:2px 0 0;font-size:11px;font-weight:600;color:#d4a853;">${TERMS_LABEL[invoice.payment_terms] ?? invoice.payment_terms}</p>` : ""}
      </div>
    </div>

    <!-- Bill To -->
    <div style="background:#fafafa;padding:20px 40px;border-bottom:1px solid #f4f4f5;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Bill To</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${invoice.client_name || "Client"}</p>
    </div>

    <!-- Line Items -->
    <div style="padding:24px 40px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding-bottom:8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;border-bottom:2px solid #e4e4e7;">Description</th>
            <th style="padding-bottom:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;border-bottom:2px solid #e4e4e7;width:48px;">Qty</th>
            <th style="padding-bottom:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;border-bottom:2px solid #e4e4e7;width:96px;">Rate</th>
            <th style="padding-bottom:8px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;border-bottom:2px solid #e4e4e7;width:96px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>

      <!-- Totals -->
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <div style="width:220px;">
          ${lineItems.length > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#71717a;margin-bottom:6px;"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>` : ""}
          ${taxRate > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#71717a;margin-bottom:6px;"><span>Tax (${taxRate}%)</span><span>${fmt(taxAmount)}</span></div>` : ""}
          ${invoice.amount_paid > 0 && invoice.status !== "paid" ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#16a34a;margin-bottom:6px;"><span>Amount Paid</span><span>−${fmt(invoice.amount_paid)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#18181b;border-top:2px solid #e4e4e7;padding-top:10px;">
            <span>${invoice.amount_paid > 0 && invoice.status !== "paid" ? "Balance Due" : "Total Due"}</span>
            <span>${fmt(balanceDue)}</span>
          </div>
        </div>
      </div>
    </div>

    ${invoice.notes ? `
    <div style="border-top:1px solid #f4f4f5;padding:16px 40px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a1a1aa;">Notes</p>
      <p style="margin:0;font-size:13px;color:#71717a;white-space:pre-wrap;">${invoice.notes}</p>
    </div>` : ""}

    ${paymentInstructions}

    <!-- CTA -->
    <div style="padding:32px 40px;text-align:center;border-top:1px solid #f4f4f5;">
      <a href="${payUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;">
        View Invoice →
      </a>
      <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;">
        View online: <a href="${payUrl}" style="color:#71717a;">${payUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:16px 40px;border-top:1px solid #f4f4f5;text-align:center;">
      <p style="margin:0;font-size:11px;color:#a1a1aa;">Sent via <strong>Cineflow</strong> · ${appUrl}</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get profile (needs Resend key + from info + biz name)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, company, email, business_name, payment_settings")
      .eq("id", user.id)
      .single();

    const ps = (profile?.payment_settings ?? {}) as PaymentSettings;

    // Per-user key takes priority; fall back to platform-level env var
    const resendKey = ps.resend_api_key || process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: "Resend API key not configured. Add it in Settings → Invoice Email." },
        { status: 400 }
      );
    }

    // Get invoice
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.client_email) {
      return NextResponse.json(
        { error: "Client email is required to send the invoice. Edit the invoice and add a client email." },
        { status: 400 }
      );
    }

    const inv = invoice as Invoice;
    const lineItems = inv.line_items ?? [];
    const subtotal = lineItems.length > 0
      ? lineItems.reduce((s: number, li: { quantity: number; rate: number }) => s + li.quantity * li.rate, 0)
      : inv.amount;
    const taxRate = inv.tax_rate ?? 0;
    const total = subtotal + subtotal * (taxRate / 100);

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://usecineflow.com";
    const payUrl = `${appUrl}/pay/${invoiceId}`;

    const bizName = profile?.business_name || profile?.company || profile?.full_name || "Studio";
    const bizEmail = profile?.email ?? "";

    // Per-user from settings takes priority, then platform env vars
    const fromName = ps.invoice_from_name || bizName;
    const fromEmail = ps.invoice_from_email || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const resend = new Resend(resendKey);

    console.log(`[invoices/send] Sending invoice ${inv.invoice_number} to ${inv.client_email} from ${fromEmail}`);

    const { error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [inv.client_email as string],
      subject: `Invoice ${inv.invoice_number} from ${bizName} — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)} due`,
      html: buildEmailHtml({ invoice: inv, total, bizName, bizEmail, payUrl, appUrl, paymentSettings: ps }),
    });

    if (emailError) {
      console.error(`[invoices/send] Resend error for invoice ${inv.invoice_number}:`, emailError);
      return NextResponse.json({ error: emailError.message }, { status: 400 });
    }

    console.log(`[invoices/send] Email sent successfully for invoice ${inv.invoice_number}`);

    // Mark as sent (only auto-advance from draft)
    await supabase
      .from("invoices")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("status", "draft");

    return NextResponse.json({ success: true, payUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send invoice";
    console.error("[invoices/send] Unhandled error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
