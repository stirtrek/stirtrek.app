import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

interface FeedSponsor {
  name: string;
  link: string;
  description: string;
  logo: string;
}

type FeedResponse = {
  sponsors?: Record<string, FeedSponsor[]>;
} & Record<string, FeedSponsor[]>;

const TIER_ORDER: Record<string, number> = {
  platinum: 0,
  gold: 100,
  silver: 200,
  bronze: 300,
  community: 400,
};

/**
 * Sync sponsors from an external feed URL for a specific event.
 * Reads the sponsor_feed_url from the event record.
 * Falls back to the hardcoded Stir Trek URL if no eventId provided.
 */
export async function syncSponsorsFromFeed(eventId?: string) {
  const telemetry = getTelemetryService();
  return telemetry.trackSponsorSync(async () => {
    const admin = createAdminClient();

    // Resolve feed URL from event record or use default
    let feedUrl = "https://stirtrek.com/api/sponsors/current.json";
    const resolvedEventId =
      eventId || "00000000-0000-0000-0000-000000000001";

    if (eventId) {
      const { data: event } = await admin
        .from("events")
        .select("sponsor_feed_url")
        .eq("id", eventId)
        .single();

      if (!event?.sponsor_feed_url) {
        return { synced: 0, error: "No sponsor feed URL configured for this event" };
      }
      feedUrl = event.sponsor_feed_url;
    }

    const res = await fetch(feedUrl, { cache: "no-store" });
    if (!res.ok) {
      return { error: `Failed to fetch sponsor feed: ${res.status}` };
    }

    const data: FeedResponse = await res.json();
    const sponsorsByTier = data.sponsors ?? data;

    // Get existing sponsors for this event for matching by name
    const { data: existing } = await admin
      .from("sponsors")
      .select("id, name")
      .eq("event_id", resolvedEventId);
    const existingMap = new Map(
      (existing ?? []).map((s) => [s.name, s.id]),
    );

    let synced = 0;

    for (const [tier, sponsors] of Object.entries(sponsorsByTier)) {
      if (!Array.isArray(sponsors)) continue;

      const baseSortOrder = TIER_ORDER[tier] ?? 500;

      for (let i = 0; i < sponsors.length; i++) {
        const sponsor = sponsors[i];
        const logoUrl = sponsor.logo
          ? sponsor.logo.startsWith("http")
            ? sponsor.logo
            : `https://stirtrek.com${sponsor.logo}`
          : null;

        const record = {
          name: sponsor.name,
          event_id: resolvedEventId,
          tier,
          website_url: sponsor.link || null,
          description: sponsor.description || null,
          logo_url: logoUrl,
          sort_order: baseSortOrder + i,
          is_active: true,
        };

        const existingId = existingMap.get(sponsor.name);

        if (existingId) {
          // Update existing
          await admin.from("sponsors").update(record).eq("id", existingId);
        } else {
          // Insert new
          await admin.from("sponsors").insert(record);
        }

        synced++;
      }
    }

    telemetry.logInfo("Sponsor sync completed", {
      eventId: resolvedEventId,
      synced,
    });

    return { synced, error: null };
  });
}
