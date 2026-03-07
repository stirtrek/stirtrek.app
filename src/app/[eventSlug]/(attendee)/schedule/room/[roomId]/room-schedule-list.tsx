"use client";

import { SessionCard } from "@/components/schedule/session-card";
import { formatTime } from "@/lib/utils";
import { useEvent } from "@/providers/event-provider";
import type { SessionWithDetails } from "@/lib/types";

interface RoomScheduleListProps {
  sessions: SessionWithDetails[];
}

export function RoomScheduleList({ sessions }: RoomScheduleListProps) {
  const { event } = useEvent();

  if (sessions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No sessions scheduled in this room.
      </p>
    );
  }

  // Group sessions by start time
  const grouped = sessions.reduce<Record<string, SessionWithDetails[]>>(
    (acc, session) => {
      const key = session.starts_at || "unscheduled";
      if (!acc[key]) acc[key] = [];
      acc[key].push(session);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([startsAt, group]) => (
        <div key={startsAt} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {startsAt === "unscheduled"
              ? "Unscheduled"
              : formatTime(startsAt, event.timezone)}
          </h2>
          <div className="space-y-2">
            {group.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
