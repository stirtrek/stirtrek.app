import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sessions", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();
    const { data: sessions, error } = await admin
      .from("sessions")
      .select("*")
      .eq("event_id", eventId)
      .order("starts_at", { ascending: true, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch speaker assignments
    const sessionIds = (sessions ?? []).map((s) => s.id);
    let speakerMap: Record<string, string[]> = {};

    if (sessionIds.length > 0) {
      const { data: junctions } = await admin
        .from("session_speakers")
        .select("session_id, speaker_id")
        .in("session_id", sessionIds);

      for (const j of junctions ?? []) {
        if (!speakerMap[j.session_id]) speakerMap[j.session_id] = [];
        speakerMap[j.session_id].push(j.speaker_id);
      }
    }

    const result = (sessions ?? []).map((s) => ({
      ...s,
      speaker_ids: speakerMap[s.id] ?? [],
    }));

    return NextResponse.json({ sessions: result });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/sessions", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const {
      title,
      description,
      starts_at,
      ends_at,
      room_id,
      speaker_ids,
      is_service_session,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Session title is required" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: session, error } = await admin
      .from("sessions")
      .insert({
        id: crypto.randomUUID(),
        event_id: eventId,
        title: title.trim(),
        description: description?.trim() || null,
        starts_at: starts_at || null,
        ends_at: ends_at || null,
        room_id: room_id || null,
        is_service_session: is_service_session ?? false,
        is_plenum_session: false,
        sessionize_data: null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Assign speakers
    if (Array.isArray(speaker_ids) && speaker_ids.length > 0) {
      const rows = speaker_ids.map((speakerId: string) => ({
        event_id: eventId,
        session_id: session.id,
        speaker_id: speakerId,
      }));

      await admin.from("session_speakers").insert(rows);
    }

    return NextResponse.json({ session }, { status: 201 });
  });
}
