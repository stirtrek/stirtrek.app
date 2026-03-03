import { NextRequest, NextResponse } from "next/server";
import { resolveEventByDomain } from "@/lib/events/resolve";

/**
 * Diagnostic endpoint that runs in EDGE RUNTIME (same as middleware).
 * GET /api/debug/domain?d=tkotrivia.com
 * Remove this route after debugging.
 */
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const testDomain = request.nextUrl.searchParams.get("d") || "tkotrivia.com";
  const host = request.headers.get("host") || "(none)";

  // Check env vars availability in Edge Runtime
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSecretKey = !!process.env.SUPABASE_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";

  // Test direct fetch (same as queryEvents uses)
  let directFetchResult: unknown = null;
  let directFetchError: string | null = null;
  try {
    const key = process.env.SUPABASE_SECRET_KEY!;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const fetchUrl = `${url}/rest/v1/events?domain=eq.${encodeURIComponent(testDomain)}&is_active=eq.true&limit=1`;

    const res = await fetch(fetchUrl, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      directFetchError = `HTTP ${res.status}: ${await res.text()}`;
    } else {
      directFetchResult = await res.json();
    }
  } catch (err) {
    directFetchError = err instanceof Error ? err.message : String(err);
  }

  // Test resolveEventByDomain (the actual function middleware uses)
  let resolveResult: unknown = null;
  let resolveError: string | null = null;
  try {
    const event = await resolveEventByDomain(testDomain);
    resolveResult = event ? { slug: event.slug, domain: event.domain, id: event.id } : null;
  } catch (err) {
    resolveError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    runtime: "edge",
    host,
    testDomain,
    envVars: { hasSupabaseUrl, hasSecretKey, supabaseUrl },
    directFetch: { result: directFetchResult, error: directFetchError },
    resolveEventByDomain: { result: resolveResult, error: resolveError },
  });
}
