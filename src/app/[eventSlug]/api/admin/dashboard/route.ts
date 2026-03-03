import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/dashboard", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    // Total registered users for this event
    const { count: totalUsers } = await admin
      .from("event_memberships")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    // Users with completed profiles (have first_name) in this event
    const { data: memberIds } = await admin
      .from("event_memberships")
      .select("user_id")
      .eq("event_id", eventId);

    const userIds = (memberIds ?? []).map((m) => m.user_id);

    let completedProfiles = 0;
    let sponsorAccounts = 0;

    if (userIds.length > 0) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("id", userIds)
        .not("first_name", "is", null);
      completedProfiles = count ?? 0;
    }

    // Sponsor accounts for this event
    const { count: sponsorCount } = await admin
      .from("event_memberships")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("is_sponsor", true);
    sponsorAccounts = sponsorCount ?? 0;

    // Total leads scanned at this event
    const { count: totalLeads } = await admin
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);

    // Session bookmarks for this event
    const { data: bookmarks } = await admin
      .from("personal_schedule")
      .select("session_id")
      .eq("event_id", eventId);

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
        .in("id", topSessionIds)
        .eq("event_id", eventId);

      topSessions = (sessions ?? [])
        .map((s) => ({
          id: s.id,
          title: s.title,
          count: sessionBookmarkCounts[s.id] || 0,
        }))
        .sort((a, b) => b.count - a.count);
    }

    // Users with at least one bookmark for this event
    const { data: bookmarkUsers } = await admin
      .from("personal_schedule")
      .select("user_id")
      .eq("event_id", eventId);
    const uniqueBookmarkerCount = new Set(
      (bookmarkUsers ?? []).map((b) => b.user_id),
    ).size;

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      completedProfiles,
      sponsorAccounts,
      totalLeads: totalLeads ?? 0,
      totalBookmarks: bookmarks?.length ?? 0,
      uniqueBookmarkers: uniqueBookmarkerCount,
      topSessions,
    });
  });
}
