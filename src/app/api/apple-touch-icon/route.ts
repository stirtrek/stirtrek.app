import { NextRequest, NextResponse } from "next/server";
import { resolveEvent, resolveEventByDomain } from "@/lib/events/resolve";

/**
 * Handles iOS well-known /apple-touch-icon.png discovery.
 * Resolves the event from slug param or hostname, then redirects
 * to the event's logo_url.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const host = request.headers.get("host") || "";

  const event = slug
    ? await resolveEvent(slug)
    : await resolveEventByDomain(host);

  if (!event?.logo_url) {
    return new NextResponse(null, { status: 404 });
  }

  // Redirect to the dynamic icon endpoint which composites the logo
  // onto the event's icon_background_color
  const iconUrl = new URL(`/${event.slug}/api/icon`, request.nextUrl.origin);
  iconUrl.searchParams.set("size", "180");
  return NextResponse.redirect(iconUrl);
}
