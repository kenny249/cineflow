import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { emailLifetimeGift } from "@/lib/email-templates";

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
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

// PATCH — update a user's plan or other profile fields
export async function PATCH(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, updates } = await req.json();
  if (!userId || !updates) return NextResponse.json({ error: "userId and updates required" }, { status: 400 });

  // Prevent admins from revoking their own admin status
  if ("is_admin" in updates && updates.is_admin === false && userId === caller.id) {
    return NextResponse.json({ error: "You cannot revoke your own admin access." }, { status: 403 });
  }

  const admin = getAdmin();

  // Normalize lifetime plan updates so status and interval are always correct
  const normalizedUpdates = updates.plan === "lifetime"
    ? { ...updates, plan_status: "active", plan_interval: "lifetime" }
    : updates;

  const { error } = await admin
    .from("profiles")
    .update({ ...normalizedUpdates, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("[api/admin/users PATCH]", error.message);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  // Send lifetime gift email inline — awaited so it completes before the response
  let emailResult: { sent: boolean; to?: string; error?: string } = { sent: false };
  if (updates.plan === "lifetime") {
    try {
      if (!process.env.RESEND_API_KEY) {
        emailResult = { sent: false, error: "RESEND_API_KEY not set" };
      } else {
        const [{ data: authData, error: authErr }, { data: profile }] = await Promise.all([
          admin.auth.admin.getUserById(userId),
          admin.from("profiles").select("first_name, last_name").eq("id", userId).single(),
        ]);
        if (authErr) {
          emailResult = { sent: false, error: `auth lookup failed: ${authErr.message}` };
        } else {
          const email = authData?.user?.email;
          if (!email) {
            emailResult = { sent: false, error: "no email on auth user" };
          } else {
            const name =
              [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
              email.split("@")[0];
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { subject, html } = emailLifetimeGift({
              recipientName: name,
              loginUrl: "https://www.usecineflow.com/login",
            });
            const { data: sent, error: sendErr } = await resend.emails.send({
              from: "CineFlow <notifications@usecineflow.com>",
              to: email,
              subject,
              html,
            });
            if (sendErr) {
              console.error("[api/admin/users PATCH] Resend error:", sendErr);
              emailResult = { sent: false, to: email, error: sendErr.message };
            } else {
              emailResult = { sent: true, to: email };
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[api/admin/users PATCH] lifetime email exception:", msg);
      emailResult = { sent: false, error: msg };
    }
  }

  return NextResponse.json({ success: true, email: emailResult });
}

// DELETE — permanently delete a user and all their data
export async function DELETE(req: NextRequest) {
  const caller = await requireAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const admin = getAdmin();

  // Safety: never delete an admin account
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
  if (profile?.is_admin) return NextResponse.json({ error: "Cannot delete an admin account" }, { status: 403 });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("[api/admin/users DELETE]", error.message);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
