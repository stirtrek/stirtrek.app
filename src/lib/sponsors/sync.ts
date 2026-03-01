import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";

const SPONSORS_FEED_URL = "https://stirtrek.com/api/sponsors/current.json";

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

export async function syncSponsorsFromFeed() {
  const telemetry = getTelemetryService();
  return telemetry.trackSponsorSync(async () => {
    const res = await fetch(SPONSORS_FEED_URL, { cache: "no-store" });
    if (!res.ok) {
      return { error: `Failed to fetch sponsor feed: ${res.status}` };
    }

    const data: FeedResponse = await res.json();
    const sponsorsByTier = data.sponsors ?? data;

    const admin = createAdminClient();

    // Get existing sponsors for matching by name
    const { data: existing } = await admin
      .from("sponsors")
      .select("id, name");
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

    telemetry.logInfo("Sponsor sync completed", { synced });

    return { synced, error: null };
  });
}
