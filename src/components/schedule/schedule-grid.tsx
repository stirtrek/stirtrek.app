"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TimeSlotChips } from "./time-slot-chips";
import { TimeSlotGroup } from "./time-slot-group";
import { useBookmarks } from "@/providers/bookmark-provider";
import { useAuth } from "@/providers/auth-provider";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { useEvent } from "@/providers/event-provider";
import { AddToCalendarButton } from "./add-to-calendar-button";
import ReactMarkdown from "react-markdown";
import { Bookmark, Info, Loader2 } from "lucide-react";
import { findCurrentSlot, getSessionDate } from "@/lib/utils";
import { DaySelector } from "./day-selector";
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
  const router = useRouter();
  const pathname = usePathname();
  const activeTab =
    searchParams.get("tab") === "my-schedule" ? "my-schedule" : "full-schedule";
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { bookmarkedIds, loading: bookmarksLoading } = useBookmarks();
  const { getNow, loading: timeLoading } = useSimulatedTime();
  const { event } = useEvent();

  // Derive distinct event days from session timestamps
  const eventDays = useMemo(() => {
    const days = new Set<string>();
    for (const s of sessions) {
      if (s.starts_at) {
        days.add(getSessionDate(s.starts_at, event.timezone));
      }
    }
    return Array.from(days).sort();
  }, [sessions, event.timezone]);

  const isMultiDay = eventDays.length > 1;

  // Initialize activeDay once simulated time is loaded (multi-day only)
  useEffect(() => {
    if (timeLoading || !isMultiDay) return;
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: event.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(getNow());
    setActiveDay(eventDays.includes(today) ? today : eventDays[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventDays, timeLoading, isMultiDay]);

  // Reset time chip filter when switching days
  useEffect(() => {
    setActiveSlot(null);
  }, [activeDay]);

  // Sessions filtered to the active day (passthrough for single-day events)
  const daySessions = useMemo(() => {
    if (!isMultiDay || !activeDay) return sessions;
    return sessions.filter((s) => {
      if (!s.starts_at) return false;
      return getSessionDate(s.starts_at, event.timezone) === activeDay;
    });
  }, [sessions, activeDay, isMultiDay, event.timezone]);

  // Unique start times for non-service sessions (scoped to active day)
  const timeSlotTimes = useMemo(() => {
    const times = new Set<string>();
    for (const s of daySessions) {
      if (!s.is_service_session && s.starts_at) {
        times.add(s.starts_at);
      }
    }
    return Array.from(times).sort();
  }, [daySessions]);

  // Auto-select the current time slot once simulated time is loaded
  useEffect(() => {
    if (timeLoading) return;
    const current = findCurrentSlot(timeSlotTimes, getNow(), eventDays, event.timezone);
    if (current) setActiveSlot(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeSlotTimes, timeLoading]);

  // Full schedule time slots (filtered by active chip, scoped to active day)
  const fullTimeSlots = useMemo(() => {
    const filtered = activeSlot
      ? daySessions.filter((s) => s.starts_at === activeSlot)
      : daySessions;
    return groupByTimeSlot(filtered);
  }, [daySessions, activeSlot]);

  // My schedule: bookmarked sessions + service sessions (scoped to active day)
  const myTimeSlots = useMemo(() => {
    const filtered = daySessions.filter(
      (s) => s.is_service_session || bookmarkedIds.has(s.id)
    );
    return groupByTimeSlot(filtered);
  }, [daySessions, bookmarkedIds]);

  // Count bookmarked non-service sessions per time slot (scoped to active day)
  const conflictCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of daySessions) {
      if (!s.is_service_session && s.starts_at && bookmarkedIds.has(s.id)) {
        counts.set(s.starts_at, (counts.get(s.starts_at) || 0) + 1);
      }
    }
    return counts;
  }, [daySessions, bookmarkedIds]);

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

  // Bookmarked non-service sessions for calendar export (scoped to active day)
  const bookmarkedSessions = useMemo(
    () => daySessions.filter((s) => !s.is_service_session && bookmarkedIds.has(s.id)),
    [daySessions, bookmarkedIds],
  );

  // Logged-out: show read-only schedule with time chips, no tabs
  if (!authLoading && !user) {
    return (
      <div className="space-y-0">
        <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur">
          {isMultiDay && (
            <DaySelector
              days={eventDays}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              timezone={event.timezone}
            />
          )}
          <TimeSlotChips
            times={timeSlotTimes}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
            timezone={event.timezone}
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
              timezone={event.timezone}
            />
          ))}
        </div>
      </div>
    );
  }

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "my-schedule") {
      params.set("tab", "my-schedule");
    } else {
      params.delete("tab");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Logged-in: show tabs with Full Schedule + My Schedule
  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0">
      <div className="sticky top-14 z-20 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur">
        <TabsList className="w-full">
          <TabsTrigger value="full-schedule">Full Schedule</TabsTrigger>
          <TabsTrigger value="my-schedule">My Schedule</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="full-schedule">
        <div className="sticky top-[6.5rem] z-20 -mx-4 bg-background/95 px-4 pb-2 backdrop-blur">
          {isMultiDay && (
            <DaySelector
              days={eventDays}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              timezone={event.timezone}
            />
          )}
          <TimeSlotChips
            times={timeSlotTimes}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
            timezone={event.timezone}
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
              timezone={event.timezone}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="my-schedule">
        <div className="space-y-4 pt-4">
          {isMultiDay && (
            <DaySelector
              days={eventDays}
              activeDay={activeDay}
              onSelectDay={setActiveDay}
              timezone={event.timezone}
            />
          )}
          {event.schedule_message && (
            <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="text-xs text-muted-foreground [&_p]:m-0 [&_a]:underline">
                <ReactMarkdown
                  components={{
                    a: ({ children, href, ...props }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                        {children}
                      </a>
                    ),
                  }}
                >
                  {event.schedule_message}
                </ReactMarkdown>
              </div>
            </div>
          )}

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
              <div className="flex justify-end">
                <AddToCalendarButton
                  sessions={bookmarkedSessions}
                  label="Export All"
                />
              </div>
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
                    timezone={event.timezone}
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
