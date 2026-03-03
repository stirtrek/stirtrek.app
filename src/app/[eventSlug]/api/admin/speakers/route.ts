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
  return telemetry.trackAPIRoute("/api/admin/speakers", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("speakers")
      .select("*")
      .eq("event_id", eventId)
      .order("full_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ speakers: data ?? [] });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/speakers", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await request.json();
    const { first_name, last_name, bio, tag_line, profile_picture, links } = body;

    if (!first_name?.trim() || !last_name?.trim()) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 },
      );
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    const admin = createAdminClient();
    const { data: speaker, error } = await admin
      .from("speakers")
      .insert({
        event_id: eventId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        full_name: fullName,
        bio: bio?.trim() || null,
        tag_line: tag_line?.trim() || null,
        profile_picture: profile_picture?.trim() || null,
        is_top_speaker: false,
        links: links ?? [],
        sessionize_data: null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ speaker }, { status: 201 });
  });
}
