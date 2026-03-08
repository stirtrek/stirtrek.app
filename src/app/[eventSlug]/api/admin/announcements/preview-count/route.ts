import { NextRequest, NextResponse } from "next/server";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getSegmentUserIds } from "@/lib/push";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
} from "@/lib/events/api-helpers";
import type { AnnouncementTargetType, AnnouncementTargetCriteria } from "@/lib/types";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/announcements/preview-count",
    "GET",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const targetType = (request.nextUrl.searchParams.get("target_type") || "all") as AnnouncementTargetType;
      const criteriaParam = request.nextUrl.searchParams.get("target_criteria");
      let targetCriteria: AnnouncementTargetCriteria | null = null;

      if (criteriaParam) {
        try {
          targetCriteria = JSON.parse(criteriaParam);
        } catch {
          return NextResponse.json({ error: "Invalid target_criteria JSON" }, { status: 400 });
        }
      }

      const userIds = await getSegmentUserIds(eventId, targetType, targetCriteria);

      return NextResponse.json({ count: userIds.length });
    },
  );
}
