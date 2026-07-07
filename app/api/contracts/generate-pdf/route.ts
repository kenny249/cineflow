import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ContractPDFDocument } from "@/lib/contract-pdf";
import type { ContractPDFData, ContractSection } from "@/lib/contract-pdf";

// Force Node.js runtime — react-pdf requires it
export const runtime = "nodejs";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      contractId: string;
      sections: ContractSection[];
      contractTitle: string;
      recipientName: string;
      recipientEmail?: string;
      templateLabel?: string;
    };

    const { contractId, sections, contractTitle, recipientName, recipientEmail, templateLabel } = body;

    if (!contractId || !sections?.length || !contractTitle || !recipientName) {
      return NextResponse.json({ error: "contractId, sections, contractTitle, and recipientName are required" }, { status: 400 });
    }

    // Verify the user owns this contract
    const { data: contract, error: contractErr } = await supabase
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("created_by", user.id)
      .single();

    if (contractErr || !contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Fetch user's profile for studio name / email
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name, company, email")
      .eq("id", user.id)
      .single();

    const studioName =
      profile?.business_name ||
      profile?.company ||
      profile?.full_name ||
      "Studio";

    const studioEmail = profile?.email || undefined;

    const effectiveDate = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const pdfData: ContractPDFData = {
      contractTitle,
      studioName,
      studioEmail,
      recipientName,
      recipientEmail,
      effectiveDate,
      sections,
      templateLabel,
    };

    // Render PDF server-side (cast needed — react-pdf types don't overlap with React generic element)
    const pdfBuffer = await renderToBuffer(
      createElement(ContractPDFDocument, { data: pdfData }) as React.ReactElement<any>
    );

    // Upload to Supabase storage
    const admin = getAdmin();
    const storagePath = `${user.id}/${contractId}-generated.pdf`;

    const { error: uploadErr } = await admin.storage
      .from("contracts")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }

    const { data: { publicUrl } } = admin.storage
      .from("contracts")
      .getPublicUrl(storagePath);

    // Patch the contract record with the file URL
    const { error: patchErr } = await supabase
      .from("contracts")
      .update({ file_url: publicUrl, updated_at: new Date().toISOString() })
      .eq("id", contractId)
      .eq("created_by", user.id);

    if (patchErr) {
      return NextResponse.json({ error: "Failed to attach PDF to contract" }, { status: 500 });
    }

    return NextResponse.json({ file_url: publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
