import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET  /api/review/[token]  → return portal data for the client page
// POST /api/review/[token]  → submit a client comment on a revision

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  // 1. Validate token
  const { data: tokenRow, error: tokenError } = await supabase
    .from("review_tokens")
    .select("*")
    .eq("token", token)
    .eq("is_active", true)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // 2. Update last_viewed_at (fire-and-forget)
  supabase
    .from("review_tokens")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .then(() => {});

  // 3. Load project
  const { data: project } = await supabase
    .from("projects")
    .select("id,title,description,client_name,status,type,shoot_date,due_date,thumbnail_url,created_at,updated_at,progress,tags")
    .eq("id", tokenRow.project_id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // 4. Load revisions visible to client (not draft)
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

  // 1. Validate token
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

  // 2. Verify the revision belongs to this project
  const { data: revision } = await supabase
    .from("revisions")
    .select("id, project_id, title, version_number")
    .eq("id", revision_id)
    .eq("project_id", tokenRow.project_id)
    .single();

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  // 3. Insert comment
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

  // 4. Auto-update revision status to revisions_requested if it was in_review
  await supabase
    .from("revisions")
    .update({ status: "revisions_requested", updated_at: new Date().toISOString() })
    .eq("id", revision_id)
    .eq("status", "in_review");

  return NextResponse.json({ comment }, { status: 201 });
}
