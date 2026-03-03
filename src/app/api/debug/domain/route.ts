import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Diagnostic endpoint: GET /api/debug/domain?d=tkotrivia.com
 * Returns the events table domain column values so you can verify
 * what's stored in the database. Remove this route after debugging.
 */
export async function GET(request: NextRequest) {
  const admin = createAdminClient();

  // Show all events with their domain values
  const { data: events, error } = await admin
    .from("events")
    .select("id, slug, name, domain, is_active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also try to resolve a specific domain if provided
  const testDomain = request.nextUrl.searchParams.get("d");
  let resolution = null;
  if (testDomain) {
    const { data, error: resError } = await admin
      .from("events")
      .select("id, slug, name, domain, is_active")
      .eq("domain", testDomain)
      .eq("is_active", true)
      .single();
    resolution = {
      queriedDomain: testDomain,
      found: !!data,
      event: data,
      error: resError?.message ?? null,
      errorCode: resError?.code ?? null,
    };
  }

  // Also show the request host header for comparison
  const host = request.headers.get("host") || "(none)";

  return NextResponse.json({
    host,
    events: events?.map((e) => ({
      slug: e.slug,
      domain: e.domain,
      is_active: e.is_active,
      domainType: typeof e.domain,
      domainLength: e.domain?.length ?? 0,
      domainChars: e.domain ? [...e.domain].map(c => c.charCodeAt(0)) : [],
    })),
    resolution,
  });
}
