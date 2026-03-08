"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { SponsorCard } from "@/components/sponsors/sponsor-card";
import { DEFAULT_SPONSOR_TIERS } from "@/lib/constants";
import confetti from "canvas-confetti";
import type { Sponsor, SponsorTierConfig } from "@/lib/types";

type SponsorsByTier = Record<string, Sponsor[]>;

interface SponsorListProps {
  sponsorsByTier: SponsorsByTier;
  totalCount: number;
}

export function SponsorList({ sponsorsByTier, totalCount }: SponsorListProps) {
  const { profile } = useAuth();
  const { event, eventSlug } = useEvent();
  const [visitedNames, setVisitedNames] = useState<Set<string>>(new Set());
  const confettiFired = useRef(false);

  const tiers: SponsorTierConfig[] = event.sponsor_tiers ?? DEFAULT_SPONSOR_TIERS;
  const sortedTiers = [...tiers].sort((a, b) => a.sort_order - b.sort_order);

  useEffect(() => {
    if (!profile) return;

    fetch(`/${eventSlug}/api/passport`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.visitedSponsorNames) {
          setVisitedNames(new Set(data.visitedSponsorNames));
        }
      })
      .catch((err) => console.error("Failed to load passport data:", err));
  }, [profile, eventSlug]);

  // Count booth sponsors and visited for progress
  const boothTierKeys = new Set(
    sortedTiers.filter((t) => t.has_booth).map((t) => t.key),
  );
  const boothSponsors = sortedTiers.flatMap((tier) =>
    boothTierKeys.has(tier.key) ? (sponsorsByTier[tier.key] ?? []) : [],
  );
  const boothTotal = boothSponsors.length;
  const visitedCount = boothSponsors.filter((s) =>
    visitedNames.has(s.name),
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
  const eventName = event?.name ?? "this event";

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
          Thanks to our sponsors for making {eventName} possible!
        </p>
      </div>

      {sortedTiers.map((tierConfig) => {
        const tierSponsors = sponsorsByTier[tierConfig.key];
        if (!tierSponsors || tierSponsors.length === 0) return null;

        return (
          <section key={tierConfig.key} className="space-y-3">
            <h2 className="text-lg font-semibold capitalize">
              {tierConfig.label} Sponsors
            </h2>
            <div className="flex flex-col gap-3">
              {tierSponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  name={sponsor.name}
                  url={sponsor.website_url ?? "#"}
                  imageUrl={sponsor.logo_url ?? ""}
                  description={sponsor.description ?? undefined}
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
