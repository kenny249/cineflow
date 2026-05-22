import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Profile } from "@/types";

export const dynamic = "force-dynamic";

// ── helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso.split("T")[0] + "T12:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const TERMS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

// ── page ───────────────────────────────────────────────────────────────────

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  if (!invoice) {
    return <div className="p-8 text-center text-zinc-500">Invoice not found.</div>;
  }

  const inv = invoice as Invoice;
  const prof = profile as Profile | null;

  const accent = inv.brand_color ?? prof?.brand_color ?? "#d4a853";
  const lineItems = inv.line_items ?? [];
  const subtotal = lineItems.length > 0
    ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
    : inv.amount;
  const discountAmt = inv.discount ?? 0;
  const afterDiscount = subtotal - discountAmt;
  const taxRate = inv.tax_rate ?? 0;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;
  const balanceDue = total - (inv.amount_paid ?? 0);

  const bizName = prof?.business_name || prof?.company || prof?.full_name || "Your Studio";
  const bizEmail = prof?.email ?? "";
  const bizPhone = prof?.business_phone ?? "";
  const bizWebsite = prof?.business_website ?? "";
  const logoUrl = prof?.logo_url;
  const addrParts = [
    prof?.address_line1,
    prof?.address_line2,
    [prof?.city, prof?.state, prof?.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const bizAddress = addrParts.length > 0 ? addrParts.join(", ") : (prof?.business_address ?? "");

  const ps = (prof?.payment_settings ?? {}) as Record<string, string>;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Invoice {inv.invoice_number}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, -apple-system, sans-serif; background: #f4f4f5; }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white; }
            .no-print { display: none !important; }
            .invoice-wrap { box-shadow: none !important; }
          }
          .page { padding: 32px 16px; min-height: 100vh; }
          .invoice-wrap { max-width: 760px; margin: 0 auto; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.15); overflow: hidden; }
          .header { background: #18181b; padding: 32px 40px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo { width: 56px; height: 56px; object-fit: contain; border-radius: 6px; margin-bottom: 10px; }
          .biz-name { color: white; font-size: 17px; font-weight: 700; }
          .biz-detail { color: #a1a1aa; font-size: 12px; margin-top: 3px; }
          .inv-label { font-size: 32px; font-weight: 900; text-align: right; letter-spacing: -1px; }
          .inv-num { color: white; font-weight: 700; font-size: 13px; text-align: right; margin-top: 4px; font-family: monospace; }
          .inv-meta { color: #a1a1aa; font-size: 11px; text-align: right; margin-top: 3px; }
          .accent-bar { height: 4px; }
          .bill-section { background: #f4f4f5; padding: 20px 40px; border-bottom: 1px solid #e4e4e7; }
          .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #71717a; margin-bottom: 6px; }
          .client-name { font-size: 18px; font-weight: 700; color: #18181b; }
          .client-detail { font-size: 13px; color: #71717a; margin-top: 4px; }
          .items-section { padding: 24px 40px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          thead th { border-bottom: 1px solid #e4e4e7; padding-bottom: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #71717a; }
          thead th:first-child { text-align: left; }
          thead th:not(:first-child) { text-align: right; }
          tbody td { padding: 12px 0; border-bottom: 1px solid #f4f4f5; vertical-align: top; }
          tbody td:first-child { text-align: left; color: #18181b; }
          tbody td:not(:first-child) { text-align: right; color: #71717a; }
          tbody td:last-child { color: #18181b; font-weight: 500; }
          .col-qty { width: 50px; }
          .col-rate { width: 90px; }
          .col-amt { width: 90px; }
          .totals { display: flex; justify-content: flex-end; padding: 16px 40px 0; }
          .totals-inner { width: 260px; }
          .tot-row { display: flex; justify-content: space-between; font-size: 13px; color: #71717a; margin-bottom: 6px; }
          .tot-final { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #18181b; border-top: 1px solid #e4e4e7; padding-top: 10px; margin-top: 6px; }
          .discount { color: #22c55e; }
          .payment-section { padding: 20px 40px; border-top: 1px solid #e4e4e7; margin-top: 20px; }
          .pay-block { background: #f4f4f5; border-radius: 8px; padding: 12px 16px; margin-top: 10px; }
          .pay-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #71717a; margin-bottom: 6px; }
          .pay-val { font-size: 13px; color: #18181b; }
          .pay-row { display: flex; gap: 16px; font-size: 12px; margin-bottom: 4px; }
          .pay-key { color: #71717a; min-width: 60px; }
          .pay-data { font-weight: 600; color: #18181b; }
          .paid-badge { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #22c55e; }
          .notes-section { padding: 16px 40px; }
          .notes-text { font-size: 13px; color: #71717a; line-height: 1.6; white-space: pre-line; }
          .footer { background: #f4f4f5; border-top: 1px solid #e4e4e7; padding: 14px 40px; text-align: center; font-size: 11px; color: #71717a; }
          .no-print { text-align: center; padding: 20px; }
          .print-btn { display: inline-flex; align-items: center; gap: 8px; background: #18181b; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; }
        `}</style>
        {/* Auto-print when opened in a popup/new tab */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('load', function() {
            if (window.opener || window.name === 'invoice-print') {
              setTimeout(function() { window.print(); }, 400);
            }
          });
        `}} />
      </head>
      <body>
        <div className="page">
          {/* Toolbar — hidden when printing */}
          <div className="no-print" style={{ textAlign: "center", marginBottom: 20 }}>
            <button className="print-btn" id="save-btn">
              Save as PDF / Print
            </button>
            <script dangerouslySetInnerHTML={{ __html: `
              document.getElementById('save-btn').addEventListener('click', function() { window.print(); });
            `}} />
          </div>

          <div className="invoice-wrap">
            {/* Header */}
            <div className="header">
              <div>
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={bizName} className="logo" />
                )}
                <div className="biz-name">{bizName}</div>
                {bizAddress && <div className="biz-detail">{bizAddress}</div>}
                {bizPhone && <div className="biz-detail">{bizPhone}</div>}
                {bizEmail && <div className="biz-detail">{bizEmail}</div>}
                {bizWebsite && <div className="biz-detail">{bizWebsite}</div>}
              </div>
              <div>
                <div className="inv-label" style={{ color: accent }}>INVOICE</div>
                <div className="inv-num">{inv.invoice_number}</div>
                {inv.po_number && <div className="inv-meta">PO: {inv.po_number}</div>}
                <div className="inv-meta">Issued: {fmtDate(inv.invoice_date ?? inv.created_at?.split("T")[0])}</div>
                {inv.due_date && <div className="inv-meta">Due: {fmtDate(inv.due_date)}</div>}
                {inv.payment_terms && (
                  <div className="inv-meta" style={{ color: accent, fontWeight: 700 }}>
                    {TERMS[inv.payment_terms] ?? inv.payment_terms}
                  </div>
                )}
              </div>
            </div>

            {/* Accent bar */}
            <div className="accent-bar" style={{ background: accent }} />

            {/* Bill To */}
            <div className="bill-section">
              <div className="section-label">Bill To</div>
              <div className="client-name">{inv.client_name || "Client"}</div>
              {inv.client_email && <div className="client-detail">{inv.client_email}</div>}
              {inv.client_address && (
                <div className="client-detail" style={{ whiteSpace: "pre-line" }}>{inv.client_address}</div>
              )}
              {inv.description && <div className="client-detail" style={{ fontStyle: "italic", marginTop: 6 }}>{inv.description}</div>}
            </div>

            {/* Line Items */}
            <div className="items-section">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="col-qty">Qty</th>
                    <th className="col-rate">Rate</th>
                    <th className="col-amt">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length > 0 ? lineItems.map((li, i) => (
                    <tr key={li.id ?? i}>
                      <td>{li.description || "-"}</td>
                      <td>{li.quantity}</td>
                      <td>{fmt(li.rate)}</td>
                      <td>{fmt(li.quantity * li.rate)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td>{inv.description || "Services rendered"}</td>
                      <td>1</td>
                      <td>{fmt(inv.amount)}</td>
                      <td>{fmt(inv.amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="totals">
                <div className="totals-inner">
                  {lineItems.length > 0 && (
                    <div className="tot-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  )}
                  {discountAmt > 0 && (
                    <div className="tot-row discount"><span>Discount</span><span>-{fmt(discountAmt)}</span></div>
                  )}
                  {taxRate > 0 && (
                    <div className="tot-row"><span>Tax ({taxRate}%)</span><span>{fmt(taxAmount)}</span></div>
                  )}
                  {(inv.amount_paid ?? 0) > 0 && inv.status !== "paid" && (
                    <div className="tot-row discount"><span>Amount Paid</span><span>-{fmt(inv.amount_paid)}</span></div>
                  )}
                  <div className="tot-final">
                    <span>{inv.status === "paid" ? "Total Paid" : (inv.amount_paid ?? 0) > 0 ? "Balance Due" : "Total Due"}</span>
                    <span style={{ color: inv.status === "paid" ? "#22c55e" : accent }}>
                      {fmt(inv.status === "paid" ? total : balanceDue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="payment-section">
              <div className="section-label">Payment</div>
              {inv.status === "paid" ? (
                <div className="paid-badge" style={{ marginTop: 8 }}>
                  ✓ Paid in full
                  {inv.paid_date && <span style={{ fontSize: 13, fontWeight: 400, color: "#71717a" }}> — {fmtDate(inv.paid_date)}</span>}
                </div>
              ) : (
                <>
                  {inv.payment_link && (
                    <div className="pay-block">
                      <div className="pay-title">Pay Online</div>
                      <div className="pay-val">{inv.payment_link}</div>
                    </div>
                  )}
                  {ps.zelle_contact && (
                    <div className="pay-block">
                      <div className="pay-title">Pay via Zelle</div>
                      <div className="pay-val">{ps.zelle_contact}</div>
                    </div>
                  )}
                  {ps.ach_routing && ps.ach_account && (
                    <div className="pay-block">
                      <div className="pay-title">ACH Bank Transfer</div>
                      {ps.ach_bank_name && <div className="pay-row"><span className="pay-key">Bank</span><span className="pay-data">{ps.ach_bank_name}</span></div>}
                      <div className="pay-row"><span className="pay-key">Routing</span><span className="pay-data">{ps.ach_routing}</span></div>
                      <div className="pay-row"><span className="pay-key">Account</span><span className="pay-data">{ps.ach_account}</span></div>
                    </div>
                  )}
                  {ps.wire_instructions && (
                    <div className="pay-block">
                      <div className="pay-title">Wire Transfer</div>
                      <div className="pay-val" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{ps.wire_instructions}</div>
                    </div>
                  )}
                  {(ps.check_payable_to || ps.check_mail_to) && (
                    <div className="pay-block">
                      <div className="pay-title">Pay by Check</div>
                      {ps.check_payable_to && <div className="pay-val">Make payable to: {ps.check_payable_to}</div>}
                      {ps.check_mail_to && <div className="pay-val">Mail to: {ps.check_mail_to}</div>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            {inv.notes && (
              <div className="notes-section">
                <div className="section-label" style={{ marginBottom: 6 }}>Notes</div>
                <div className="notes-text">{inv.notes}</div>
              </div>
            )}

            {/* Footer */}
            <div className="footer">
              Thank you for your business &mdash; {bizName}
              {bizEmail && ` · ${bizEmail}`}
              {inv.po_number && ` · PO: ${inv.po_number}`}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
