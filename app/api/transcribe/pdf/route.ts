import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { TranscriptPDFDocument } from "@/lib/transcript-pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, filename, duration } = await req.json();
  if (!text) return NextResponse.json({ error: "No transcript text provided" }, { status: 400 });

  try {
    const buffer = await renderToBuffer(
      createElement(TranscriptPDFDocument, { text, filename: filename ?? "Transcript", duration: duration ?? null }) as any
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${(filename ?? "transcript").replace(/[^a-z0-9\-_ ]/gi, "")}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[transcribe/pdf]", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
