import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { stripe, PLANS } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { planId, interval } = await req.json() as {
      planId: string;
      interval: "month" | "year" | "lifetime";
    };

    const plan = PLANS[planId as keyof typeof PLANS];
    if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 });

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.usecineflow.com").trim();

    let priceId: string;
    let mode: "subscription" | "payment";

    if (planId === "lifetime") {
      if (!("oneTime" in plan) || !plan.oneTime) {
        return NextResponse.json({ error: "Lifetime price not configured" }, { status: 500 });
      }
      priceId = plan.oneTime;
      mode = "payment";
    } else {
      const monthlyOrAnnual = interval === "year" ? plan.annual : plan.monthly;
      if (!monthlyOrAnnual) {
        return NextResponse.json({ error: "Price not configured" }, { status: 500 });
      }
      priceId = monthlyOrAnnual as string;
      mode = "subscription";
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, planId, interval },
      success_url: `${siteUrl}/dashboard?upgraded=true`,
      cancel_url: `${siteUrl}/upgrade`,
      ...(mode === "subscription" && {
        subscription_data: { metadata: { userId: user.id, planId } },
      }),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[api/stripe/checkout]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
