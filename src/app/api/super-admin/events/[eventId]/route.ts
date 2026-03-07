import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin, isErrorResponse } from "@/lib/events/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const auth = await requireSuperAdmin();
  if (isErrorResponse(auth)) return auth;

  const { eventId } = await params;
  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const auth = await requireSuperAdmin();
  if (isErrorResponse(auth)) return auth;

  const { eventId } = await params;
  const body = await request.json();

  const allowedFields = [
    "name",
    "slug",
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
    "domain",
    "feature_flags",
    "is_active",
    "show_on_marketing",
    "logo_url",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate slug if being updated
  if (updates.slug && !/^[a-z0-9-]+$/.test(updates.slug as string)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Check slug uniqueness if being changed
  if (updates.slug) {
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("slug", updates.slug as string)
      .neq("id", eventId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "An event with this slug already exists" },
        { status: 409 },
      );
    }
  }

  // Check domain uniqueness if being changed
  if (updates.domain) {
    const { data: existing } = await admin
      .from("events")
      .select("id")
      .eq("domain", updates.domain as string)
      .neq("id", eventId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Another event is already using this domain" },
        { status: 409 },
      );
    }
  }

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
