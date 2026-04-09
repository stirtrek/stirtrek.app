import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { sendPushToAll } from "@/lib/push";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/cron/process-scheduled-polls",
    "GET",
    async () => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const admin = createAdminClient();
      const now = new Date().toISOString();
      const results: { id: string; action: string; error?: string }[] = [];

      // --- Open scheduled polls ---
      const { data: toOpen, error: openErr } = await admin
        .from("polls")
        .select("id, event_id, question")
        .eq("status", "draft")
        .not("scheduled_open", "is", null)
        .lte("scheduled_open", now);

      if (openErr) {
        return NextResponse.json({ error: openErr.message }, { status: 500 });
      }

      // Get event details for push notification titles/icons
      const eventIds = [
        ...new Set((toOpen ?? []).map((p) => p.event_id)),
      ];
      const { data: events } = eventIds.length > 0
        ? await admin
            .from("events")
            .select("id, name, short_name, logo_url")
            .in("id", eventIds)
        : { data: [] };
      const eventMap = new Map(events?.map((e) => [e.id, e]) ?? []);

      for (const poll of toOpen ?? []) {
        const { error } = await admin
          .from("polls")
          .update({
            status: "active",
            opened_at: now,
          })
          .eq("id", poll.id)
          .eq("status", "draft");

        if (error) {
          results.push({ id: poll.id, action: "open", error: error.message });
          continue;
        }

        // Send push notification
        const event = eventMap.get(poll.event_id);
        const title = event
          ? `${event.short_name || event.name}: New Poll`
          : "New Poll";

        sendPushToAll(
          {
            title,
            body: poll.question,
            url: "/polls",
            icon: event?.logo_url || undefined,
          },
          poll.event_id,
        ).catch((err) =>
          console.error(`Scheduled poll push failed (${poll.id}):`, err),
        );

        results.push({ id: poll.id, action: "opened" });
      }

      // --- Close scheduled polls ---
      const { data: toClose, error: closeErr } = await admin
        .from("polls")
        .select("id")
        .eq("status", "active")
        .not("scheduled_close", "is", null)
        .lte("scheduled_close", now);

      if (closeErr) {
        return NextResponse.json({ error: closeErr.message }, { status: 500 });
      }

      for (const poll of toClose ?? []) {
        const { error } = await admin
          .from("polls")
          .update({
            status: "closed",
            closed_at: now,
          })
          .eq("id", poll.id)
          .eq("status", "active");

        if (error) {
          results.push({ id: poll.id, action: "close", error: error.message });
          continue;
        }

        results.push({ id: poll.id, action: "closed" });
      }

      return NextResponse.json({
        message: `Processed ${results.length} scheduled poll(s)`,
        results,
      });
    },
  );
}
