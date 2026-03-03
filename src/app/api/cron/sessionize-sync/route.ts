import { NextRequest, NextResponse } from "next/server";
import { syncSessionizeData } from "@/lib/sessionize/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/cron/sessionize-sync",
    "GET",
    async () => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Fetch all active events that have a sessionize_api_id configured
      const admin = createAdminClient();
      const { data: events, error: eventsError } = await admin
        .from("events")
        .select("id, name, sessionize_api_id")
        .eq("is_active", true)
        .not("sessionize_api_id", "is", null);

      if (eventsError) {
        return NextResponse.json(
          { error: eventsError.message },
          { status: 500 },
        );
      }

      if (!events || events.length === 0) {
        return NextResponse.json({
          message: "No active events with Sessionize configured",
          results: [],
        });
      }

      // Sync each event in sequence
      const results = [];
      for (const event of events) {
        const result = await syncSessionizeData(undefined, event.id);
        results.push({
          eventId: event.id,
          eventName: event.name,
          ...result,
        });
      }

      const hasErrors = results.some((r) => r.error);

      return NextResponse.json(
        { results },
        { status: hasErrors ? 207 : 200 },
      );
    },
  );
}
