import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer");
import { createElement } from "react";
import { StoryboardPdfDocument } from "@/lib/storyboard-pdf";
import type { StoryboardPdfSettings } from "@/lib/storyboard-pdf";
import type { StoryboardFrame } from "@/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    frames?: StoryboardFrame[];
    settings?: StoryboardPdfSettings;
    projectTitle?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { frames = [], settings, projectTitle = "Storyboard" } = body;
  if (!settings) {
    return NextResponse.json({ error: "settings required" }, { status: 400 });
  }

  try {
    const doc = createElement(StoryboardPdfDocument, {
      frames,
      settings,
      projectTitle,
    });

    const buffer: Buffer = await renderToBuffer(doc);

    const filename = `storyboard-${projectTitle
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}-${Date.now()}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (err) {
    console.error("[storyboard/export]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
