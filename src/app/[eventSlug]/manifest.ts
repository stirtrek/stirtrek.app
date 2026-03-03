import type { MetadataRoute } from "next";
import { resolveEvent } from "@/lib/events/resolve";

export default async function manifest({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}): Promise<MetadataRoute.Manifest> {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);

  const name = event?.name ?? "Conference App";
  const shortName = event?.short_name ?? event?.name ?? "Conference";

  return {
    name,
    short_name: shortName,
    description: event?.description ?? `${name} - Day-of Attendee App`,
    start_url: `/${eventSlug}`,
    scope: `/${eventSlug}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a2e",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["events", "social"],
  };
}
