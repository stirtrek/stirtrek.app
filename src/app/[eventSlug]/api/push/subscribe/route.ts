import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId } from "@/lib/events/api-helpers";

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/push/subscribe", "POST", async () => {
    const eventId = getEventId(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { error: "Invalid push subscription" },
        { status: 400 },
      );
    }

    // Upsert by endpoint to avoid duplicates
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          keys,
          user_agent: request.headers.get("user-agent") || null,
          event_id: eventId,
        },
        { onConflict: "endpoint" },
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/push/subscribe",
    "DELETE",
    async () => {
      const eventId = getEventId(request);
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await request.json();
      const { endpoint } = body;

      if (!endpoint) {
        return NextResponse.json(
          { error: "Endpoint is required" },
          { status: 400 },
        );
      }

      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", user.id)
        .eq("event_id", eventId);

      return NextResponse.json({ success: true });
    },
  );
}
