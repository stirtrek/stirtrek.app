import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventMember,
  isErrorResponse,
  resolveEffectiveUser,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/speaker-feedback", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventMember(eventId);
    if (isErrorResponse(auth)) return auth;

    const { effectiveUserId } = await resolveEffectiveUser(request, auth.userId);
    const admin = createAdminClient();

    // Find speaker records linked to this user
    const { data: speakers } = await admin
      .from("speakers")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", effectiveUserId);

    if (!speakers || speakers.length === 0) {
      return NextResponse.json({ sessions: [], is_speaker: false });
    }

    const speakerIds = speakers.map((s) => s.id);

    // Find sessions for these speakers
    const { data: sessionSpeakers } = await admin
      .from("session_speakers")
      .select("session_id")
      .in("speaker_id", speakerIds)
      .eq("event_id", eventId);

    const sessionIds = [
      ...new Set((sessionSpeakers ?? []).map((ss) => ss.session_id)),
    ];

    if (sessionIds.length === 0) {
      return NextResponse.json({ sessions: [], is_speaker: true });
    }

    // Fetch session details
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, title, starts_at, room_id, rooms(name)")
      .in("id", sessionIds)
      .eq("event_id", eventId)
      .order("starts_at", { ascending: true });

    // Fetch feedback — deliberately NO user join (anonymous to speakers)
    const { data: feedback } = await admin
      .from("session_feedback")
      .select("session_id, rating, comment, created_at")
      .in("session_id", sessionIds)
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    // Group feedback by session
    const feedbackBySession: Record<
      string,
      { rating: string; comment: string | null; created_at: string }[]
    > = {};
    for (const f of feedback ?? []) {
      if (!feedbackBySession[f.session_id]) {
        feedbackBySession[f.session_id] = [];
      }
      feedbackBySession[f.session_id].push({
        rating: f.rating,
        comment: f.comment,
        created_at: f.created_at,
      });
    }

    const result = (sessions ?? []).map((s) => {
      const items = feedbackBySession[s.id] ?? [];
      const room = s.rooms as unknown as { name: string } | null;
      return {
        id: s.id,
        title: s.title,
        starts_at: s.starts_at,
        room_name: room?.name ?? null,
        total: items.length,
        green: items.filter((f) => f.rating === "green").length,
        yellow: items.filter((f) => f.rating === "yellow").length,
        red: items.filter((f) => f.rating === "red").length,
        feedback: items.map((f) => ({
          rating: f.rating,
          comment: f.comment,
          created_at: f.created_at,
        })),
      };
    });

    return NextResponse.json({ sessions: result, is_speaker: true });
  });
}
