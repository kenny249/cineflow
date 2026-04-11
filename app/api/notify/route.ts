import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  emailPortalLive,
  emailRevisionReady,
  emailFeedbackReceived,
  emailApproved,
  emailFinalDelivery,
} from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? "notifications@usecineflow.com";

export type NotifyEvent =
  | "portal_live"
  | "revision_ready"
  | "feedback_received"
  | "approved"
  | "final_delivery";

export interface NotifyPayload {
  event: NotifyEvent;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  revisionTitle?: string;
  versionNumber?: number;
  portalUrl: string;
}

export async function POST(req: NextRequest) {
  if (!resend) {
    // No API key configured — log and return success so callers don't break
    console.warn("[notify] RESEND_API_KEY not set — email skipped");
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: NotifyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, clientName, clientEmail, projectTitle, revisionTitle, versionNumber, portalUrl } = body;

  if (!event || !clientEmail || !projectTitle || !portalUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let template: { subject: string; html: string };

  switch (event) {
    case "portal_live":
      template = emailPortalLive({ clientName, projectTitle, portalUrl });
      break;
    case "revision_ready":
      template = emailRevisionReady({
        clientName,
        projectTitle,
        revisionTitle: revisionTitle ?? "New Revision",
        versionNumber: versionNumber ?? 1,
        portalUrl,
      });
      break;
    case "feedback_received":
      template = emailFeedbackReceived({ clientName, projectTitle, portalUrl });
      break;
    case "approved":
      template = emailApproved({
        clientName,
        projectTitle,
        revisionTitle: revisionTitle ?? "Revision",
        portalUrl,
      });
      break;
    case "final_delivery":
      template = emailFinalDelivery({ clientName, projectTitle, portalUrl });
      break;
    default:
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: clientEmail,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error("[notify] Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
