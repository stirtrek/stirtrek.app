"use client";

import { SessionCard } from "./session-card";
import { formatTime, isHappeningNow } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import type { SessionWithDetails } from "@/lib/types";

interface TimeSlotGroupProps {
  time: string;
  endTime: string;
  sessions: SessionWithDetails[];
  conflictCount?: number;
  highlightBookmarks?: boolean;
  variant?: "full-schedule" | "my-schedule";
  timezone: string;
}

export function TimeSlotGroup({
  time,
  endTime,
  sessions,
  conflictCount,
  highlightBookmarks,
  variant,
  timezone,
}: TimeSlotGroupProps) {
  const { getNow } = useSimulatedTime();
  const isLive = isHappeningNow(time, endTime, getNow());

  return (
    <div id={`slot-${time}`} className="space-y-2">
      <div className="py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {formatTime(time, timezone)} - {formatTime(endTime, timezone)}
          </h2>
          {isLive && (
            <Badge
              variant="outline"
              className="border-green-500 text-green-500 text-[10px] px-1.5 py-0"
            >
              <span className="relative mr-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live
            </Badge>
          )}
          {conflictCount && conflictCount > 1 && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-500 text-[10px] px-1.5 py-0"
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              {conflictCount} sessions
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            highlightBookmark={highlightBookmarks}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
