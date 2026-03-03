import { NextRequest, NextResponse } from "next/server";
import { resolveEvent, resolveEventByDomain } from "@/lib/events/resolve";

/**
 * Dynamic event icon handler.
 *
 * Resolves the event logo from either:
 *   - ?slug=bacon  (used by <link> tags and manifest)
 *   - hostname     (used by iOS well-known /apple-touch-icon.png discovery)
 *
 * Returns the proxied image so iOS always gets a same-origin response
 * with no redirects.
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

  const res = await fetch(event.logo_url);
  if (!res.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
