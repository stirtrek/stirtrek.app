import { SessionCard } from "./session-card";
import { formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { SessionWithDetails } from "@/lib/types";

interface TimeSlotGroupProps {
  time: string;
  endTime: string;
  sessions: SessionWithDetails[];
  conflictCount?: number;
  highlightBookmarks?: boolean;
}

export function TimeSlotGroup({
  time,
  endTime,
  sessions,
  conflictCount,
  highlightBookmarks,
}: TimeSlotGroupProps) {
  return (
    <div id={`slot-${time}`} className="space-y-2">
      <div className="py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {formatTime(time)} - {formatTime(endTime)}
          </h2>
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
          <SessionCard key={session.id} session={session} highlightBookmark={highlightBookmarks} />
        ))}
      </div>
    </div>
  );
}
