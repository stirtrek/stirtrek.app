import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("events")
    .select(
      "id, slug, name, short_name, description, logo_url, event_date, event_end_date, venue_name, accent_color, domain",
    )
    .eq("is_active", true)
    .eq("show_on_marketing", true)
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(events ?? [], {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
