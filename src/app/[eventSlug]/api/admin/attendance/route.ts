import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

/**
 * GET /api/admin/attendance
 * Returns attendance report: counts joined with sessions, theaters, and profiles.
 * Optional query param: ?session_id= to filter by session
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/attendance", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    const admin = createAdminClient();

    // Get all attendance counts with theater info
    let countsQuery = admin
      .from("attendance_counts")
      .select("*")
      .eq("event_id", eventId);

    if (sessionId) {
      countsQuery = countsQuery.eq("session_id", sessionId);
    }

    const { data: counts, error: countsError } = await countsQuery;
    if (countsError) {
      return NextResponse.json({ error: countsError.message }, { status: 500 });
    }

    // Get theaters for display names
    const { data: theaters } = await admin
      .from("theaters")
      .select("id, name, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    // Get sessions for display names
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, title, starts_at, ends_at")
      .eq("event_id", eventId)
      .eq("is_service_session", false)
      .order("starts_at", { ascending: true });

    // Get counter profiles
    const counterIds = [...new Set((counts ?? []).map((c) => c.counted_by))];
    let profiles: { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] = [];
    if (counterIds.length > 0) {
      const { data } = await admin
        .from("profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", counterIds);
      profiles = data ?? [];
    }

    // Build lookup maps
    const theaterMap = new Map((theaters ?? []).map((t) => [t.id, t]));
    const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Build report rows
    const report = (counts ?? []).map((c) => {
      const theater = theaterMap.get(c.theater_id);
      const session = sessionMap.get(c.session_id);
      const counter = profileMap.get(c.counted_by);
      return {
        ...c,
        theater_name: theater?.name ?? "Unknown",
        theater_sort_order: theater?.sort_order ?? 0,
        session_title: session?.title ?? "Unknown",
        starts_at: session?.starts_at ?? null,
        counted_by_name: counter
          ? `${counter.first_name || ""} ${counter.last_name || ""}`.trim() || counter.display_name || "Unknown"
          : "Unknown",
      };
    });

    // Calculate session totals
    const sessionTotals: Record<string, number> = {};
    for (const row of report) {
      sessionTotals[row.session_id] = (sessionTotals[row.session_id] ?? 0) + row.count;
    }

    return NextResponse.json({
      report,
      session_totals: sessionTotals,
      theaters: theaters ?? [],
      sessions: sessions ?? [],
    });
  });
}
