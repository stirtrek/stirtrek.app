import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  // Require auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up order
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, status, event_slug, event_id, tier_id, addon_ids, amount_cents, event_name")
    .eq("stripe_checkout_session_id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    event_slug: order.event_slug,
    event_id: order.event_id,
    event_name: order.event_name,
  });
}
