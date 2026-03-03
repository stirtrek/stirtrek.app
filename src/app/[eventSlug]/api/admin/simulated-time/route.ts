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
  return telemetry.trackAPIRoute(
    "/api/admin/simulated-time",
    "GET",
    async () => {
      const eventId = getEventId(request);

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("event_id", eventId)
        .eq("key", "simulated_time")
        .single();

      if (error) {
        return NextResponse.json({ simulatedTime: null });
      }

      // value is stored as a JSON string when active, or JSON false when cleared
      const raw = data.value;
      const simulatedTime = typeof raw === "string" ? raw : null;
      return NextResponse.json({ simulatedTime });
    },
  );
}

export async function PUT(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/simulated-time",
    "PUT",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const body = await request.json();
      const time: string | null = body.time ?? null;

      // Store the time string when active, or JSON false when clearing.
      // We avoid storing JS null because Supabase interprets it as SQL NULL,
      // which violates the JSONB NOT NULL constraint on app_settings.value.
      const dbValue = time ?? false;

      const admin = createAdminClient();
      const { error } = await admin
        .from("app_settings")
        .update({ value: dbValue, updated_by: auth.userId })
        .eq("event_id", eventId)
        .eq("key", "simulated_time");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ simulatedTime: time });
    },
  );
}
