"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Bookmark } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useEvent } from "@/providers/event-provider";

interface SessionBookmark {
  id: string;
  title: string;
  starts_at: string | null;
  room: string | null;
  bookmarks: number;
}

export default function AdminBookmarksPage() {
  const { eventSlug, eventPath } = useEvent();
  const [sessions, setSessions] = useState<SessionBookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/${eventSlug}/api/admin/bookmarks`)
      .then((res) => (res.ok ? res.json() : { sessions: [] }))
      .then((data) => setSessions(data.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group by time slot
  const timeSlots = new Map<string, SessionBookmark[]>();
  for (const s of sessions) {
    const key = s.starts_at ?? "unscheduled";
    if (!timeSlots.has(key)) timeSlots.set(key, []);
    timeSlots.get(key)!.push(s);
  }

  // Sort each slot by bookmarks descending
  for (const group of timeSlots.values()) {
    group.sort((a, b) => b.bookmarks - a.bookmarks);
  }

  // Sort time slots chronologically
  const sortedSlots = [...timeSlots.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Bookmarked Sessions</h1>
      </div>

      <p className="text-xs text-muted-foreground">
        All sessions ranked by bookmark count per time slot. Use this to plan
        room assignments — high-demand talks need bigger rooms.
      </p>

      {sortedSlots.map(([time, group]) => (
        <Card key={time}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
              {time === "unscheduled" ? "Unscheduled" : formatTime(time)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1">
              {group.map((session, i) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between gap-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs font-bold text-muted-foreground w-4 text-right">
                        {i + 1}
                      </span>
                      <p className="truncate text-xs font-medium">
                        {session.title}
                      </p>
                    </div>
                    {session.room && (
                      <p className="ml-[22px] text-[10px] text-muted-foreground">
                        {session.room}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Bookmark className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold tabular-nums">
                      {session.bookmarks}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
