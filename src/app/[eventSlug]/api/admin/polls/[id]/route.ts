import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/polls/[id]", "GET", async () => {
    const { id } = await params;
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const { data: poll, error } = await admin
      .from("polls")
      .select(
        "id, question, description, status, allow_multiple, opened_at, closed_at, scheduled_open, scheduled_close",
      )
      .eq("id", id)
      .eq("event_id", eventId)
      .single();

    if (error || !poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    const { data: options } = await admin
      .from("poll_options")
      .select("id, text, sort_order")
      .eq("poll_id", id)
      .order("sort_order", { ascending: true });

    return NextResponse.json({
      poll: { ...poll, options: options ?? [] },
    });
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/polls/[id]", "PUT", async () => {
    const { id } = await params;
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("polls")
      .select("status")
      .eq("id", id)
      .eq("event_id", eventId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Can only edit draft polls" },
        { status: 400 },
      );
    }

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { question, description, allow_multiple, options, scheduled_open, scheduled_close } = body;

    if (!question?.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: "At least 2 options required" },
        { status: 400 },
      );
    }

    if (options.some((o: string) => !o.trim())) {
      return NextResponse.json(
        { error: "All options must have text" },
        { status: 400 },
      );
    }

    const { error: pollError } = await admin
      .from("polls")
      .update({
        question: question.trim(),
        description: description?.trim() || null,
        allow_multiple: allow_multiple ?? false,
        scheduled_open: scheduled_open || null,
        scheduled_close: scheduled_close || null,
      })
      .eq("id", id);

    if (pollError) {
      return NextResponse.json({ error: pollError.message }, { status: 500 });
    }

    // Replace-all: delete existing options, re-insert
    await admin.from("poll_options").delete().eq("poll_id", id);

    const optionRows = options.map((text: string, i: number) => ({
      event_id: eventId,
      poll_id: id,
      text: text.trim(),
      sort_order: i,
    }));

    const { error: optionsError } = await admin
      .from("poll_options")
      .insert(optionRows);

    if (optionsError) {
      return NextResponse.json(
        { error: optionsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]",
    "DELETE",
    async () => {
      const { id } = await params;
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const admin = createAdminClient();

      const { data: existing } = await admin
        .from("polls")
        .select("status")
        .eq("id", id)
        .eq("event_id", eventId)
        .single();

      if (!existing) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      if (existing.status !== "draft") {
        return NextResponse.json(
          { error: "Can only delete draft polls" },
          { status: 400 },
        );
      }

      const { error } = await admin.from("polls").delete().eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    },
  );
}
