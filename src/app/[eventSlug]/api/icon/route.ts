import { NextRequest, NextResponse } from "next/server";
import { resolveEvent } from "@/lib/events/resolve";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);

  if (!event?.logo_url) {
    // Redirect to the static fallback
    return NextResponse.redirect(new URL("/apple-touch-icon.png", _request.url));
  }

  const res = await fetch(event.logo_url);
  if (!res.ok) {
    return NextResponse.redirect(new URL("/apple-touch-icon.png", _request.url));
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
