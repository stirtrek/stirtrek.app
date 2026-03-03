import { NextRequest, NextResponse } from "next/server";
import { resolveEventByDomain } from "@/lib/events/resolve";

/**
 * Dynamic apple-touch-icon handler.
 *
 * iOS Safari fetches /apple-touch-icon.png when adding a PWA to the home
 * screen, ignoring <link> tags in some cases. This route resolves the
 * event from the request hostname (custom domain) and proxies the event's
 * logo so iOS always gets the correct icon.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const event = await resolveEventByDomain(host);

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
