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
  return telemetry.trackAPIRoute("/api/admin/feedback", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    // Get all non-service sessions for this event
    const { data: sessions } = await admin
      .from("sessions")
      .select("id, title, starts_at, is_service_session")
      .eq("event_id", eventId)
      .eq("is_service_session", false)
      .order("starts_at", { ascending: true });

    // Get all feedback for this event with user display names
    const { data: feedback } = await admin
      .from("session_feedback")
      .select(
        "session_id, rating, comment, created_at, profiles(display_name, email)",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    // Group feedback by session
    const feedbackBySession: Record<
      string,
      {
        rating: string;
        comment: string | null;
        created_at: string;
        user_name: string;
      }[]
    > = {};

    for (const f of feedback ?? []) {
      if (!feedbackBySession[f.session_id]) {
        feedbackBySession[f.session_id] = [];
      }
      const profile = f.profiles as unknown as {
        display_name: string | null;
        email: string;
      } | null;
      feedbackBySession[f.session_id].push({
        rating: f.rating,
        comment: f.comment,
        created_at: f.created_at,
        user_name: profile?.display_name || profile?.email || "Anonymous",
      });
    }

    const result = (sessions ?? []).map((s) => {
      const items = feedbackBySession[s.id] ?? [];
      const green = items.filter((f) => f.rating === "green").length;
      const yellow = items.filter((f) => f.rating === "yellow").length;
      const red = items.filter((f) => f.rating === "red").length;

      return {
        id: s.id,
        title: s.title,
        starts_at: s.starts_at,
        total: items.length,
        green,
        yellow,
        red,
        feedback: items,
      };
    });

    return NextResponse.json({ sessions: result });
  });
}
