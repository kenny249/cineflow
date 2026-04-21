import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { CallSheetPDFDocument } from "@/lib/call-sheet-pdf";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project, profile, formData, crew, locations, sheet } = await req.json();

  try {
    const element = createElement(CallSheetPDFDocument, {
      project, profile, formData, crew, locations, sheet,
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    const uint8 = new Uint8Array(buffer);

    const slug = (project.title as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const dateStr = formData.shootDate || new Date().toISOString().slice(0, 10);
    const filename = `call-sheet-${slug}-${dateStr}.pdf`;
    const storagePath = `${project.id}/docs/${Date.now()}_${filename}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, uint8, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("[call-sheet/pdf] storage upload failed:", uploadError.message);
      // Non-fatal — still return the PDF for download
    } else {
      // Get public URL and save the project_files record
      const { data: urlData } = supabase.storage
        .from("project-files")
        .getPublicUrl(storagePath);

      await supabase.from("project_files").insert({
        project_id: project.id,
        tab: "docs",
        category: "call-sheets",
        name: filename,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        size: uint8.byteLength,
        mime_type: "application/pdf",
        uploaded_by: user.id,
      });
    }

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (err: any) {
    console.error("[call-sheet/pdf]", err);
    return NextResponse.json({ error: err.message ?? "PDF generation failed" }, { status: 500 });
  }
}
