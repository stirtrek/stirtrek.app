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
 * Returns attendance report: for each session, combines counts from
 * primary room + simulcast target rooms at that session's start time.
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/attendance", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    // Fetch all data in parallel
    const [countsRes, roomsRes, sessionsRes, simulcastRes] = await Promise.all([
      admin
        .from("attendance_counts")
        .select("*")
        .eq("event_id", eventId),
      admin
        .from("rooms")
        .select("id, name, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true }),
      admin
        .from("sessions")
        .select("id, title, starts_at, ends_at, room_id")
        .eq("event_id", eventId)
        .eq("is_service_session", false)
        .not("room_id", "is", null)
        .order("starts_at", { ascending: true }),
      admin
        .from("simulcast_rooms")
        .select("*")
        .eq("event_id", eventId),
    ]);

    const counts = countsRes.data ?? [];
    const rooms = roomsRes.data ?? [];
    const sessions = sessionsRes.data ?? [];
    const simulcasts = simulcastRes.data ?? [];

    // Get counter profiles
    const counterIds = [...new Set(counts.map((c) => c.counted_by))];
    let profiles: { id: string; display_name: string | null; first_name: string | null; last_name: string | null }[] = [];
    if (counterIds.length > 0) {
      const { data } = await admin
        .from("profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", counterIds);
      profiles = data ?? [];
    }

    // Build lookup maps
    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Build simulcast lookup: source_room_id → [target_room_ids]
    const simulcastBySource = new Map<number, number[]>();
    for (const s of simulcasts) {
      const targets = simulcastBySource.get(s.source_room_id) ?? [];
      targets.push(s.target_room_id);
      simulcastBySource.set(s.source_room_id, targets);
    }

    // Build count lookup: "room_id:time_slot" → count row
    const countMap = new Map(counts.map((c) => [`${c.room_id}:${c.time_slot}`, c]));

    // Build report: for each session, gather counts from primary + simulcast rooms
    const report: {
      session_id: string;
      session_title: string;
      starts_at: string;
      room_id: number;
      room_name: string;
      room_sort_order: number;
      count: number;
      counted_by_name: string;
      counted_at: string;
      is_simulcast: boolean;
    }[] = [];

    const sessionTotals: Record<string, number> = {};

    for (const session of sessions) {
      const primaryRoomId = session.room_id as number;
      const simulcastTargets = simulcastBySource.get(primaryRoomId) ?? [];
      const allRoomIds = [primaryRoomId, ...simulcastTargets];
      const simulcastSet = new Set(simulcastTargets);

      let sessionTotal = 0;

      for (const roomId of allRoomIds) {
        const countRow = countMap.get(`${roomId}:${session.starts_at}`);
        if (!countRow) continue;

        const room = roomMap.get(roomId);
        const counter = profileMap.get(countRow.counted_by);

        report.push({
          session_id: session.id,
          session_title: session.title,
          starts_at: session.starts_at,
          room_id: roomId,
          room_name: room?.name ?? "Unknown",
          room_sort_order: room?.sort_order ?? 0,
          count: countRow.count,
          counted_by_name: counter
            ? `${counter.first_name || ""} ${counter.last_name || ""}`.trim() || counter.display_name || "Unknown"
            : "Unknown",
          counted_at: countRow.counted_at,
          is_simulcast: simulcastSet.has(roomId),
        });

        sessionTotal += countRow.count;
      }

      if (sessionTotal > 0) {
        sessionTotals[session.id] = sessionTotal;
      }
    }

    return NextResponse.json({
      report,
      session_totals: sessionTotals,
      rooms,
      sessions,
    });
  });
}
