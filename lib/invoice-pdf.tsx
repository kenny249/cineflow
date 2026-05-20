import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Invoice, Profile } from "@/types";

const DEFAULT_ACCENT = "#d4a853";
const DARK  = "#18181b";
const GRAY  = "#71717a";
const LIGHT = "#f4f4f5";
const WHITE = "#ffffff";
const BORDER = "#e4e4e7";
const GREEN  = "#22c55e";

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  invoice: Invoice;
  profile: Profile | null;
  logoBase64?: string;
}

export function InvoicePdfDocument({ invoice, profile, logoBase64 }: Props) {
  const accent = invoice.brand_color ?? profile?.brand_color ?? DEFAULT_ACCENT;

  const lineItems = invoice.line_items ?? [];
  const subtotal = lineItems.length > 0
    ? lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0)
    : invoice.amount;
  const discountAmt = invoice.discount ?? 0;
  const taxRate = invoice.tax_rate ?? 0;
  const afterDiscount = subtotal - discountAmt;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;
  const balanceDue = total - (invoice.amount_paid ?? 0);

  const bizName = profile?.business_name || profile?.company || profile?.full_name || "Your Studio";
  const bizEmail = profile?.email ?? "";
  const bizPhone = profile?.business_phone ?? "";
  const bizWebsite = profile?.business_website ?? "";
  const logoUrl = logoBase64 || undefined;

  const addrParts = [
    profile?.address_line1,
    profile?.address_line2,
    [profile?.city, profile?.state, profile?.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const bizAddress = addrParts.length > 0 ? addrParts.join(", ") : (profile?.business_address ?? "");

  const ps = (profile?.payment_settings ?? {}) as Record<string, string>;

  const showSig = !!invoice.show_signature_lines; // default false
  const showRights = !!invoice.show_rights_notice;
  const rightsText = invoice.rights_notice_text ||
    "All delivered content remains the exclusive property of the creator until payment is received in full. Usage rights are granted only upon cleared payment.";

  const s = StyleSheet.create({
    page:        { fontFamily: "Helvetica", backgroundColor: WHITE, padding: 0 },
    // ── Header
    header:      { backgroundColor: DARK, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 28 },
    headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    logo:        { width: 56, height: 56, objectFit: "contain", borderRadius: 6, marginBottom: 8 },
    bizName:     { fontSize: 15, fontFamily: "Helvetica-Bold", color: WHITE },
    bizDetail:   { fontSize: 8, color: "#a1a1aa", marginTop: 2 },
    invLabel:    { fontSize: 30, fontFamily: "Helvetica-Bold", color: accent, textAlign: "right" },
    invNum:      { fontSize: 10, fontFamily: "Helvetica-Bold", color: WHITE, textAlign: "right", marginTop: 4 },
    invMeta:     { fontSize: 8, color: "#a1a1aa", textAlign: "right", marginTop: 2 },
    accentMeta:  { fontSize: 8, fontFamily: "Helvetica-Bold", color: accent, textAlign: "right", marginTop: 3 },
    // Accent bar under header
    accentBar:   { height: 3, backgroundColor: accent },
    // ── Bill To
    billTo:      { backgroundColor: LIGHT, paddingHorizontal: 40, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
    billToRow:   { flexDirection: "row", justifyContent: "space-between" },
    sectionLbl:  { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 },
    billName:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK },
    billDetail:  { fontSize: 9, color: GRAY, marginTop: 3 },
    billRight:   { alignItems: "flex-end" },
    // ── Items
    items:       { paddingHorizontal: 40, paddingTop: 22 },
    thRow:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingBottom: 7, marginBottom: 2 },
    thCell:      { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 1 },
    tdRow:       { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 9 },
    tdCell:      { fontSize: 10, color: DARK },
    tdGray:      { fontSize: 10, color: GRAY },
    col1:        { flex: 1 },
    col2:        { width: 40, textAlign: "right" },
    col3:        { width: 70, textAlign: "right" },
    col4:        { width: 70, textAlign: "right" },
    // ── Totals
    totals:      { alignItems: "flex-end", paddingHorizontal: 40, paddingTop: 14 },
    totRow:      { flexDirection: "row", justifyContent: "space-between", width: 210, marginBottom: 5 },
    totLabel:    { fontSize: 10, color: GRAY },
    totVal:      { fontSize: 10, color: DARK },
    totDiscount: { fontSize: 10, color: "#22c55e" },
    divider:     { borderTopWidth: 1, borderTopColor: BORDER, width: 210, marginVertical: 6 },
    totFinal:    { flexDirection: "row", justifyContent: "space-between", width: 210, paddingTop: 6 },
    totFinalLbl: { fontSize: 13, fontFamily: "Helvetica-Bold", color: DARK },
    totFinalVal: { fontSize: 13, fontFamily: "Helvetica-Bold" },
    // ── Payment
    payment:     { paddingHorizontal: 40, paddingVertical: 18, borderTopWidth: 1, borderTopColor: BORDER, marginTop: 18 },
    payBlock:    { backgroundColor: LIGHT, borderRadius: 6, padding: 11, marginTop: 8 },
    payTitle:    { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 5 },
    payVal:      { fontSize: 10, color: DARK },
    payRow:      { flexDirection: "row", gap: 20, marginBottom: 4 },
    payKey:      { fontSize: 9, color: GRAY, width: 60 },
    payData:     { fontSize: 9, fontFamily: "Helvetica-Bold", color: DARK, flex: 1 },
    paidBadge:   { flexDirection: "row", alignItems: "center", gap: 6 },
    paidText:    { fontSize: 13, fontFamily: "Helvetica-Bold", color: GREEN },
    paidDate:    { fontSize: 10, color: GRAY },
    // ── Notes
    notes:       { paddingHorizontal: 40, paddingBottom: 18 },
    noteText:    { fontSize: 9, color: GRAY, lineHeight: 1.5 },
    // ── Rights
    rights:      { paddingHorizontal: 40, paddingBottom: 14 },
    rightsBox:   { borderWidth: 1, borderColor: BORDER, borderRadius: 5, padding: 10, backgroundColor: LIGHT },
    rightsText:  { fontSize: 8, color: GRAY, lineHeight: 1.6 },
    // ── Signature lines
    sigSection:  { paddingHorizontal: 40, paddingBottom: 24 },
    sigRow:      { flexDirection: "row", gap: 32, marginTop: 6 },
    sigBlock:    { flex: 1 },
    sigLine:     { borderBottomWidth: 1, borderBottomColor: DARK, height: 28 },
    sigLabel:    { fontSize: 8, color: GRAY, marginTop: 4 },
    // ── Footer
    footer:      { backgroundColor: LIGHT, paddingHorizontal: 40, paddingVertical: 12, borderTopWidth: 1, borderTopColor: BORDER, marginTop: "auto" },
    footerText:  { fontSize: 8, color: GRAY, textAlign: "center" },
  });

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerRow}>
            {/* Left: logo + biz info */}
            <View>
              {logoUrl ? (
                <Image src={logoUrl} style={s.logo} />
              ) : null}
              <Text style={s.bizName}>{bizName}</Text>
              {bizAddress ? <Text style={s.bizDetail}>{bizAddress}</Text> : null}
              {bizPhone   ? <Text style={s.bizDetail}>{bizPhone}</Text>   : null}
              {bizEmail   ? <Text style={s.bizDetail}>{bizEmail}</Text>   : null}
              {bizWebsite ? <Text style={s.bizDetail}>{bizWebsite}</Text> : null}
            </View>
            {/* Right: INVOICE + meta */}
            <View>
              <Text style={s.invLabel}>INVOICE</Text>
              <Text style={s.invNum}>{invoice.invoice_number}</Text>
              {invoice.po_number ? (
                <Text style={s.invMeta}>PO: {invoice.po_number}</Text>
              ) : null}
              <Text style={s.invMeta}>Issued: {fmtDate(invoice.invoice_date ?? invoice.created_at?.split("T")[0])}</Text>
              {invoice.due_date ? <Text style={s.invMeta}>Due: {fmtDate(invoice.due_date)}</Text> : null}
              {invoice.payment_terms ? (
                <Text style={s.accentMeta}>{TERMS_LABEL[invoice.payment_terms] ?? invoice.payment_terms}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Accent bar */}
        <View style={s.accentBar} />

        {/* Bill To */}
        <View style={s.billTo}>
          <View style={s.billToRow}>
            <View>
              <Text style={s.sectionLbl}>Bill To</Text>
              <Text style={s.billName}>{invoice.client_name || "Client"}</Text>
              {invoice.client_email ? <Text style={s.billDetail}>{invoice.client_email}</Text> : null}
              {invoice.client_address ? (
                <Text style={s.billDetail}>{invoice.client_address}</Text>
              ) : null}
              {invoice.description ? <Text style={[s.billDetail, { marginTop: 6, fontFamily: "Helvetica-Oblique" }]}>{invoice.description}</Text> : null}
            </View>
          </View>
        </View>

        {/* Line Items */}
        <View style={s.items}>
          <View style={s.thRow}>
            <Text style={[s.thCell, s.col1]}>Description</Text>
            <Text style={[s.thCell, s.col2]}>Qty</Text>
            <Text style={[s.thCell, s.col3]}>Rate</Text>
            <Text style={[s.thCell, s.col4]}>Amount</Text>
          </View>
          {lineItems.length > 0 ? lineItems.map((li, i) => (
            <View key={li.id ?? i} style={s.tdRow}>
              <Text style={[s.tdCell, s.col1]}>{li.description || "—"}</Text>
              <Text style={[s.tdGray, s.col2]}>{li.quantity}</Text>
              <Text style={[s.tdGray, s.col3]}>{fmt(li.rate)}</Text>
              <Text style={[s.tdCell, s.col4]}>{fmt(li.quantity * li.rate)}</Text>
            </View>
          )) : (
            <View style={s.tdRow}>
              <Text style={[s.tdCell, s.col1]}>{invoice.description || "Services rendered"}</Text>
              <Text style={[s.tdGray, s.col2]}>1</Text>
              <Text style={[s.tdGray, s.col3]}>{fmt(invoice.amount)}</Text>
              <Text style={[s.tdCell, s.col4]}>{fmt(invoice.amount)}</Text>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={s.totals}>
          {lineItems.length > 0 && (
            <View style={s.totRow}>
              <Text style={s.totLabel}>Subtotal</Text>
              <Text style={s.totVal}>{fmt(subtotal)}</Text>
            </View>
          )}
          {discountAmt > 0 && (
            <View style={s.totRow}>
              <Text style={s.totDiscount}>Discount</Text>
              <Text style={s.totDiscount}>−{fmt(discountAmt)}</Text>
            </View>
          )}
          {taxRate > 0 && (
            <View style={s.totRow}>
              <Text style={s.totLabel}>Tax ({taxRate}%)</Text>
              <Text style={s.totVal}>{fmt(taxAmount)}</Text>
            </View>
          )}
          {(invoice.amount_paid ?? 0) > 0 && invoice.status !== "paid" && (
            <View style={s.totRow}>
              <Text style={[s.totLabel, { color: GREEN }]}>Amount Paid</Text>
              <Text style={[s.totVal, { color: GREEN }]}>−{fmt(invoice.amount_paid)}</Text>
            </View>
          )}
          <View style={s.divider} />
          <View style={s.totFinal}>
            <Text style={s.totFinalLbl}>
              {invoice.status === "paid" ? "Total Paid" : (invoice.amount_paid ?? 0) > 0 ? "Balance Due" : "Total Due"}
            </Text>
            <Text style={[s.totFinalVal, { color: invoice.status === "paid" ? GREEN : accent }]}>
              {fmt(invoice.status === "paid" ? total : balanceDue)}
            </Text>
          </View>
        </View>

        {/* Payment */}
        <View style={s.payment}>
          <Text style={s.sectionLbl}>Payment</Text>
          {invoice.status === "paid" ? (
            <View style={s.paidBadge}>
              <Text style={s.paidText}>✓ Paid in full</Text>
              {invoice.paid_date ? <Text style={s.paidDate}>— {fmtDate(invoice.paid_date)}</Text> : null}
            </View>
          ) : (
            <>
              {ps.zelle_contact && (
                <View style={s.payBlock}>
                  <Text style={s.payTitle}>Pay via Zelle</Text>
                  <Text style={s.payVal}>{ps.zelle_contact}</Text>
                </View>
              )}
              {ps.ach_routing && ps.ach_account && (
                <View style={s.payBlock}>
                  <Text style={s.payTitle}>ACH Bank Transfer</Text>
                  {ps.ach_bank_name && <View style={s.payRow}><Text style={s.payKey}>Bank</Text><Text style={s.payData}>{ps.ach_bank_name}</Text></View>}
                  <View style={s.payRow}><Text style={s.payKey}>Routing</Text><Text style={s.payData}>{ps.ach_routing}</Text></View>
                  <View style={s.payRow}><Text style={s.payKey}>Account</Text><Text style={s.payData}>{ps.ach_account}</Text></View>
                </View>
              )}
              {ps.wire_instructions && (
                <View style={s.payBlock}>
                  <Text style={s.payTitle}>Wire Transfer</Text>
                  <Text style={[s.payVal, { fontSize: 9 }]}>{ps.wire_instructions}</Text>
                </View>
              )}
              {(ps.check_payable_to || ps.check_mail_to) && (
                <View style={s.payBlock}>
                  <Text style={s.payTitle}>Pay by Check</Text>
                  {ps.check_payable_to && <Text style={s.payVal}>Make payable to: {ps.check_payable_to}</Text>}
                  {ps.check_mail_to && <Text style={[s.payVal, { marginTop: 4 }]}>Mail to: {ps.check_mail_to}</Text>}
                </View>
              )}
            </>
          )}
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={s.notes}>
            <Text style={[s.sectionLbl, { marginBottom: 6 }]}>Notes</Text>
            <Text style={s.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Rights notice */}
        {showRights && (
          <View style={s.rights}>
            <View style={s.rightsBox}>
              <Text style={[s.sectionLbl, { marginBottom: 4 }]}>Rights &amp; Licensing</Text>
              <Text style={s.rightsText}>{rightsText}</Text>
            </View>
          </View>
        )}

        {/* Signature lines */}
        {showSig && (
          <View style={s.sigSection}>
            <Text style={[s.sectionLbl, { marginBottom: 8 }]}>Authorization</Text>
            <View style={s.sigRow}>
              <View style={s.sigBlock}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Authorized Signature</Text>
              </View>
              <View style={s.sigBlock}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Date</Text>
              </View>
              <View style={s.sigBlock}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Client Signature</Text>
              </View>
              <View style={s.sigBlock}>
                <View style={s.sigLine} />
                <Text style={s.sigLabel}>Date</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Thank you for your business — {bizName}{bizEmail ? ` · ${bizEmail}` : ""}
            {invoice.po_number ? ` · PO: ${invoice.po_number}` : ""}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
