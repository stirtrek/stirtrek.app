import { NextRequest, NextResponse } from "next/server";
import { syncSponsorsFromFeed } from "@/lib/sponsors/sync";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/sponsors/sync",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const result = await syncSponsorsFromFeed(eventId);

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ synced: result.synced });
    },
  );
}
