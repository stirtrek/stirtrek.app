import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin, isErrorResponse, safeParseBody } from "@/lib/events/api-helpers";
import type { EventFeatureFlags } from "@/lib/types";

const DEFAULT_FEATURE_FLAGS: EventFeatureFlags = {
  polls: false,
  emergency_reporting: false,
  sponsor_leads: false,
  announcements: false,
  feedback: false,
  venue_map: false,
  passport: false,
  attendance: false,
};

export async function GET() {
  const auth = await requireSuperAdmin();
  if (isErrorResponse(auth)) return auth;

  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(events);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (isErrorResponse(auth)) return auth;

  const body = await safeParseBody(request);
  if (body instanceof NextResponse) return body;
  const {
    name,
    slug,
    short_name,
    description,
    event_date,
    event_end_date,
    venue_name,
    venue_address,
    venue_maps_url,
    timezone,
    sessionize_api_id,
    sponsor_feed_url,
    sponsor_access_code,
    accent_color,
    domain,
    logo_url,
    feature_flags,
    show_on_marketing,
    about_content,
  } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 },
    );
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must contain only lowercase letters, numbers, and hyphens" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Check slug uniqueness
  const { data: existing } = await admin
    .from("events")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "An event with this slug already exists" },
      { status: 409 },
    );
  }

  const { data: event, error } = await admin
    .from("events")
    .insert({
      name,
      slug,
      short_name: short_name || null,
      description: description || null,
      event_date: event_date || null,
      event_end_date: event_end_date || null,
      venue_name: venue_name || null,
      venue_address: venue_address || null,
      venue_maps_url: venue_maps_url || null,
      timezone: timezone || "America/New_York",
      sessionize_api_id: sessionize_api_id || null,
      sponsor_feed_url: sponsor_feed_url || null,
      sponsor_access_code: sponsor_access_code || null,
      accent_color: accent_color || "#FF3B3B",
      domain: domain || null,
      logo_url: logo_url || null,
      feature_flags: feature_flags || DEFAULT_FEATURE_FLAGS,
      is_active: true,
      show_on_marketing: show_on_marketing ?? false,
      about_content: about_content || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(event, { status: 201 });
}
