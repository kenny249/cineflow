import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET  /api/review/[token]  → return portal data for the client page
// POST /api/review/[token]  → submit a client comment on a revision
// PATCH /api/review/[token] → client action: approve or request_changes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("review_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Update last_viewed_at (fire-and-forget)
  supabase
    .from("review_tokens")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .then(() => {});

  const { data: project } = await supabase
    .from("projects")
    .select("id,title,description,client_name,status,type,shoot_date,due_date,thumbnail_url,created_at,updated_at,progress,tags,created_by")
    .eq("id", tokenRow.project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { data: revisions } = await supabase
    .from("revisions")
    .select("*, revision_comments(*)")
    .eq("project_id", tokenRow.project_id)
    .in("status", ["in_review", "revisions_requested", "approved", "final"])
    .order("version_number", { ascending: false });

  const mappedRevisions = (revisions ?? []).map((r: any) => ({
    ...r,
    comments: ((r.revision_comments ?? []) as any[]).sort(
      (a: any, b: any) => (a.timestamp_seconds ?? 0) - (b.timestamp_seconds ?? 0)
    ),
  }));

  return NextResponse.json({
    project,
    revisions: mappedRevisions,
    clientName: tokenRow.client_name,
    clientEmail: tokenRow.client_email,
    tokenId: tokenRow.id,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("review_tokens")
    .select("id, project_id, client_name, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  let body: { revision_id: string; content: string; timestamp_seconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { revision_id, content, timestamp_seconds } = body;
  if (!revision_id || !content?.trim()) {
    return NextResponse.json({ error: "revision_id and content are required" }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "Comment too long (max 5000 characters)" }, { status: 400 });
  }

  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, title, version_number")
    .eq("id", revision_id)
    .eq("project_id", tokenRow.project_id)
    .single();

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  const { data: comment, error: commentError } = await supabase
    .from("revision_comments")
    .insert({
      revision_id,
      content: content.trim(),
      timestamp_seconds: timestamp_seconds ?? null,
      author_name: tokenRow.client_name,
    })
    .select()
    .single();

  if (commentError) {
    console.error("[review comment]", commentError);
    return NextResponse.json({ error: "Failed to save comment" }, { status: 500 });
  }

  // Auto-update revision status to revisions_requested if it was in_review
  await supabase
    .from("revisions")
    .update({ status: "revisions_requested", updated_at: new Date().toISOString() })
    .eq("id", revision_id)
    .eq("status", "in_review");

  return NextResponse.json({ comment }, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // Validate token
  const { data: tokenRow, error: tokenError } = await supabase
    .from("review_tokens")
    .select("id, project_id, client_name, client_email, is_active")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }

  let body: { action: "approve" | "request_changes"; revision_id: string; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, revision_id, feedback } = body;
  if (!action || !revision_id) {
    return NextResponse.json({ error: "action and revision_id are required" }, { status: 400 });
  }
  if (action === "request_changes" && !feedback?.trim()) {
    return NextResponse.json({ error: "feedback is required for request_changes" }, { status: 400 });
  }

  // Verify revision belongs to this project
  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, title, version_number")
    .eq("id", revision_id)
    .eq("project_id", tokenRow.project_id)
    .single();

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  // Get project + owner info
  const { data: project } = await supabase
    .from("projects")
    .select("id, title, created_by")
    .eq("id", tokenRow.project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Update revision status
  const newStatus = action === "approve" ? "approved" : "revisions_requested";
  const { error: updateError } = await supabase
    .from("revisions")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", revision_id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update revision" }, { status: 500 });
  }

  // Create in-app notification for the project owner
  const notifTitle = action === "approve"
    ? `${tokenRow.client_name} approved "${revision.title}"`
    : `${tokenRow.client_name} requested changes on "${revision.title}"`;
  const notifDescription = action === "approve"
    ? `Ready to mark as Final and deliver.`
    : feedback?.slice(0, 120) ?? "Check the review hub for details.";

  await supabase.from("notifications").insert({
    user_id: project.created_by,
    type: action === "approve" ? "revision_approved" : "revision_uploaded",
    title: notifTitle,
    description: notifDescription,
    href: `/revisions`,
  }).then(() => {});

  // Try to get owner email from profiles for email notification
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", project.created_by)
    .single();

  const ownerEmail = ownerProfile?.email as string | null;
  const reviewUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com"}/revisions`;

  // Send owner email notification (fire-and-forget, non-blocking)
  if (ownerEmail) {
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com"}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: action === "approve" ? "client_approved" : "client_requested_changes",
        to: ownerEmail,
        clientName: tokenRow.client_name,
        clientEmail: tokenRow.client_email,
        projectTitle: project.title,
        revisionTitle: revision.title,
        versionNumber: revision.version_number,
        portalUrl: reviewUrl,
        feedback: feedback ?? "",
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
