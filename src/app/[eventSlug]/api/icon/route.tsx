import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { resolveEvent } from "@/lib/events/resolve";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventSlug: string }> },
) {
  const { eventSlug } = await params;
  const size = Number(request.nextUrl.searchParams.get("size")) || 512;
  const event = await resolveEvent(eventSlug);

  if (!event?.logo_url) {
    return new Response(null, { status: 404 });
  }

  const bgColor = event.icon_background_color || "#ffffff";
  const padding = Math.round(size * 0.15);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={event.logo_url}
          alt=""
          width={size - padding * 2}
          height={size - padding * 2}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
