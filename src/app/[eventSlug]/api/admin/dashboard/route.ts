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

    // Run independent aggregate queries in parallel. Bookmark stats are
    // computed in SQL via RPC so the dashboard doesn't load every row.
    const [
      { count: totalUsers },
      { data: memberIds },
      { count: sponsorCount },
      { count: totalLeads },
      { data: bookmarkStats },
    ] = await Promise.all([
      admin
        .from("event_memberships")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId),
      admin
        .from("event_memberships")
        .select("user_id")
        .eq("event_id", eventId),
      admin
        .from("event_memberships")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("is_sponsor", true),
      admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId),
      admin.rpc("get_event_bookmark_stats", { p_event_id: eventId }),
    ]);

    const userIds = (memberIds ?? []).map((m) => m.user_id);

    let completedProfiles = 0;
    if (userIds.length > 0) {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("id", userIds)
        .not("first_name", "is", null);
      completedProfiles = count ?? 0;
    }

    const statRows = (bookmarkStats ?? []) as Array<{
      total_bookmarks: number | null;
      unique_bookmarkers: number | null;
      top_session_id: string | null;
      top_session_title: string | null;
      top_session_count: number | null;
    }>;

    const totalBookmarks = Number(statRows[0]?.total_bookmarks ?? 0);
    const uniqueBookmarkerCount = Number(statRows[0]?.unique_bookmarkers ?? 0);
    const topSessions = statRows
      .filter((r) => r.top_session_id !== null)
      .map((r) => ({
        id: r.top_session_id as string,
        title: r.top_session_title ?? "",
        count: Number(r.top_session_count ?? 0),
      }));

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      completedProfiles,
      sponsorAccounts: sponsorCount ?? 0,
      totalLeads: totalLeads ?? 0,
      totalBookmarks,
      uniqueBookmarkers: uniqueBookmarkerCount,
      topSessions,
    });
  });
}
