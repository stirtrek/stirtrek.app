import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select("slug, domain, updated_at")
    .eq("is_active", true)
    .eq("show_on_marketing", true);

  const eventEntries: MetadataRoute.Sitemap = (events ?? []).map((event) => ({
    url: event.domain
      ? `https://${event.domain}`
      : `https://conferenceday.app/${event.slug}`,
    lastModified: event.updated_at ?? new Date().toISOString(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: "https://conferenceday.app",
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...eventEntries,
  ];
}
