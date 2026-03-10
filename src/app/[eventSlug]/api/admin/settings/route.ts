import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEventId, requireEventAdminOnly, isErrorResponse, safeParseBody } from "@/lib/events/api-helpers";

export async function GET(request: NextRequest) {
  const eventId = getEventId(request);
  const auth = await requireEventAdminOnly(eventId);
  if (isErrorResponse(auth)) return auth;

  return NextResponse.json(auth.event);
}

export async function PATCH(request: NextRequest) {
  const eventId = getEventId(request);
  const auth = await requireEventAdminOnly(eventId);
  if (isErrorResponse(auth)) return auth;

  const body = await safeParseBody(request);
  if (body instanceof NextResponse) return body;

  // Only allow event-admin-editable fields (not super-admin fields)
  const allowedFields = [
    "name",
    "short_name",
    "description",
    "event_date",
    "event_end_date",
    "venue_name",
    "venue_address",
    "venue_maps_url",
    "timezone",
    "sessionize_api_id",
    "sponsor_feed_url",
    "sponsor_access_code",
    "accent_color",
    "logo_url",
    "schedule_message",
    "about_content",
    "sponsor_tiers",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event);
}
