import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId, safeParseBody } from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/sponsor/activate",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const supabase = await createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await safeParseBody(request);
      if (body instanceof NextResponse) return body;
      const code = (body.code || "").trim();
      const sponsorId = (body.sponsor_id || "").trim();

      if (!code) {
        return NextResponse.json(
          { error: "Code is required" },
          { status: 400 },
        );
      }

      if (!sponsorId) {
        return NextResponse.json(
          { error: "Please select your sponsor company" },
          { status: 400 },
        );
      }

      // Look up the sponsor access code from the event record
      const admin = createAdminClient();
      const { data: event } = await admin
        .from("events")
        .select("sponsor_access_code")
        .eq("id", eventId)
        .single();

      const expectedCode = event?.sponsor_access_code;
      if (!expectedCode) {
        return NextResponse.json(
          { error: "Sponsor activation is not configured" },
          { status: 503 },
        );
      }

      // Constant-time comparison to prevent timing attacks
      const codeBuffer = Buffer.from(code.padEnd(256, "\0"));
      const expectedBuffer = Buffer.from(expectedCode.padEnd(256, "\0"));
      const isValid = timingSafeEqual(codeBuffer, expectedBuffer);

      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid access code" },
          { status: 403 },
        );
      }

      // Validate that the selected sponsor exists and is active for this event
      const { data: sponsor } = await admin
        .from("sponsors")
        .select("id")
        .eq("id", sponsorId)
        .eq("event_id", eventId)
        .eq("is_active", true)
        .single();

      if (!sponsor) {
        return NextResponse.json(
          { error: "Invalid sponsor selection" },
          { status: 400 },
        );
      }

      // Upsert into event_memberships for event-scoped sponsor status
      const { error } = await admin
        .from("event_memberships")
        .upsert(
          {
            event_id: eventId,
            user_id: user.id,
            is_sponsor: true,
            sponsor_id: sponsorId,
            role: "attendee",
          },
          { onConflict: "event_id,user_id" },
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      telemetry.trackAuthEvent("sponsor_activate", { userId: user.id });

      return NextResponse.json({ success: true });
    },
  );
}
