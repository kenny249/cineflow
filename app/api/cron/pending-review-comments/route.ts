import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { emailOwnerPendingComments, type PendingComment } from "@/lib/email-templates";

// Runs daily (vercel.json schedule). Safety net for client comments that never
// got bundled into an Approve/Request Changes email — i.e. the client left
// notes and closed the tab without submitting a verdict. Sends ONE digest per
// revision, not one email per comment, and marks them notified so they're
// never included twice (the terminal-action path in /api/review/[token]
// already marks comments notified the moment a verdict IS submitted, so this
// cron only ever picks up genuine stragglers).

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ skipped: true, reason: "no RESEND_API_KEY" });
  const resend = new Resend(resendKey);
  const FROM = process.env.RESEND_FROM_EMAIL ?? "CineFlow <notifications@usecineflow.com>";
  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

  const supabase = getAdmin();

  const { data: pending, error } = await supabase
    .from("revision_comments")
    .select("id, revision_id, content, timestamp_seconds, created_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[cron/pending-review-comments] db error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ digestsSent: 0 });
  }

  // Group by revision
  const byRevision = new Map<string, typeof pending>();
  for (const c of pending) {
    if (!byRevision.has(c.revision_id)) byRevision.set(c.revision_id, []);
    byRevision.get(c.revision_id)!.push(c);
  }

  let digestsSent = 0;

  for (const [revisionId, comments] of byRevision) {
    try {
      const { data: revision } = await supabase
        .from("revisions")
        .select("id, title, project_id")
        .eq("id", revisionId)
        .single();
      if (!revision) continue;

      const [{ data: project }, { data: token }] = await Promise.all([
        supabase.from("projects").select("id, title, created_by").eq("id", revision.project_id).single(),
        supabase.from("review_tokens").select("client_name").eq("project_id", revision.project_id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!project?.created_by) continue;

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", project.created_by)
        .single();
      if (!ownerProfile?.email) continue;

      const commentPayload: PendingComment[] = comments.map((c) => ({ content: c.content, timestamp_seconds: c.timestamp_seconds }));
      const template = emailOwnerPendingComments({
        projectTitle: project.title,
        revisionTitle: revision.title,
        clientName: token?.client_name ?? "Your client",
        comments: commentPayload,
        reviewUrl: `${appUrl}/revisions?project=${project.id}&revision=${revisionId}`,
      });

      const { error: sendError } = await resend.emails.send({
        from: FROM,
        to: ownerProfile.email,
        subject: template.subject,
        html: template.html,
      });

      if (sendError) {
        console.error("[cron/pending-review-comments] send failed:", sendError, "revision:", revisionId);
        continue;
      }

      await supabase.from("revision_comments")
        .update({ notified_at: new Date().toISOString() })
        .in("id", comments.map((c) => c.id));

      digestsSent++;
    } catch (err) {
      console.error("[cron/pending-review-comments] error for revision", revisionId, err);
    }
  }

  return NextResponse.json({ digestsSent, commentsProcessed: pending.length });
}
