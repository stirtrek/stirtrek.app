import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId, requireFeatureFlag } from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/announcements", "GET", async () => {
    const eventId = getEventId(request);

    const featureCheck = await requireFeatureFlag(eventId, "announcements");
    if (featureCheck) return featureCheck;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: announcements, error } = await supabase
      .from("announcements")
      .select("id, message, sent_at")
      .eq("event_id", eventId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ announcements: announcements ?? [] });
  });
}
