"use client";

import { cn, formatDayLabel } from "@/lib/utils";

interface DaySelectorProps {
  days: string[];
  activeDay: string | null;
  onSelectDay: (day: string) => void;
  timezone: string;
}

export function DaySelector({
  days,
  activeDay,
  onSelectDay,
  timezone,
}: DaySelectorProps) {
  return (
    <div className="flex gap-2 pb-2">
      {days.map((day) => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
            activeDay === day
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:bg-accent",
          )}
        >
          {formatDayLabel(day, timezone)}
        </button>
      ))}
    </div>
  );
}
