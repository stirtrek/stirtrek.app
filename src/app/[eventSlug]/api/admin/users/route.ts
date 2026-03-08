import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  requireEventAdminOnly,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";

function getPagination(request: Request, defaultLimit = 50) {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || String(defaultLimit), 10)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/users", "GET", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdmin(eventId);
    if (isErrorResponse(auth)) return auth;

    const admin = createAdminClient();

    const search = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    // Get event members first, then join with profiles
    const { data: memberships } = await admin
      .from("event_memberships")
      .select("user_id, role, is_sponsor")
      .eq("event_id", eventId);

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({
        users: [],
        pagination: { page: 1, limit: 50, total: 0 },
      });
    }

    const memberIds = memberships.map((m) => m.user_id);
    const memberMap = new Map(
      memberships.map((m) => [m.user_id, { role: m.role, is_sponsor: m.is_sponsor }]),
    );

    const { page, limit, offset } = getPagination(request);

    let query = admin
      .from("profiles")
      .select(
        "id, email, display_name, first_name, last_name, created_at",
        { count: "exact" },
      )
      .in("id", memberIds)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`,
      );
    }

    const { data: profiles, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Merge profile data with event membership data
    const users = (profiles ?? []).map((p) => ({
      ...p,
      role: memberMap.get(p.id)?.role ?? "attendee",
      is_sponsor: memberMap.get(p.id)?.is_sponsor ?? false,
    }));

    return NextResponse.json({
      users,
      pagination: { page, limit, total: count ?? 0 },
    });
  });
}

export async function PUT(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/admin/users", "PUT", async () => {
    const eventId = getEventId(request);
    const auth = await requireEventAdminOnly(eventId);
    if (isErrorResponse(auth)) return auth;

    const body = await safeParseBody(request);
    if (body instanceof NextResponse) return body;
    const { profile_id, role } = body;

    if (!profile_id || !["attendee", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Update the event membership role (not profiles.role)
    const { error } = await admin
      .from("event_memberships")
      .update({ role })
      .eq("event_id", eventId)
      .eq("user_id", profile_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    telemetry.trackAuthEvent("role_change", {
      profileId: profile_id,
      role,
      eventId,
    });

    return NextResponse.json({ success: true });
  });
}
