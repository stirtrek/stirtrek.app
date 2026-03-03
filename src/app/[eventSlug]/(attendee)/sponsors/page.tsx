import { createAdminClient } from "@/lib/supabase/admin";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";
import { AttendeeQrCode } from "@/components/sponsors/attendee-qr-code";
import { SponsorList } from "@/components/sponsors/sponsor-list";
import type { Sponsor } from "@/lib/types";

export const metadata = {
  title: "Sponsors",
};

export default async function SponsorsPage({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  const supabase = createAdminClient();

  const { data: sponsors } = await supabase
    .from("sponsors")
    .select("*")
    .eq("event_id", event.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const sponsorsByTier: Record<string, Sponsor[]> = {};
  for (const sponsor of (sponsors ?? []) as Sponsor[]) {
    const tier = sponsor.tier;
    if (!sponsorsByTier[tier]) sponsorsByTier[tier] = [];
    sponsorsByTier[tier].push(sponsor);
  }

  const totalCount = (sponsors ?? []).length;

  if (totalCount === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Sponsors</h1>
        <p className="text-muted-foreground">
          No sponsor information is available for this event yet.
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
