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
  return telemetry.trackAPIRoute("/api/admin/polls", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const { data: polls, error } = await admin
      .from("polls")
      .select(
        "id, question, description, status, allow_multiple, opened_at, closed_at, created_at",
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pollIds = (polls ?? []).map((p) => p.id);

    let optionCounts: Record<string, number> = {};
    let responseCounts: Record<string, number> = {};

    if (pollIds.length > 0) {
      const { data: options } = await admin
        .from("poll_options")
        .select("poll_id")
        .in("poll_id", pollIds);

      const { data: responses } = await admin
        .from("poll_responses")
        .select("poll_id")
        .in("poll_id", pollIds);

      for (const o of options ?? []) {
        optionCounts[o.poll_id] = (optionCounts[o.poll_id] || 0) + 1;
      }

      for (const r of responses ?? []) {
        responseCounts[r.poll_id] = (responseCounts[r.poll_id] || 0) + 1;
      }
    }

    const result = (polls ?? []).map((p) => ({
      ...p,
      option_count: optionCounts[p.id] || 0,
      response_count: responseCounts[p.id] || 0,
    }));

    return NextResponse.json({ polls: result });
  });
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/polls", "POST", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await request.json();
    const { question, description, allow_multiple, options } = body;

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

    const admin = createAdminClient();

    const { data: poll, error: pollError } = await admin
      .from("polls")
      .insert({
        event_id: eventId,
        question: question.trim(),
        description: description?.trim() || null,
        allow_multiple: allow_multiple ?? false,
        created_by: auth.userId,
      })
      .select("id")
      .single();

    if (pollError) {
      return NextResponse.json({ error: pollError.message }, { status: 500 });
    }

    const optionRows = options.map((text: string, i: number) => ({
      event_id: eventId,
      poll_id: poll.id,
      text: text.trim(),
      sort_order: i,
    }));

    const { error: optionsError } = await admin
      .from("poll_options")
      .insert(optionRows);

    if (optionsError) {
      await admin.from("polls").delete().eq("id", poll.id);
      return NextResponse.json(
        { error: optionsError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ poll: { id: poll.id } }, { status: 201 });
  });
}
