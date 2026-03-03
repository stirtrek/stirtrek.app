import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { sendPushToAll } from "@/lib/push";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements",
    "GET",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { data: announcements, error } = await admin
        .from("announcements")
        .select("id, message, status, created_by, sent_at, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ announcements: announcements ?? [] });
    },
  );
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await request.json();
      const { message, send_now } = body;

      if (!message?.trim()) {
        return NextResponse.json(
          { error: "Message is required" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();
      const now = new Date().toISOString();

      const insertData: Record<string, unknown> = {
        event_id: eventId,
        message: message.trim(),
        created_by: auth.userId,
        status: send_now ? "sent" : "draft",
      };

      if (send_now) {
        insertData.sent_at = now;
      }

      const { data: announcement, error } = await admin
        .from("announcements")
        .insert(insertData)
        .select("id, status")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (send_now) {
        sendPushToAll(
          {
            title: `${auth.event.short_name || auth.event.name} Announcement`,
            body:
              message.trim().length > 100
                ? message.trim().slice(0, 97) + "..."
                : message.trim(),
            url: "/announcements",
          },
          eventId,
        ).catch(() => {});
      }

      return NextResponse.json(
        { announcement: { id: announcement.id } },
        { status: 201 },
      );
    },
  );
}
