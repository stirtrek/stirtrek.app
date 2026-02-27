import { AttendeeQrCode } from "@/components/sponsors/attendee-qr-code";
import { SponsorList } from "@/components/sponsors/sponsor-list";

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

  return (
    <div className="space-y-6">
      <AttendeeQrCode />

      <SponsorList sponsorsByTier={sponsorsByTier} totalCount={totalCount} />
    </div>
  );
}
