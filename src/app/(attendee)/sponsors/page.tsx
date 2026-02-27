import { SponsorCard } from "@/components/sponsors/sponsor-card";
import { SPONSOR_TIER_ORDER } from "@/lib/constants";

export const metadata = {
  title: "Sponsors",
};

interface ApiSponsor {
  name: string;
  link: string;
  description: string;
  logo: string;
}

type SponsorsByTier = Record<string, ApiSponsor[]>;

async function getSponsors(): Promise<SponsorsByTier> {
  const res = await fetch("https://stirtrek.com/api/sponsors/current.json", {
    next: { revalidate: 3600 },
  });

  if (!res.ok) return {};

  const data = await res.json();
  return data.sponsors ?? {};
}

export default async function SponsorsPage() {
  const sponsorsByTier = await getSponsors();

  const totalCount = Object.values(sponsorsByTier).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Sponsors</h1>
        <p className="text-muted-foreground">
          Sponsor information will appear here closer to the event.
        </p>
      </div>
    );
  }

  const tierLabels: Record<string, string> = {
    platinum: "Platinum Sponsors",
    gold: "Gold Sponsors",
    silver: "Silver Sponsors",
    bronze: "Bronze Sponsors",
    community: "Community Sponsors",
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Thank you to our {totalCount} sponsors for making Stir Trek possible!
      </p>

      {SPONSOR_TIER_ORDER.map((tier) => {
        const tierSponsors = sponsorsByTier[tier];
        if (!tierSponsors || tierSponsors.length === 0) return null;

        return (
          <section key={tier} className="space-y-3">
            <h2 className="text-lg font-semibold capitalize">
              {tierLabels[tier] ?? tier}
            </h2>
            <div className="flex flex-col gap-3">
              {tierSponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.name}
                  name={sponsor.name}
                  url={sponsor.link}
                  imageUrl={`https://stirtrek.com${sponsor.logo}`}
                  description={sponsor.description}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
