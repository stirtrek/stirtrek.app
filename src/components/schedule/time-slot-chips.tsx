"use client";

import { Badge } from "@/components/ui/badge";
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
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <Badge
        variant={activeSlot === null ? "default" : "outline"}
        className={cn(
          "shrink-0 cursor-pointer",
          activeSlot === null && "bg-primary"
        )}
        onClick={() => onSelectSlot(null)}
      >
        All
      </Badge>
      {times.map((time) => (
        <Badge
          key={time}
          variant={activeSlot === time ? "default" : "outline"}
          className={cn(
            "shrink-0 cursor-pointer whitespace-nowrap",
            activeSlot === time && "bg-primary"
          )}
          onClick={() => onSelectSlot(activeSlot === time ? null : time)}
        >
          {formatTime(time)}
        </Badge>
      ))}
    </div>
  );
}
