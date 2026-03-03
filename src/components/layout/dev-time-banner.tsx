"use client";

import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { useEvent } from "@/providers/event-provider";

export function DevTimeBanner() {
  const { simulatedTime } = useSimulatedTime();
  const { event } = useEvent();

  if (!simulatedTime) return null;

  const formatted = new Date(simulatedTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone,
  });

  return (
    <div className="sticky top-14 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-black">
      DEV MODE: Simulated time is {formatted}
    </div>
  );
}
