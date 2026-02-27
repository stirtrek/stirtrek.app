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

  // Total registered users
  const { count: totalUsers } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // Users with completed profiles (have first_name)
  const { count: completedProfiles } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("first_name", "is", null);

  // Sponsor accounts
  const { count: sponsorAccounts } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_sponsor", true);

  // Total leads scanned
  const { count: totalLeads } = await admin
    .from("leads")
    .select("*", { count: "exact", head: true });

  // Session bookmarks: get counts per session
  const { data: bookmarks } = await admin
    .from("personal_schedule")
    .select("session_id");

  const sessionBookmarkCounts: Record<string, number> = {};
  for (const b of bookmarks ?? []) {
    sessionBookmarkCounts[b.session_id] =
      (sessionBookmarkCounts[b.session_id] || 0) + 1;
  }

  // Get session details for the top bookmarked sessions
  const topSessionIds = Object.entries(sessionBookmarkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  let topSessions: { id: string; title: string; count: number }[] = [];

  if (topSessionIds.length > 0) {
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, title")
      .in("id", topSessionIds);

    topSessions = (sessions ?? [])
      .map((s) => ({
        id: s.id,
        title: s.title,
        count: sessionBookmarkCounts[s.id] || 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Users with at least one bookmark
  const uniqueBookmarkers = new Set((bookmarks ?? []).map((b) => b.session_id));
  // Actually we need user_id for unique bookmarkers
  const { data: bookmarkUsers } = await admin
    .from("personal_schedule")
    .select("user_id");
  const uniqueBookmarkerCount = new Set(
    (bookmarkUsers ?? []).map((b) => b.user_id)
  ).size;

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    completedProfiles: completedProfiles ?? 0,
    sponsorAccounts: sponsorAccounts ?? 0,
    totalLeads: totalLeads ?? 0,
    totalBookmarks: bookmarks?.length ?? 0,
    uniqueBookmarkers: uniqueBookmarkerCount,
    topSessions,
  });
}
