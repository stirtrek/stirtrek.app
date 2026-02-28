import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile && ["admin", "staff"].includes(profile.role);

  if (isAdmin) {
    // Admins: count unread emergency messages
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("emergency_messages")
      .select("*", { count: "exact", head: true })
      .eq("status", "unresponded");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  }

  // Attendees: count unread replies to their messages
  const { data: myMessages } = await supabase
    .from("emergency_messages")
    .select("id")
    .eq("user_id", user.id);

  const messageIds = (myMessages ?? []).map((m) => m.id);

  if (messageIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const { count, error } = await supabase
    .from("emergency_replies")
    .select("*", { count: "exact", head: true })
    .in("message_id", messageIds)
    .eq("is_read", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
