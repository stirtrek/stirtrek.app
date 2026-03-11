"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useEvent } from "@/providers/event-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Settings2, BarChart3, Check } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";
import type { Room } from "@/lib/types";

type View = "setup" | "report";

interface SessionEntry {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface RoomMapping {
  id: string;
  room_id: number;
  session_id: string;
}

interface AttendanceRow {
  session_id: string;
  room_id: number;
  count: number;
  room_name: string;
  session_title: string;
  starts_at: string | null;
  counted_by_name: string;
  counted_at: string;
}

export default function AttendanceAdminPage() {
  const { event, eventSlug, eventPath } = useEvent();
  const [view, setView] = useState<View>("setup");
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [mappings, setMappings] = useState<RoomMapping[]>([]);
  const [report, setReport] = useState<AttendanceRow[]>([]);
  const [sessionTotals, setSessionTotals] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    const [roomsRes, sessionsRes, mappingsRes] = await Promise.all([
      fetch(`/${eventSlug}/api/admin/rooms`),
      fetch(`/${eventSlug}/api/admin/sessions`),
      fetch(`/${eventSlug}/api/admin/session-rooms`),
    ]);

    if (roomsRes.ok) {
      const d = await roomsRes.json();
      setRooms(d.rooms);
    }
    if (sessionsRes.ok) {
      const d = await sessionsRes.json();
      setSessions(
        (d.sessions as SessionEntry[]).filter(
          (s: SessionEntry & { is_service_session?: boolean }) => !s.is_service_session
        )
      );
    }
    if (mappingsRes.ok) {
      const d = await mappingsRes.json();
      setMappings(d.session_rooms);
    }
    setLoading(false);
  }, [eventSlug]);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/${eventSlug}/api/admin/attendance`);
    if (res.ok) {
      const d = await res.json();
      setReport(d.report);
      setSessionTotals(d.session_totals);
    }
  }, [eventSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (view === "report") {
      fetchReport();
    }
  }, [view, fetchReport]);

  // Group sessions by time slot
  const timeSlots = sessions.reduce<Record<string, SessionEntry[]>>((acc, s) => {
    const key = s.starts_at || "unscheduled";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const sortedTimeSlots = Object.keys(timeSlots).sort();

  // Toggle a room mapping for a session
  async function toggleRoom(sessionId: string, roomId: number) {
    const existing = mappings.find(
      (m) => m.session_id === sessionId && m.room_id === roomId
    );

    if (existing) {
      // Remove
      const res = await fetch(`/${eventSlug}/api/admin/session-rooms`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existing.id }),
      });
      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== existing.id));
      } else {
        toast.error("Failed to remove mapping");
      }
    } else {
      // Add
      const res = await fetch(`/${eventSlug}/api/admin/session-rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, session_id: sessionId }),
      });
      if (res.ok) {
        const d = await res.json();
        setMappings((prev) => [...prev, d.session_room]);
      } else {
        toast.error("Failed to add mapping");
      }
    }
  }

  function isRoomMapped(sessionId: string, roomId: number) {
    return mappings.some(
      (m) => m.session_id === sessionId && m.room_id === roomId
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Attendance</h1>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button
          variant={view === "setup" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("setup")}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Setup
        </Button>
        <Button
          variant={view === "report" ? "default" : "outline"}
          size="sm"
          onClick={() => setView("report")}
        >
          <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
          Report
        </Button>
      </div>

      {view === "setup" && (
        <div className="space-y-4">
          {rooms.length === 0 && (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No rooms configured. Add rooms in the{" "}
                <Link href={eventPath("/admin/schedule")} className="underline">
                  Schedule
                </Link>{" "}
                page under the Rooms tab.
              </CardContent>
            </Card>
          )}

          {sortedTimeSlots.map((slot) => (
            <Card key={slot} className="gap-0 py-0">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm">
                  {slot === "unscheduled"
                    ? "Unscheduled"
                    : formatTime(slot, event.timezone)}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-3">
                  {timeSlots[slot].map((session) => {
                    const mappedCount = rooms.filter((r) =>
                      isRoomMapped(session.id, r.id)
                    ).length;

                    return (
                      <div key={session.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">
                            {session.title}
                          </p>
                          <Badge variant="outline" className="shrink-0 text-[10px] ml-2">
                            {mappedCount} room{mappedCount !== 1 && "s"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {rooms.map((room) => {
                            const mapped = isRoomMapped(
                              session.id,
                              room.id
                            );
                            return (
                              <button
                                key={room.id}
                                onClick={() =>
                                  toggleRoom(session.id, room.id)
                                }
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                                  mapped
                                    ? "border-green-500/50 bg-green-500/10 text-green-700"
                                    : "border-border text-muted-foreground hover:border-foreground/30"
                                }`}
                              >
                                {mapped && <Check className="h-3 w-3" />}
                                {room.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "report" && (
        <div className="space-y-4">
          {report.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                No attendance data recorded yet.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Grand total */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="text-sm font-medium">Total Attendance</span>
                <span className="text-lg font-bold tabular-nums">
                  {Object.values(sessionTotals).reduce((a, b) => a + b, 0)}
                </span>
              </div>

              {/* Per-session breakdown */}
              {sortedTimeSlots.map((slot) => {
                const slotSessions = timeSlots[slot] || [];
                return slotSessions.map((session) => {
                  const sessionRows = report.filter(
                    (r) => r.session_id === session.id
                  );
                  if (sessionRows.length === 0) return null;

                  return (
                    <Card key={session.id} className="gap-0 py-0">
                      <CardHeader className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm truncate">
                            {session.title}
                          </CardTitle>
                          <span className="shrink-0 text-sm font-bold tabular-nums ml-2">
                            {sessionTotals[session.id] ?? 0}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.starts_at
                            ? formatTime(session.starts_at, event.timezone)
                            : "Unscheduled"}
                        </p>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <div className="space-y-1">
                          {sessionRows
                            .sort(
                              (a, b) =>
                                (a.room_name > b.room_name ? 1 : -1)
                            )
                            .map((row) => (
                              <div
                                key={`${row.session_id}-${row.room_id}`}
                                className="flex items-center justify-between py-1 text-sm"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate">
                                    {row.room_name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    by {row.counted_by_name}
                                  </span>
                                </div>
                                <span className="font-semibold tabular-nums shrink-0 ml-2">
                                  {row.count}
                                </span>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                });
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
