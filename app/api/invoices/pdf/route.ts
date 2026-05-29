import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type RGB } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Profile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const TERMS: Record<string, string> = {
  due_on_receipt: "Due on Receipt",
  net15: "Net 15",
  net30: "Net 30",
  net60: "Net 60",
};

// ─── PDF builder ──────────────────────────────────────────────────────────────

async function buildInvoicePdf(
  invoice: Invoice,
  profile: Profile | null,
  logoBase64?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Letter: 612 × 792 pt
  const W = 612;
  const H = 792;
  const page = pdfDoc.addPage([W, H]);
  const M = 40; // horizontal margin
  const CW = W - M * 2; // content width

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const accentHex = invoice.brand_color ?? profile?.brand_color ?? "#d4a853";
  const accentColor = hexToRgb(accentHex);
  const headerHex = invoice.header_color ?? "#18181b";
  const darkBg = hexToRgb(headerHex);
  const lightBg = rgb(0.961, 0.961, 0.965); // #f4f4f5
  const borderColor = rgb(0.894, 0.894, 0.902); // #e4e4e7
  const mutedText = rgb(0.443, 0.443, 0.478); // #71717a
  const bodyText = rgb(0.094, 0.094, 0.106);
  const white = rgb(1, 1, 1);

  // Business info
  const bizName =
    profile?.business_name || profile?.company || profile?.full_name || "Your Studio";
  const bizEmail = profile?.email ?? "";
  const bizPhone = profile?.business_phone ?? "";
  const bizWebsite = profile?.business_website ?? "";
  const addrParts = [
    profile?.address_line1,
    profile?.address_line2,
    [profile?.city, profile?.state, profile?.zip].filter(Boolean).join(", "),
  ].filter(Boolean);
  const bizAddress = addrParts.join(", ") || (profile?.business_address ?? "");

  // Line items / totals
  const lineItems = invoice.line_items ?? [];
  const subtotal =
    lineItems.length > 0
      ? lineItems.reduce((s, li) => s + li.quantity * li.rate, 0)
      : invoice.amount;
  const discountAmt = invoice.discount ?? 0;
  const taxRate = invoice.tax_rate ?? 0;
  const afterDiscount = subtotal - discountAmt;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;
  const amtPaid = invoice.amount_paid ?? 0;
  const balanceDue = total - amtPaid;

  let y = H; // current vertical position (top of page, decreasing)

  // ── Header background ──
  const headerH = 110;
  page.drawRectangle({
    x: 0,
    y: H - headerH,
    width: W,
    height: headerH,
    color: darkBg,
  });

  // Logo (PNG or JPEG only)
  if (logoBase64) {
    try {
      let logoImg;
      if (logoBase64.includes("image/png")) {
        logoImg = await pdfDoc.embedPng(logoBase64);
      } else {
        logoImg = await pdfDoc.embedJpg(logoBase64);
      }
      const logoSize = 44;
      page.drawImage(logoImg, {
        x: M,
        y: H - headerH + (headerH - logoSize) / 2 + 4,
        width: logoSize,
        height: logoSize,
      });
    } catch {
      // skip unembeddable logo
    }
  }

  // Business text (left side of header)
  const logoOffset = logoBase64 ? 52 : 0;
  let bizY = H - 26;
  page.drawText(bizName, {
    x: M + logoOffset,
    y: bizY,
    size: 11,
    font: bold,
    color: white,
  });
  bizY -= 14;
  for (const line of [bizAddress, bizPhone, bizEmail, bizWebsite].filter(Boolean)) {
    page.drawText(line, { x: M + logoOffset, y: bizY, size: 8, font: regular, color: rgb(0.635, 0.635, 0.659) });
    bizY -= 11;
  }

  // "INVOICE" label (right side of header)
  const invLabel = "INVOICE";
  const invLabelW = bold.widthOfTextAtSize(invLabel, 24);
  page.drawText(invLabel, {
    x: W - M - invLabelW,
    y: H - 30,
    size: 24,
    font: bold,
    color: accentColor,
  });

  const numLines: [string, string][] = [
    [invoice.invoice_number, ""],
    ...(invoice.po_number ? [["PO: " + invoice.po_number, ""] as [string, string]] : []),
    ["Issued: " + fmtDate(invoice.invoice_date ?? invoice.created_at?.split("T")[0]), ""],
    ...(invoice.due_date ? [["Due: " + fmtDate(invoice.due_date), ""] as [string, string]] : []),
    ...(invoice.payment_terms ? [[TERMS[invoice.payment_terms] ?? invoice.payment_terms, ""] as [string, string]] : []),
  ];
  let metaY = H - 58;
  for (let i = 0; i < numLines.length; i++) {
    const [txt] = numLines[i];
    const isFirst = i === 0;
    const f = isFirst ? bold : regular;
    const sz = isFirst ? 10 : 8;
    const col = i === numLines.length - 1 && invoice.payment_terms ? accentColor :
                isFirst ? white : rgb(0.635, 0.635, 0.659);
    const tw = f.widthOfTextAtSize(txt, sz);
    page.drawText(txt, { x: W - M - tw, y: metaY, size: sz, font: f, color: col });
    metaY -= isFirst ? 13 : 11;
  }

  y = H - headerH;

  // ── Accent bar ──
  page.drawRectangle({ x: 0, y: y - 4, width: W, height: 4, color: accentColor });
  y -= 4;

  // ── Bill To ──
  const billH = 64;
  page.drawRectangle({ x: 0, y: y - billH, width: W, height: billH, color: lightBg });
  page.drawLine({ start: { x: 0, y: y - billH }, end: { x: W, y: y - billH }, thickness: 0.5, color: borderColor });

  let billY = y - 16;
  page.drawText("BILL TO", { x: M, y: billY, size: 7, font: bold, color: mutedText });
  billY -= 13;
  page.drawText(invoice.client_name || "Client", { x: M, y: billY, size: 13, font: bold, color: bodyText });
  billY -= 12;
  for (const line of [invoice.client_email, invoice.client_address].filter(Boolean)) {
    page.drawText(line!, { x: M, y: billY, size: 8, font: regular, color: mutedText });
    billY -= 10;
  }
  y -= billH;

  // ── Line items header ──
  y -= 20;
  const colDesc = M;
  const colQty = W - M - 200;
  const colRate = W - M - 130;
  const colAmt = W - M - 60;

  page.drawText("DESCRIPTION", { x: colDesc, y, size: 7, font: bold, color: mutedText });
  page.drawText("QTY", { x: colQty, y, size: 7, font: bold, color: mutedText });
  page.drawText("RATE", { x: colRate, y, size: 7, font: bold, color: mutedText });
  page.drawText("AMOUNT", { x: colAmt, y, size: 7, font: bold, color: mutedText });
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: borderColor });
  y -= 4;

  // ── Line items rows ──
  const rows =
    lineItems.length > 0
      ? lineItems
      : [{ description: invoice.description || "Services rendered", quantity: 1, rate: invoice.amount, id: "0" }];

  for (const li of rows) {
    y -= 14;
    const descMaxW = colQty - colDesc - 8;
    // Truncate description if too long
    let desc = li.description || "-";
    while (desc.length > 3 && regular.widthOfTextAtSize(desc, 9) > descMaxW) {
      desc = desc.slice(0, -4) + "...";
    }
    page.drawText(desc, { x: colDesc, y, size: 9, font: regular, color: bodyText });
    page.drawText(String(li.quantity), { x: colQty, y, size: 9, font: regular, color: mutedText });
    page.drawText(fmt(li.rate), { x: colRate, y, size: 9, font: regular, color: mutedText });
    const amtTxt = fmt(li.quantity * li.rate);
    page.drawText(amtTxt, { x: colAmt, y, size: 9, font: bold, color: bodyText });
    y -= 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.3, color: lightBg });
  }

  // ── Totals ──
  y -= 16;
  const totX = W - M - 220;
  const totValX = W - M;

  const totRows: [string, string, boolean, RGB?][] = [];
  if (lineItems.length > 0) totRows.push(["Subtotal", fmt(subtotal), false]);
  if (discountAmt > 0) totRows.push(["Discount", "-" + fmt(discountAmt), false, rgb(0.133, 0.773, 0.369)]);
  if (taxRate > 0) totRows.push([`Tax (${taxRate}%)`, fmt(taxAmount), false]);
  if (amtPaid > 0 && invoice.status !== "paid") {
    totRows.push(["Amount Paid", "-" + fmt(amtPaid), false, rgb(0.133, 0.773, 0.369)]);
  }
  const finalLabel =
    invoice.status === "paid" ? "Total Paid" : amtPaid > 0 ? "Balance Due" : "Total Due";
  const finalAmt = invoice.status === "paid" ? total : balanceDue;
  const finalColor = invoice.status === "paid" ? rgb(0.133, 0.773, 0.369) : accentColor;
  totRows.push([finalLabel, fmt(finalAmt), true, finalColor]);

  for (const [label, val, isFinal, col] of totRows) {
    if (isFinal) {
      y -= 6;
      page.drawLine({ start: { x: totX, y }, end: { x: W - M, y }, thickness: 0.5, color: borderColor });
      y -= 10;
    }
    const lw = (isFinal ? bold : regular).widthOfTextAtSize(label, isFinal ? 11 : 9);
    const vw = (isFinal ? bold : regular).widthOfTextAtSize(val, isFinal ? 11 : 9);
    page.drawText(label, {
      x: totValX - vw - 130,
      y,
      size: isFinal ? 11 : 9,
      font: isFinal ? bold : regular,
      color: col ?? mutedText,
    });
    page.drawText(val, {
      x: totValX - vw,
      y,
      size: isFinal ? 11 : 9,
      font: isFinal ? bold : regular,
      color: col ?? mutedText,
    });
    y -= isFinal ? 16 : 12;
  }

  // ── Payment ──
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: borderColor });
  y -= 14;
  page.drawText("PAYMENT", { x: M, y, size: 7, font: bold, color: mutedText });
  y -= 12;

  if (invoice.status === "paid") {
    const paidTxt = "PAID IN FULL" + (invoice.paid_date ? "  -  " + fmtDate(invoice.paid_date) : "");
    page.drawText(paidTxt, { x: M, y, size: 11, font: bold, color: rgb(0.133, 0.773, 0.369) });
    y -= 14;
  } else {
    const ps = (profile?.payment_settings ?? {}) as Record<string, string>;
    const payBlocks: [string, string[]][] = [];
    if (invoice.payment_link) payBlocks.push(["Pay Online", [invoice.payment_link]]);
    if (ps.zelle_contact) payBlocks.push(["Pay via Zelle", [ps.zelle_contact]]);
    if (ps.ach_routing && ps.ach_account) {
      const lines = [];
      if (ps.ach_bank_name) lines.push("Bank: " + ps.ach_bank_name);
      lines.push("Routing: " + ps.ach_routing, "Account: " + ps.ach_account);
      payBlocks.push(["ACH Bank Transfer", lines]);
    }
    if (ps.wire_instructions) payBlocks.push(["Wire Transfer", [ps.wire_instructions]]);
    if (ps.check_payable_to || ps.check_mail_to) {
      const lines = [];
      if (ps.check_payable_to) lines.push("Payable to: " + ps.check_payable_to);
      if (ps.check_mail_to) lines.push("Mail to: " + ps.check_mail_to);
      payBlocks.push(["Check", lines]);
    }

    for (const [title, lines] of payBlocks) {
      page.drawRectangle({ x: M, y: y - lines.length * 11 - 16, width: CW, height: lines.length * 11 + 22, color: lightBg, borderColor, borderWidth: 0.5 });
      page.drawText(title.toUpperCase(), { x: M + 10, y: y - 4, size: 7, font: bold, color: mutedText });
      for (let i = 0; i < lines.length; i++) {
        let ln = lines[i];
        while (ln.length > 3 && regular.widthOfTextAtSize(ln, 8.5) > CW - 20) {
          ln = ln.slice(0, -4) + "...";
        }
        page.drawText(ln, { x: M + 10, y: y - 18 - i * 11, size: 8.5, font: regular, color: bodyText });
      }
      y -= lines.length * 11 + 28;
    }
  }

  // ── Notes ──
  if (invoice.notes) {
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: borderColor });
    y -= 14;
    page.drawText("NOTES", { x: M, y, size: 7, font: bold, color: mutedText });
    y -= 12;
    const words = invoice.notes.split(" ");
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (regular.widthOfTextAtSize(test, 8.5) > CW) {
        page.drawText(line, { x: M, y, size: 8.5, font: regular, color: mutedText });
        y -= 12;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      page.drawText(line, { x: M, y, size: 8.5, font: regular, color: mutedText });
      y -= 12;
    }
  }

  // ── Footer ──
  const footerH = 30;
  const footerY = Math.min(y - 16, footerH + 4);
  page.drawRectangle({ x: 0, y: 0, width: W, height: footerH, color: lightBg });
  page.drawLine({ start: { x: 0, y: footerH }, end: { x: W, y: footerH }, thickness: 0.5, color: borderColor });
  const footerTxt = "Thank you for your business" +
    (bizName ? " - " + bizName : "") +
    (bizEmail ? " - " + bizEmail : "");
  const ftw = regular.widthOfTextAtSize(footerTxt, 7.5);
  page.drawText(footerTxt, {
    x: Math.max(M, (W - ftw) / 2),
    y: 11,
    size: 7.5,
    font: regular,
    color: mutedText,
  });

  void footerY; // used for layout planning

  return pdfDoc.save();
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("id");
  if (!invoiceId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: invoice, error: invErr }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  if (invErr || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let logoBase64: string | undefined;
  if (profile?.logo_url) {
    try {
      const res = await fetch(profile.logo_url);
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("png") || ct.includes("jpeg") || ct.includes("jpg")) {
          const buf = await res.arrayBuffer();
          logoBase64 = `data:${ct};base64,${Buffer.from(buf).toString("base64")}`;
        }
      }
    } catch {
      // skip logo if unreachable
    }
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await buildInvoicePdf(invoice as Invoice, profile as Profile | null, logoBase64);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pdf] build failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const slug = (invoice as Invoice).invoice_number
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  return new NextResponse(pdfBytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
    },
  });
}
