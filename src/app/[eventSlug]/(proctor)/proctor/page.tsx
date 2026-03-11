"use client";

import { useState, useEffect, useCallback } from "react";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";

interface TimeSlot {
  starts_at: string;
  ends_at: string | null;
}

interface RoomEntry {
  room: {
    id: number;
    name: string;
    sort_order: number;
  };
  session: {
    id: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
  } | null;
  attendance: {
    count: number;
    counted_by_name: string;
    counted_at: string;
  } | null;
}

interface Summary {
  total_rooms: number;
  mapped_rooms: number;
  counted_rooms: number;
  total_attendance: number;
}

export default function ProctorPage() {
  const { event, eventSlug } = useEvent();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);

  // Fetch time slots on mount
  useEffect(() => {
    async function fetchSlots() {
      const res = await fetch(`/${eventSlug}/api/proctor/time-slots`);
      if (res.ok) {
        const d = await res.json();
        setTimeSlots(d.time_slots);

        // Auto-select current or first slot
        if (d.time_slots.length > 0) {
          const now = new Date();
          const current = d.time_slots.find((slot: TimeSlot) => {
            const start = new Date(slot.starts_at);
            const end = slot.ends_at ? new Date(slot.ends_at) : new Date(start.getTime() + 60 * 60 * 1000);
            return now >= start && now <= end;
          });
          setSelectedSlot(current?.starts_at ?? d.time_slots[0].starts_at);
        }
      }
      setLoading(false);
    }
    fetchSlots();
  }, [eventSlug]);

  // Fetch room data when slot changes
  const fetchRooms = useCallback(async () => {
    if (!selectedSlot) return;
    const res = await fetch(
      `/${eventSlug}/api/proctor/attendance?time_slot=${encodeURIComponent(selectedSlot)}`
    );
    if (res.ok) {
      const d = await res.json();
      setRooms(d.rooms);
      setSummary(d.summary);

      // Pre-populate existing counts
      const existingCounts: Record<number, string> = {};
      for (const entry of d.rooms) {
        if (entry.attendance) {
          existingCounts[entry.room.id] = String(entry.attendance.count);
        }
      }
      setCounts(existingCounts);
    }
  }, [eventSlug, selectedSlot]);

  useEffect(() => {
    if (selectedSlot) {
      fetchRooms();
    }
  }, [selectedSlot, fetchRooms]);

  async function saveCount(roomId: number, sessionId: string) {
    const countStr = counts[roomId];
    if (countStr === undefined || countStr === "") return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 0) {
      toast.error("Count must be a non-negative number");
      return;
    }

    setSaving(roomId);
    const res = await fetch(`/${eventSlug}/api/proctor/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, session_id: sessionId, count }),
    });

    if (res.ok) {
      toast.success("Count saved");
      // Refresh to get updated data
      await fetchRooms();
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to save");
    }
    setSaving(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (timeSlots.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Attendance</h1>
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              No sessions have been mapped to rooms yet. An admin needs to set up
              session-room mappings first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter to only rooms that have a mapped session for this slot
  const mappedRooms = rooms.filter((e) => e.session !== null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Attendance</h1>

      {/* Time slot selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {timeSlots.map((slot) => (
          <button
            key={slot.starts_at}
            onClick={() => setSelectedSlot(slot.starts_at)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedSlot === slot.starts_at
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {formatTime(slot.starts_at, event.timezone)}
          </button>
        ))}
      </div>

      {/* Room cards */}
      {mappedRooms.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No rooms mapped for this time slot.
        </p>
      ) : (
        <div className="space-y-2">
          {mappedRooms.map((entry) => {
            const { room, session, attendance } = entry;
            const hasCount = attendance !== null;
            const inputValue = counts[room.id] ?? "";

            return (
              <Card
                key={room.id}
                className={`gap-0 py-0 ${
                  hasCount
                    ? "border-green-500/30"
                    : "border-amber-500/30"
                }`}
              >
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{room.name}</p>
                        {hasCount && (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {session?.title ?? "No session"}
                      </p>
                      {attendance && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Last: {attendance.counted_by_name} at{" "}
                          {new Date(attendance.counted_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            timeZone: event.timezone,
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={inputValue}
                        onChange={(e) =>
                          setCounts((prev) => ({
                            ...prev,
                            [room.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && session) {
                            saveCount(room.id, session.id);
                          }
                        }}
                        placeholder="0"
                        className="h-10 w-20 text-center text-lg font-bold tabular-nums"
                      />
                      <Button
                        size="sm"
                        className="h-10"
                        disabled={
                          saving === room.id ||
                          !session ||
                          inputValue === "" ||
                          inputValue === String(attendance?.count)
                        }
                        onClick={() => {
                          if (session) saveCount(room.id, session.id);
                        }}
                      >
                        {saving === room.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      {summary && summary.mapped_rooms > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-sm">
            <span className="font-semibold tabular-nums">
              {summary.counted_rooms}
            </span>
            <span className="text-muted-foreground">
              {" "}
              of {summary.mapped_rooms} counted
            </span>
          </div>
          <div className="text-sm font-bold tabular-nums">
            {summary.total_attendance} total
          </div>
        </div>
      )}
    </div>
  );
}
