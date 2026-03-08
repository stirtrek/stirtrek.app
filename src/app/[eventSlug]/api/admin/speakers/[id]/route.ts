import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/speakers/[id]", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { first_name, last_name, bio, tag_line, profile_picture, photo_override, links } = body;

    const updates: Record<string, unknown> = {};
    if (first_name !== undefined) updates.first_name = first_name.trim();
    if (last_name !== undefined) updates.last_name = last_name.trim();
    if (first_name !== undefined || last_name !== undefined) {
      const fn = (first_name ?? "").trim();
      const ln = (last_name ?? "").trim();
      if (fn && ln) updates.full_name = `${fn} ${ln}`;
    }
    if (bio !== undefined) updates.bio = bio?.trim() || null;
    if (tag_line !== undefined) updates.tag_line = tag_line?.trim() || null;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture?.trim() || null;
    if (photo_override !== undefined) updates.photo_override = photo_override?.trim() || null;
    if (links !== undefined) updates.links = links;

    const admin = createAdminClient();
    const { data: speaker, error } = await admin
      .from("speakers")
      .update(updates)
      .eq("id", id)
      .eq("event_id", eventId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!speaker) {
      return NextResponse.json({ error: "Speaker not found" }, { status: 404 });
    }

    return NextResponse.json({ speaker });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/speakers/[id]", "DELETE", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const { id } = await params;
    const admin = createAdminClient();

    // Remove from junction table first
    await admin
      .from("session_speakers")
      .delete()
      .eq("speaker_id", id)
      .eq("event_id", eventId);

    const { error } = await admin
      .from("speakers")
      .delete()
      .eq("id", id)
      .eq("event_id", eventId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  });
}
