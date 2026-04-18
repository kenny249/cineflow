import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel invokes cron routes with this header to prove it's a legitimate cron call.
// Set CRON_SECRET in your Vercel environment variables.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // If no secret set, deny all requests
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  let page = 1;

  // Paginate through all users and delete demo accounts older than 24h
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;

    const toDelete = data.users.filter(
      (u) => u.user_metadata?.is_demo === true && u.created_at < cutoff
    );

    for (const user of toDelete) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (!delErr) deleted++;
    }

    // Supabase listUsers doesn't return a hasNextPage — stop when a page returns fewer than perPage
    if (data.users.length < 1000) break;
    page++;
  }

  return NextResponse.json({ deleted });
}
