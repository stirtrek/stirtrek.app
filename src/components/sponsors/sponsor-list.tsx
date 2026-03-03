"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { SponsorCard } from "@/components/sponsors/sponsor-card";
import { SPONSOR_TIER_ORDER, BOOTH_SPONSOR_TIERS } from "@/lib/constants";
import confetti from "canvas-confetti";

interface ApiSponsor {
  name: string;
  link: string;
  description: string;
  logo: string;
}

type SponsorsByTier = Record<string, ApiSponsor[]>;

const tierLabels: Record<string, string> = {
  platinum: "Platinum Sponsors",
  gold: "Gold Sponsors",
  silver: "Silver Sponsors",
  bronze: "Bronze Sponsors",
  community: "Community Sponsors",
};

interface SponsorListProps {
  sponsorsByTier: SponsorsByTier;
  totalCount: number;
}

export function SponsorList({ sponsorsByTier, totalCount }: SponsorListProps) {
  const { profile } = useAuth();
  const { eventSlug } = useEvent();
  const [visitedNames, setVisitedNames] = useState<Set<string>>(new Set());
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!profile) return;

    fetch(`/${eventSlug}/api/passport`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.visitedSponsorNames) {
          setVisitedNames(new Set(data.visitedSponsorNames));
        }
      })
      .catch(() => {});
  }, [profile]);

  // Count booth sponsors and visited for progress
  const boothTiers = new Set<string>(BOOTH_SPONSOR_TIERS);
  const boothSponsors = SPONSOR_TIER_ORDER.flatMap((tier) =>
    boothTiers.has(tier) ? (sponsorsByTier[tier] ?? []) : []
  );
  const boothTotal = boothSponsors.length;
  const visitedCount = boothSponsors.filter((s) =>
    visitedNames.has(s.name)
  ).length;
  const allVisited = boothTotal > 0 && visitedCount >= boothTotal;

  // Confetti when all visited
  useEffect(() => {
    if (confettiFired.current || !allVisited) return;
    confettiFired.current = true;
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#FF3B3B", "#FFD36E", "#F4F6F8", "#c48c2f", "#0169AC"],
    });
  }, [allVisited]);

  const showProgress = profile && boothTotal > 0 && visitedNames.size > 0;

  return (
    <>
      {showProgress && (
        <div className="rounded-lg border-2 border-[#c48c2f] bg-[#c48c2f]/10 p-4 shadow-[2px_2px_0_#c48c2f]">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Sponsor Passport</span>
              <span className="text-muted-foreground">
                {visitedCount} / {boothTotal} visited
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#c48c2f] transition-all duration-500"
                style={{
                  width: `${Math.round((visitedCount / boothTotal) * 100)}%`,
                }}
              />
            </div>
            {allVisited && (
              <p className="text-center text-sm font-medium text-green-400">
                You visited every sponsor booth!
              </p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border-2 border-[#c48c2f] bg-[#c48c2f]/10 px-3 py-2 shadow-[2px_2px_0_#c48c2f]">
        <p className="text-xs text-center text-[#FFD36E] font-medium whitespace-nowrap">
          Thanks to our sponsors for making Stir Trek possible!
        </p>
      </div>

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
                  visited={visitedNames.has(sponsor.name)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
