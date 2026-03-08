import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/schedule/clear",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await safeParseBody(request);
      if (!body || body.confirm !== true) {
        return NextResponse.json(
          { error: "Must confirm deletion" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();
      const counts: Record<string, number> = {};

      // Delete in FK-safe order, all scoped to event_id
      const tables = [
        "session_feedback",
        "personal_schedule",
        "session_speakers",
        "session_categories",
        "sessions",
        "speakers",
        "category_items",
        "categories",
        "rooms",
        "sessionize_sync_log",
      ] as const;

      for (const table of tables) {
        const { count, error } = await admin
          .from(table)
          .delete({ count: "exact" })
          .eq("event_id", eventId);

        if (error) {
          return NextResponse.json(
            { error: `Failed to clear ${table}: ${error.message}` },
            { status: 500 },
          );
        }

        counts[table] = count ?? 0;
      }

      return NextResponse.json({ success: true, counts });
    },
  );
}
