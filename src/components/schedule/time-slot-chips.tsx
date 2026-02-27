"use client";

import { cn, formatTime } from "@/lib/utils";

interface TimeSlotChipsProps {
  times: string[];
  activeSlot: string | null;
  onSelectSlot: (time: string | null) => void;
}

export function TimeSlotChips({
  times,
  activeSlot,
  onSelectSlot,
}: TimeSlotChipsProps) {
  const cols = Math.ceil(times.length / 2);

  const chipClass =
    "cursor-pointer whitespace-nowrap rounded-md border px-1 py-1.5 text-center text-xs font-semibold transition-colors";

  return (
    <div className="flex gap-2 pb-2">
      {/* All button — squircle spanning both rows */}
      <button
        onClick={() => onSelectSlot(null)}
        className={cn(
          "shrink-0 cursor-pointer self-stretch rounded-xl border px-3 text-sm font-semibold transition-colors",
          activeSlot === null
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground hover:bg-accent"
        )}
      >
        All
      </button>

      {/* Time chips in a uniform grid */}
      <div
        className="min-w-0 flex-1 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {times.map((time) => (
          <button
            key={time}
            onClick={() => onSelectSlot(activeSlot === time ? null : time)}
            className={cn(
              chipClass,
              activeSlot === time
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-accent"
            )}
          >
            {formatTime(time)}
          </button>
        ))}
      </div>
    </div>
  );
}
