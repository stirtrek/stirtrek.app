"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimeSlotChips } from "./time-slot-chips";
import { TimeSlotGroup } from "./time-slot-group";
import { useBookmarks } from "@/providers/bookmark-provider";
import { useAuth } from "@/providers/auth-provider";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { useEvent } from "@/providers/event-provider";
import { Bookmark, Info, Loader2 } from "lucide-react";
import { findCurrentSlot } from "@/lib/utils";
import type { SessionWithDetails } from "@/lib/types";

interface ScheduleGridProps {
  sessions: SessionWithDetails[];
}

function groupByTimeSlot(sessions: SessionWithDetails[]) {
  const groups = new Map<
    string,
    { endTime: string; sessions: SessionWithDetails[] }
  >();

  for (const session of sessions) {
    if (!session.starts_at) continue;
    const key = session.starts_at;
    const existing = groups.get(key);
    if (existing) {
      existing.sessions.push(session);
    } else {
      groups.set(key, {
        endTime: session.ends_at || session.starts_at,
        sessions: [session],
      });
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, { endTime, sessions }]) => ({
      time,
      endTime,
      sessions: sessions.sort((a, b) => {
        if (a.is_service_session !== b.is_service_session)
          return a.is_service_session ? -1 : 1;
        return (a.room?.sort_order ?? 0) - (b.room?.sort_order ?? 0);
      }),
    }));
}

export function ScheduleGrid({ sessions }: ScheduleGridProps) {
  const searchParams = useSearchParams();
  const defaultTab =
    searchParams.get("tab") === "my-schedule" ? "my-schedule" : "full-schedule";
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { bookmarkedIds, loading: bookmarksLoading } = useBookmarks();
  const { getNow, loading: timeLoading } = useSimulatedTime();
  const { event } = useEvent();

  // Unique start times for non-service sessions
  const timeSlotTimes = useMemo(() => {
    const times = new Set<string>();
    for (const s of sessions) {
      if (!s.is_service_session && s.starts_at) {
        times.add(s.starts_at);
      }
    }
    return Array.from(times).sort();
  }, [sessions]);

  // Auto-select the current time slot once simulated time is loaded
  useEffect(() => {
    if (timeLoading) return;
    const current = findCurrentSlot(timeSlotTimes, getNow(), event.event_date ?? "");
    if (current) setActiveSlot(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSlotTimes, timeLoading]);

  // Full schedule time slots (filtered by active chip)
  const fullTimeSlots = useMemo(() => {
    const filtered = activeSlot
      ? sessions.filter((s) => s.starts_at === activeSlot)
      : sessions;
    return groupByTimeSlot(filtered);
  }, [sessions, activeSlot]);

  // My schedule: bookmarked sessions + service sessions for day context
  const myTimeSlots = useMemo(() => {
    const filtered = sessions.filter(
      (s) => s.is_service_session || bookmarkedIds.has(s.id)
    );
    return groupByTimeSlot(filtered);
  }, [sessions, bookmarkedIds]);

  // Count bookmarked non-service sessions per time slot (for conflict detection)
  const conflictCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (!s.is_service_session && s.starts_at && bookmarkedIds.has(s.id)) {
        counts.set(s.starts_at, (counts.get(s.starts_at) || 0) + 1);
      }
    }
    return counts;
  }, [sessions, bookmarkedIds]);

  // Wait for auth to resolve before rendering the schedule
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">
          No sessions available. An admin needs to sync from Sessionize first.
        </p>
      </div>
    );
  }

  const hasBookmarks = bookmarkedIds.size > 0;

  // Logged-out: show read-only schedule with time chips, no tabs
  if (!user) {
    return (
      <div className="space-y-0">
        <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur">
          <TimeSlotChips
            times={timeSlotTimes}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
          />
        </div>
        <div className="space-y-6 pt-2">
          {fullTimeSlots.map((slot) => (
            <TimeSlotGroup
              key={slot.time}
              time={slot.time}
              endTime={slot.endTime}
              sessions={slot.sessions}
              variant="full-schedule"
            />
          ))}
        </div>
      </div>
    );
  }

  // Logged-in: show tabs with Full Schedule + My Schedule
  return (
    <Tabs defaultValue={defaultTab} className="space-y-0">
      <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur">
        <TabsList className="w-full">
          <TabsTrigger value="full-schedule">Full Schedule</TabsTrigger>
          <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="full-schedule">
        <div className="sticky top-[6.5rem] z-20 -mx-4 bg-background/95 px-4 pb-2 backdrop-blur">
          <TimeSlotChips
            times={timeSlotTimes}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
          />
        </div>
        <div className="space-y-6 pt-2">
          {fullTimeSlots.map((slot) => (
            <TimeSlotGroup
              key={slot.time}
              time={slot.time}
              endTime={slot.endTime}
              sessions={slot.sessions}
              highlightBookmarks
              variant="full-schedule"
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="my-schedule">
        <div className="space-y-4 pt-4">
          <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Can&apos;t decide? All sessions are recorded and available on
              the{" "}
              <a
                href="https://www.youtube.com/@StirTrek"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Stir Trek YouTube channel
              </a>{" "}
              after the event.
            </p>
          </div>

          {bookmarksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasBookmarks ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Bookmark className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                Tap the bookmark icon on any session to build your personal
                schedule.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {myTimeSlots.map((slot) => {
                const conflict = conflictCounts.get(slot.time);
                return (
                  <TimeSlotGroup
                    key={slot.time}
                    time={slot.time}
                    endTime={slot.endTime}
                    sessions={slot.sessions}
                    conflictCount={conflict}
                    variant="my-schedule"
                  />
                );
              })}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
