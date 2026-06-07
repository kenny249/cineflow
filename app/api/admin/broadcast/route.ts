import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { logAdminAction } from "@/lib/admin-audit";

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = getAdmin();
  const { data: profile } = await admin.from("profiles").select("is_admin, first_name, last_name").eq("id", user.id).single();
  return profile?.is_admin ? { ...user, ...profile } : null;
}

export type BroadcastSegment =
  | "all"
  | "trialing"
  | "paid"
  | "trial_expired"
  | "solo"
  | "studio"
  | "agency"
  | "enterprise"
  | "lifetime";

// GET — preview: return count for a segment
export async function GET(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const segment = (req.nextUrl.searchParams.get("segment") ?? "all") as BroadcastSegment;
  const recipients = await getRecipients(segment);
  return NextResponse.json({ count: recipients.length });
}

async function getRecipients(segment: BroadcastSegment): Promise<{ email: string; name: string }[]> {
  const admin = getAdmin();
  const now = new Date().toISOString();

  let profileQuery = admin.from("profiles").select("id, first_name, last_name, plan, plan_status, trial_ends_at");

  if (segment === "trialing") {
    profileQuery = profileQuery.eq("plan_status", "trialing").gt("trial_ends_at", now) as typeof profileQuery;
  } else if (segment === "paid") {
    profileQuery = profileQuery.or("plan_status.eq.active,plan_status.eq.founding,plan.eq.lifetime") as typeof profileQuery;
  } else if (segment === "trial_expired") {
    profileQuery = profileQuery.eq("plan_status", "trialing").lte("trial_ends_at", now) as typeof profileQuery;
  } else if (["solo", "studio", "agency", "enterprise", "lifetime"].includes(segment)) {
    profileQuery = profileQuery.eq("plan", segment) as typeof profileQuery;
  }

  const { data: profiles } = await profileQuery;
  if (!profiles?.length) return [];

  const ids = profiles.map((p) => p.id);
  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  const emailMap = Object.fromEntries(
    (authUsers ?? [])
      .filter((u) => !u.email?.endsWith("@demo.usecineflow.com"))
      .map((u) => [u.id, u.email])
  );

  return profiles
    .filter((p) => ids.includes(p.id) && emailMap[p.id])
    .map((p) => ({
      email: emailMap[p.id]!,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || emailMap[p.id]!.split("@")[0],
    }));
}

// POST — send broadcast
export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const { segment, subject, message } = await req.json() as {
    segment: BroadcastSegment;
    subject: string;
    message: string;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  const recipients = await getRecipients(segment ?? "all");
  if (!recipients.length) {
    return NextResponse.json({ error: "No recipients for this segment" }, { status: 400 });
  }

  const callerName = [
    (caller as Record<string, unknown>).first_name,
    (caller as Record<string, unknown>).last_name,
  ].filter(Boolean).join(" ") || "CineFlow";

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Resend batch limit is 100 per call — send in chunks
  const CHUNK = 100;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    try {
      await resend.batch.send(
        chunk.map(({ email, name }) => ({
          from: "CineFlow <notifications@usecineflow.com>",
          to: email,
          subject,
          html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#080808;color:#e4e4e4;padding:40px 20px;max-width:600px;margin:0 auto;">
            <p style="font-size:14px;color:#a1a1aa;">Hi ${name},</p>
            <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <hr style="border:none;border-top:1px solid #27272a;margin:32px 0;" />
            <p style="font-size:12px;color:#52525b;">${callerName} · CineFlow<br/>
            <a href="https://www.usecineflow.com" style="color:#d4a853;">usecineflow.com</a></p>
          </body></html>`,
        }))
      );
      sent += chunk.length;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown error");
    }
  }

  await logAdminAction({
    actorId: caller.id,
    action: "broadcast_email",
    metadata: { segment, subject, sent, errors: errors.length },
  });

  return NextResponse.json({ ok: true, sent, errors: errors.length > 0 ? errors : undefined });
}
