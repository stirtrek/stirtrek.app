"use client";

import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { parseSessionizeTime } from "@/lib/utils";

export function DevTimeBanner() {
  const { simulatedTime } = useSimulatedTime();

  if (!simulatedTime) return null;

  const formatted = parseSessionizeTime(simulatedTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="sticky top-14 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-black">
      DEV MODE: Simulated time is {formatted}
    </div>
  );
}
