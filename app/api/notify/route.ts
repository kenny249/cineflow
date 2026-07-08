import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailPortalLive,
  emailRevisionReady,
  emailFeedbackReceived,
  emailApproved,
  emailFinalDelivery,
  emailStageUpdate,
  emailOwnerClientApproved,
  emailOwnerClientRequestedChanges,
  emailOwnerClientCommented,
  emailDeployConfirmation,
} from "@/lib/email-templates";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL ?? "CineFlow <notifications@usecineflow.com>";

export type NotifyEvent =
  | "portal_live"
  | "revision_ready"
  | "feedback_received"
  | "approved"
  | "final_delivery"
  | "stage_update"
  | "client_approved"
  | "client_requested_changes"
  | "client_commented"
  | "deploy_confirmed";

export interface NotifyPayload {
  event: NotifyEvent;
  // Recipient — defaults to clientEmail, use `to` to override (e.g. owner notifications)
  to?: string;
  clientName: string;
  clientEmail: string;
  projectTitle: string;
  revisionTitle?: string;
  versionNumber?: number;
  portalUrl: string;
  // Stage update extras
  stageName?: string;
  stageDescription?: string;
  // Owner notification extras
  ownerName?: string;
  feedback?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Allow unauthenticated calls only for client_approved / client_requested_changes
  // (these originate from the public portal page)
  let body: NotifyPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isOwnerEvent = body.event === "client_approved" || body.event === "client_requested_changes" || body.event === "client_commented";
  if (!user && !isOwnerEvent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For unauthenticated client events, validate portalUrl domain and derive the
  // owner email from the DB — never trust the user-supplied `to` field.
  if (!user && isOwnerEvent) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com";
    const allowedHost = new URL(siteUrl).hostname;
    let parsedPortal: URL;
    try {
      parsedPortal = new URL(body.portalUrl);
      if (parsedPortal.hostname !== allowedHost) {
        return NextResponse.json({ error: "Invalid portal URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid portal URL" }, { status: 400 });
    }

    // Extract token from /review/[token] and look up the real owner email
    const token = parsedPortal.pathname.split("/").filter(Boolean).pop();
    if (!token) return NextResponse.json({ error: "Invalid portal URL" }, { status: 400 });

    const admin = createAdminClient();
    const { data: tokenRow } = await admin
      .from("review_tokens")
      .select("created_by")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", tokenRow.created_by)
      .single();

    if (!ownerProfile?.email) return NextResponse.json({ error: "Owner not found" }, { status: 400 });

    // Override recipient with verified owner email — ignore user-supplied `to`
    body.to = ownerProfile.email;
  }

  if (!resend) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const {
    event,
    to,
    clientName,
    clientEmail,
    projectTitle,
    revisionTitle,
    versionNumber,
    portalUrl,
    stageName,
    stageDescription,
    ownerName,
    feedback,
  } = body;

  const recipient = to ?? clientEmail;

  if (!event || !recipient || !projectTitle || !portalUrl) {
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
    case "stage_update":
      template = emailStageUpdate({
        clientName,
        projectTitle,
        stageName: stageName ?? "Next Phase",
        stageDescription: stageDescription ?? "Your production team is moving things forward.",
        portalUrl,
      });
      break;
    case "client_approved":
      template = emailOwnerClientApproved({
        projectTitle,
        revisionTitle: revisionTitle ?? "Revision",
        clientName,
        reviewUrl: portalUrl,
      });
      break;
    case "client_requested_changes":
      template = emailOwnerClientRequestedChanges({
        projectTitle,
        revisionTitle: revisionTitle ?? "Revision",
        clientName,
        feedback: feedback ?? "(no details provided)",
        reviewUrl: portalUrl,
      });
      break;
    case "client_commented":
      template = emailOwnerClientCommented({
        projectTitle,
        revisionTitle: revisionTitle ?? "Revision",
        clientName,
        feedback: feedback ?? "(no details provided)",
        reviewUrl: portalUrl,
      });
      break;
    case "deploy_confirmed":
      template = emailDeployConfirmation({
        projectTitle,
        revisionTitle: revisionTitle ?? "Revision",
        versionNumber: versionNumber ?? 1,
        clientName,
        clientEmail,
        portalUrl,
      });
      break;
    default:
      return NextResponse.json({ error: "Unknown event" }, { status: 400 });
  }

  try {
    const { data: sendData, error } = await resend.emails.send({
      from: FROM,
      to: recipient,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error("[notify] Resend error:", JSON.stringify(error), "| event:", event, "| from:", FROM, "| to:", recipient);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[notify] sent ok:", sendData?.id, "| event:", event, "| to:", recipient);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify] Resend threw:", err instanceof Error ? err.message : String(err), "| event:", event, "| from:", FROM, "| to:", recipient);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
