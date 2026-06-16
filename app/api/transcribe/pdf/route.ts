import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { TranscriptPDFDocument } from "@/lib/transcript-pdf";
import {
  MeetingSummaryPDFDocument,
  KeyTakeawaysPDFDocument,
  CutListPDFDocument,
} from "@/lib/ai-pdf";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text, filename, duration, aiContent } = await req.json();

  try {
    let buffer: Buffer;
    let downloadName: string;
    const baseName = (filename ?? "cineflow").replace(/[^a-z0-9\-_ ]/gi, "").trim();

    if (aiContent?.type === "meeting_summary") {
      buffer = await renderToBuffer(
        createElement(MeetingSummaryPDFDocument, { filename: filename ?? "Summary", data: aiContent }) as any
      );
      downloadName = `${baseName}-meeting-summary.pdf`;
    } else if (aiContent?.type === "key_takeaways") {
      buffer = await renderToBuffer(
        createElement(KeyTakeawaysPDFDocument, { filename: filename ?? "Takeaways", data: aiContent }) as any
      );
      downloadName = `${baseName}-key-takeaways.pdf`;
    } else if (aiContent?.type === "cut_list") {
      buffer = await renderToBuffer(
        createElement(CutListPDFDocument, { filename: filename ?? "Cut List", data: aiContent }) as any
      );
      downloadName = `${baseName}-cut-list.pdf`;
    } else {
      if (!text) return NextResponse.json({ error: "No transcript text provided" }, { status: 400 });
      buffer = await renderToBuffer(
        createElement(TranscriptPDFDocument, { text, filename: filename ?? "Transcript", duration: duration ?? null }) as any
      );
      downloadName = `${baseName}-transcript.pdf`;
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
      },
    });
  } catch (err) {
    console.error("[transcribe/pdf]", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
