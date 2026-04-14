import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function dataURLToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function POST(req: NextRequest) {
  const supabase = getAdmin();

  let body: { contractId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contractId } = body;
  if (!contractId) return NextResponse.json({ error: "contractId required" }, { status: 400 });

  // Fetch contract
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .single();

  if (contractErr || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!contract.file_url) {
    return NextResponse.json({ error: "No PDF file attached to contract" }, { status: 400 });
  }

  // Fetch the original PDF
  const pdfRes = await fetch(contract.file_url);
  if (!pdfRes.ok) {
    return NextResponse.json({ error: "Could not fetch PDF" }, { status: 500 });
  }
  const pdfBytes = await pdfRes.arrayBuffer();

  // Load with pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fields: Array<{
    id: string; page: number; x: number; y: number;
    width: number; height: number; role: "sender" | "recipient";
    type?: "signature" | "text" | "date"; value?: string;
  }> = contract.signature_fields ?? [];

  // Fetch recipient signature (maybeSingle so stamp works even before recipient signs)
  const { data: recipientSig } = await supabase
    .from("contract_signatures")
    .select("signer_name, signer_email, signature_data, signed_at")
    .eq("contract_id", contractId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  for (const field of fields) {
    const pageIndex = field.page - 1;
    const pages = pdfDoc.getPages();
    if (pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    if (field.role === "sender" && contract.sender_signature_data) {
      // Stamp sender signature
      try {
        const imgBytes = dataURLToBytes(contract.sender_signature_data);
        const img = await pdfDoc.embedPng(imgBytes).catch(() => pdfDoc.embedJpg(imgBytes));
        page.drawImage(img, {
          x: field.x + 4,
          y: field.y + 8,
          width: field.width - 8,
          height: field.height - 16,
        });
        // Label beneath
        const name = contract.sender_name ?? "Sender";
        const date = contract.sender_signed_at
          ? new Date(contract.sender_signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "";
        page.drawText(`${name}  ·  ${date}`, {
          x: field.x + 4,
          y: field.y - 10,
          size: 7,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
      } catch (e) {
        console.error("Failed to embed sender signature", e);
      }
    }

    // ── Text field ────────────────────────────────────────────────────────────
    if ((field.type === "text" || field.type === "date") && field.value) {
      try {
        page.drawText(field.value, {
          x: field.x + 4,
          y: field.y + field.height / 2 - 5,
          size: 10,
          font: helvetica,
          color: rgb(0.1, 0.1, 0.1),
        });
      } catch (e) {
        console.error("Failed to stamp text field", e);
      }
      continue;
    }

    if (field.role === "recipient" && recipientSig?.signature_data) {
      // Stamp recipient signature
      try {
        const imgBytes = dataURLToBytes(recipientSig.signature_data);
        const img = await pdfDoc.embedPng(imgBytes).catch(() => pdfDoc.embedJpg(imgBytes));
        page.drawImage(img, {
          x: field.x + 4,
          y: field.y + 8,
          width: field.width - 8,
          height: field.height - 16,
        });
        const name = recipientSig.signer_name ?? contract.recipient_name ?? "Recipient";
        const date = recipientSig.signed_at
          ? new Date(recipientSig.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "";
        page.drawText(`${name}  ·  ${date}`, {
          x: field.x + 4,
          y: field.y - 10,
          size: 7,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });
      } catch (e) {
        console.error("Failed to embed recipient signature", e);
      }
    }
  }

  // Add a signature audit footer on the last page
  const lastPage = pdfDoc.getPages().at(-1)!;
  const { width } = lastPage.getSize();
  const now = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
  lastPage.drawText(`Electronically signed via Cineflow  ·  Document ID: ${contractId}  ·  ${now}`, {
    x: 30,
    y: 18,
    size: 6.5,
    font: helvetica,
    color: rgb(0.55, 0.55, 0.55),
  });

  const signedPdfBytes = await pdfDoc.save();

  // Upload signed PDF to Supabase Storage
  const signedPath = `signed/${contractId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("contracts")
    .upload(signedPath, signedPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: "Failed to upload signed PDF" }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("contracts")
    .getPublicUrl(signedPath);

  // Update contract with signed PDF URL
  await supabase
    .from("contracts")
    .update({ signed_pdf_url: publicUrl })
    .eq("id", contractId);

  return NextResponse.json({ signed_pdf_url: publicUrl });
}
