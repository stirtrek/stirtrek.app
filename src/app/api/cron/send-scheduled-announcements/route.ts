import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { sendPushToAll } from "@/lib/push";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/cron/send-scheduled-announcements",
    "GET",
    async () => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const admin = createAdminClient();
      const now = new Date().toISOString();

      // Find all scheduled announcements whose time has arrived
      const { data: announcements, error } = await admin
        .from("announcements")
        .select("id, event_id, message")
        .eq("status", "scheduled")
        .lte("scheduled_for", now);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!announcements || announcements.length === 0) {
        return NextResponse.json({
          message: "No scheduled announcements to send",
          sent: 0,
        });
      }

      // Get event details for push notification titles/icons
      const eventIds = [...new Set(announcements.map((a) => a.event_id))];
      const { data: events } = await admin
        .from("events")
        .select("id, name, short_name, logo_url")
        .in("id", eventIds);

      const eventMap = new Map(events?.map((e) => [e.id, e]) ?? []);

      const results = [];

      for (const announcement of announcements) {
        // Optimistic lock: only update if still scheduled
        const { error: updateError } = await admin
          .from("announcements")
          .update({
            status: "sent",
            sent_at: now,
            scheduled_for: null,
          })
          .eq("id", announcement.id)
          .eq("status", "scheduled");

        if (updateError) {
          results.push({ id: announcement.id, error: updateError.message });
          continue;
        }

        const event = eventMap.get(announcement.event_id);
        const title = event
          ? `${event.short_name || event.name} Announcement`
          : "Announcement";

        sendPushToAll(
          {
            title,
            body:
              announcement.message.length > 100
                ? announcement.message.slice(0, 97) + "..."
                : announcement.message,
            url: "/announcements",
            icon: event?.logo_url || undefined,
          },
          announcement.event_id,
        ).catch((err) =>
          console.error(
            `Scheduled announcement push failed (${announcement.id}):`,
            err,
          ),
        );

        results.push({ id: announcement.id, sent: true });
      }

      return NextResponse.json({
        message: `Processed ${results.length} scheduled announcement(s)`,
        results,
      });
    },
  );
}
