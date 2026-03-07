import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { sendPushToAll } from "@/lib/push";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements/[id]/send",
    "POST",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { data: announcement } = await admin
        .from("announcements")
        .select("id, message, status")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!announcement) {
        return NextResponse.json(
          { error: "Announcement not found" },
          { status: 404 },
        );
      }

      if (announcement.status === "sent") {
        return NextResponse.json(
          { error: "Announcement has already been sent" },
          { status: 400 },
        );
      }

      const { error } = await admin
        .from("announcements")
        .update({ status: "sent", sent_at: new Date().toISOString(), scheduled_for: null })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      sendPushToAll(
        {
          title: `${auth.event.short_name || auth.event.name} Announcement`,
          body:
            announcement.message.length > 100
              ? announcement.message.slice(0, 97) + "..."
              : announcement.message,
          url: "/announcements",
          icon: auth.event.logo_url || undefined,
        },
        eventId,
      ).catch((err) => console.error("Announcement push failed:", err));

      return NextResponse.json({ success: true });
    },
  );
}
