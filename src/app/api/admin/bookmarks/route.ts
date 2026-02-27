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

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get all bookmark counts per session
  const { data: bookmarks } = await admin
    .from("personal_schedule")
    .select("session_id");

  const counts: Record<string, number> = {};
  for (const b of bookmarks ?? []) {
    counts[b.session_id] = (counts[b.session_id] || 0) + 1;
  }

  // Get all non-service sessions with room info
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, title, starts_at, room_id, is_service_session, rooms(name)")
    .eq("is_service_session", false)
    .order("starts_at", { ascending: true });

  const result = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    starts_at: s.starts_at,
    room: s.rooms ? (s.rooms as unknown as { name: string }).name : null,
    bookmarks: counts[s.id] ?? 0,
  }));

  // Sort by bookmark count descending
  result.sort((a, b) => b.bookmarks - a.bookmarks);

  return NextResponse.json({ sessions: result });
}
