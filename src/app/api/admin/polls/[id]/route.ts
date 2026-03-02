import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

async function checkAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff"].includes(profile.role)) return null;

  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/polls/[id]", "GET", async () => {
    const { id } = await params;
    const user = await checkAdmin();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: poll, error } = await admin
      .from("polls")
      .select(
        "id, question, description, status, allow_multiple, opened_at, closed_at",
      )
      .eq("id", id)
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/polls/[id]", "PUT", async () => {
    const { id } = await params;
    const user = await checkAdmin();
    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("polls")
      .select("status")
      .eq("id", id)
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

    const { error: pollError } = await admin
      .from("polls")
      .update({
        question: question.trim(),
        description: description?.trim() || null,
        allow_multiple: allow_multiple ?? false,
      })
      .eq("id", id);

    if (pollError) {
      return NextResponse.json({ error: pollError.message }, { status: 500 });
    }

    // Replace-all: delete existing options, re-insert
    await admin.from("poll_options").delete().eq("poll_id", id);

    const optionRows = options.map((text: string, i: number) => ({
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/polls/[id]",
    "DELETE",
    async () => {
      const { id } = await params;
      const user = await checkAdmin();
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const admin = createAdminClient();

      const { data: existing } = await admin
        .from("polls")
        .select("status")
        .eq("id", id)
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
