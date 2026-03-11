import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventProctor,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

/**
 * GET /api/proctor/attendance?time_slot=ISO_TIMESTAMP
 * Returns all active rooms for a time slot with existing counts.
 * Active rooms = primary rooms (from sessions) + simulcast target rooms.
 */
export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/attendance", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const timeSlot = searchParams.get("time_slot");

    if (!timeSlot) {
      return NextResponse.json({ error: "time_slot is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Find sessions at this time slot → get primary room IDs
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, room_id")
      .eq("event_id", eventId)
      .eq("starts_at", timeSlot)
      .eq("is_service_session", false)
      .not("room_id", "is", null);

    const primaryRoomIds = [...new Set((sessions ?? []).map((s) => s.room_id as number))];

    // 2. Find simulcast targets for those primary rooms
    let simulcastTargetIds: number[] = [];
    if (primaryRoomIds.length > 0) {
      const { data: simulcasts } = await admin
        .from("simulcast_rooms")
        .select("target_room_id")
        .eq("event_id", eventId)
        .in("source_room_id", primaryRoomIds);
      simulcastTargetIds = (simulcasts ?? []).map((s) => s.target_room_id as number);
    }

    // 3. Active rooms = primary ∪ simulcast targets
    const simulcastSet = new Set(simulcastTargetIds);
    const allActiveIds = [...new Set([...primaryRoomIds, ...simulcastTargetIds])];

    if (allActiveIds.length === 0) {
      return NextResponse.json({
        rooms: [],
        summary: { total_rooms: 0, counted_rooms: 0, total_attendance: 0 },
      });
    }

    // 4. Get room details
    const { data: rooms } = await admin
      .from("rooms")
      .select("id, name, sort_order")
      .in("id", allActiveIds)
      .order("sort_order", { ascending: true });

    // 5. Get existing attendance counts for this time slot
    const { data: counts } = await admin
      .from("attendance_counts")
      .select("*")
      .eq("event_id", eventId)
      .eq("time_slot", timeSlot)
      .in("room_id", allActiveIds);

    // 6. Get counter profiles
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
    const countMap = new Map((counts ?? []).map((c) => [c.room_id, c]));
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Build response
    const roomEntries = (rooms ?? []).map((room) => {
      const count = countMap.get(room.id);
      const counter = count ? profileMap.get(count.counted_by) : null;

      return {
        room,
        is_simulcast: simulcastSet.has(room.id),
        attendance: count
          ? {
              count: count.count,
              counted_by_name: counter
                ? `${counter.first_name || ""} ${counter.last_name || ""}`.trim() || counter.display_name || "Unknown"
                : "Unknown",
              counted_at: count.counted_at,
            }
          : null,
      };
    });

    const countedRooms = roomEntries.filter((e) => e.attendance !== null);

    return NextResponse.json({
      rooms: roomEntries,
      summary: {
        total_rooms: roomEntries.length,
        counted_rooms: countedRooms.length,
        total_attendance: countedRooms.reduce((sum, e) => sum + (e.attendance?.count ?? 0), 0),
      },
    });
  });
}

/**
 * POST /api/proctor/attendance
 * Upsert an attendance count for a room at a time slot.
 * Body: { room_id, time_slot, count }
 */
export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/proctor/attendance", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventProctor(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { room_id, time_slot, count } = body;

    if (!room_id || !time_slot || count === undefined || count === null) {
      return NextResponse.json(
        { error: "room_id, time_slot, and count are required" },
        { status: 400 },
      );
    }

    if (typeof count !== "number" || count < 0 || !Number.isInteger(count)) {
      return NextResponse.json(
        { error: "count must be a non-negative integer" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("attendance_counts")
      .upsert(
        {
          event_id: eventId,
          room_id,
          time_slot,
          count,
          counted_by: auth.userId,
          counted_at: new Date().toISOString(),
        },
        { onConflict: "event_id,room_id,time_slot" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attendance: data });
  });
}
