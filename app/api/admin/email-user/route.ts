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

export async function POST(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, subject, message } = await req.json();
  if (!userId || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "userId, subject, and message are required" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "Email not configured" }, { status: 500 });
  }

  const admin = getAdmin();
  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const email = authData?.user?.email;
  if (!email) return NextResponse.json({ error: "User email not found" }, { status: 404 });

  const { data: profile } = await admin.from("profiles").select("first_name, last_name").eq("id", userId).single();
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || email.split("@")[0];

  const callerName = [caller.first_name, caller.last_name].filter(Boolean).join(" ") || "CineFlow Support";

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "CineFlow <notifications@usecineflow.com>",
    to: email,
    subject,
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#080808;color:#e4e4e4;padding:40px 20px;max-width:600px;margin:0 auto;">
      <p style="font-size:14px;color:#a1a1aa;">Hi ${name},</p>
      <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">${message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>
      <hr style="border:none;border-top:1px solid #27272a;margin:32px 0;" />
      <p style="font-size:12px;color:#52525b;">${callerName} · CineFlow<br/>
      <a href="https://www.usecineflow.com" style="color:#d4a853;">usecineflow.com</a></p>
    </body></html>`,
  });

  if (error) {
    console.error("[api/admin/email-user]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction({
    actorId: caller.id,
    action: "email_user",
    targetId: userId,
    targetType: "user",
    metadata: { subject },
  });

  return NextResponse.json({ ok: true, to: email });
}
