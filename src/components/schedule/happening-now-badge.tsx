"use client";

import { isHappeningNow } from "@/lib/utils";
import { useSimulatedTime } from "@/providers/simulated-time-provider";

interface HappeningNowBadgeProps {
  startsAt: string | null;
  endsAt: string | null;
}

export function HappeningNowBadge({ startsAt, endsAt }: HappeningNowBadgeProps) {
  const { getNow } = useSimulatedTime();

  if (!isHappeningNow(startsAt, endsAt, getNow())) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Now
    </span>
  );
}
