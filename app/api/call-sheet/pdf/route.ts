import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { CallSheetPDFDocument } from "@/lib/call-sheet-pdf";
import type { ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function urlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { project, profile, formData, crew, locations, sheet } = await req.json();

  // Verify the caller has access to this project (RLS handles owner + collaborators)
  const { data: projectCheck } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project?.id)
    .single();
  if (!projectCheck) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Pre-fetch logo images as base64 so react-pdf doesn't fetch external URLs
    // (Supabase storage URLs can fail when fetched from Vercel's server environment)
    const [logoData, clientLogoData] = await Promise.all([
      profile?.logo_url ? urlToDataUri(profile.logo_url) : Promise.resolve(null),
      project?.client_logo_url ? urlToDataUri(project.client_logo_url) : Promise.resolve(null),
    ]);

    const pdfProfile = profile ? { ...profile, logo_url: logoData ?? undefined } : profile;
    const pdfProject = { ...project, client_logo_url: clientLogoData ?? undefined };

    const element = createElement(CallSheetPDFDocument, {
      project: pdfProject, profile: pdfProfile, formData, crew, locations, sheet,
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
    const msg = err?.message || String(err) || "unknown error";
    console.error("[call-sheet/pdf] renderToBuffer failed:", msg, err?.stack);
    return NextResponse.json({ error: `PDF render failed: ${msg}` }, { status: 500 });
  }
}
