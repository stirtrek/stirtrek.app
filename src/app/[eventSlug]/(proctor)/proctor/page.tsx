"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";

const AUTOSAVE_DEBOUNCE_MS = 1500;

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
  is_simulcast: boolean;
  attendance: {
    count: number;
    counted_by_name: string;
    counted_at: string;
  } | null;
}

interface Summary {
  total_rooms: number;
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
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  // Mirror of `counts` that's safe to read from setTimeout callbacks.
  // Keeps debounced saves from reading a stale closure (off-by-one bug).
  const countsRef = useRef<Record<number, string>>({});
  useEffect(() => {
    countsRef.current = counts;
  }, [counts]);

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
            const end = slot.ends_at
              ? new Date(slot.ends_at)
              : new Date(start.getTime() + 60 * 60 * 1000);
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

  const saveCount = useCallback(
    async (roomId: number) => {
      // Always read the latest value via the ref, never via a stale closure.
      const countStr = countsRef.current[roomId];
      if (countStr === undefined || countStr === "") return;

      const count = parseInt(countStr, 10);
      if (isNaN(count) || count < 0) {
        toast.error("Count must be a non-negative number");
        return;
      }

      // Snapshot what we're about to save so the post-save merge can tell
      // whether the user has typed/tapped a newer value during the round-trip.
      const savedValue = String(count);

      setSaving(roomId);
      setPending((prev) => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });

      const res = await fetch(`/${eventSlug}/api/proctor/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          time_slot: selectedSlot,
          count,
        }),
      });

      if (res.ok) {
        const refreshRes = await fetch(
          `/${eventSlug}/api/proctor/attendance?time_slot=${encodeURIComponent(selectedSlot!)}`,
        );
        if (refreshRes.ok) {
          const d = await refreshRes.json();
          setRooms(d.rooms);
          setSummary(d.summary);
          const serverCounts: Record<number, string> = {};
          for (const entry of d.rooms) {
            if (entry.attendance) {
              serverCounts[entry.room.id] = String(entry.attendance.count);
            }
          }
          // Use the functional setState form so we read the latest local
          // counts at the moment of merge — not a stale snapshot.
          setCounts((prev) => {
            const merged: Record<number, string> = {};
            const allIds = new Set<number>([
              ...Object.keys(prev).map(Number),
              ...Object.keys(serverCounts).map(Number),
            ]);
            for (const id of allIds) {
              const localValue = prev[id];
              const serverValue = serverCounts[id];

              if (id === roomId) {
                // For the room we just saved: only adopt the server value
                // when local still equals what we sent. If the user has
                // tapped/typed since, keep the newer local value (a fresh
                // debounced save is already scheduled for it).
                if (
                  localValue === savedValue &&
                  serverValue !== undefined
                ) {
                  merged[id] = serverValue;
                } else if (
                  localValue !== undefined &&
                  localValue !== ""
                ) {
                  merged[id] = localValue;
                } else if (serverValue !== undefined) {
                  merged[id] = serverValue;
                }
              } else {
                // For other rooms: prefer local when the user has unsaved
                // input that differs from server.
                if (
                  localValue !== undefined &&
                  localValue !== "" &&
                  localValue !== serverValue
                ) {
                  merged[id] = localValue;
                } else if (serverValue !== undefined) {
                  merged[id] = serverValue;
                }
              }
            }
            return merged;
          });
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
      setSaving(null);
    },
    [eventSlug, selectedSlot],
  );

  const scheduleSave = useCallback(
    (roomId: number) => {
      if (saveTimers.current[roomId]) {
        clearTimeout(saveTimers.current[roomId]);
      }
      setPending((prev) => ({ ...prev, [roomId]: true }));
      saveTimers.current[roomId] = setTimeout(() => {
        delete saveTimers.current[roomId];
        saveCount(roomId);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [saveCount],
  );

  const adjustCount = useCallback(
    (roomId: number, delta: number) => {
      setCounts((prev) => {
        const current = parseInt(prev[roomId] ?? "0", 10) || 0;
        const next = Math.max(0, current + delta);
        return { ...prev, [roomId]: String(next) };
      });
      scheduleSave(roomId);
    },
    [scheduleSave],
  );

  // Flush pending timers when the slot changes or component unmounts.
  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      for (const id of Object.keys(timers)) {
        clearTimeout(timers[Number(id)]);
        delete timers[Number(id)];
      }
    };
  }, [selectedSlot]);

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
              No sessions are scheduled for this event yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      {rooms.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No rooms active for this time slot.
        </p>
      ) : (
        <div className="space-y-2">
          {[...rooms]
            .sort((a, b) => {
              // Sort by the integer that follows "Theatre" / "Theater" in
              // the room name (e.g. "Back to the Future - Theatre 3" → 3).
              // Both spellings appear in the data; match either.
              // Rooms without a theatre number fall to the end, sorted by name.
              const re = /theat(?:re|er)\s+(\d+)/i;
              const aNum = a.room.name.match(re)?.[1];
              const bNum = b.room.name.match(re)?.[1];
              if (aNum !== undefined && bNum !== undefined) {
                return parseInt(aNum, 10) - parseInt(bNum, 10);
              }
              if (aNum !== undefined) return -1;
              if (bNum !== undefined) return 1;
              return a.room.name.localeCompare(b.room.name);
            })
            .map((entry) => {
            const { room, is_simulcast, attendance } = entry;
            const inputValue = counts[room.id] ?? "";

            return (
              <Card key={room.id} className="gap-0 py-0">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{room.name}</p>
                        {is_simulcast && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 shrink-0"
                          >
                            simulcast
                          </Badge>
                        )}
                      </div>
                      {attendance && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Last: {attendance.counted_by_name} at{" "}
                          {new Date(attendance.counted_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: event.timezone,
                            }
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        disabled={
                          (parseInt(inputValue || "0", 10) || 0) === 0
                        }
                        onClick={() => adjustCount(room.id, -1)}
                        aria-label={`Decrease count for ${room.name}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={inputValue}
                          onChange={(e) => {
                            setCounts((prev) => ({
                              ...prev,
                              [room.id]: e.target.value,
                            }));
                            scheduleSave(room.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (saveTimers.current[room.id]) {
                                clearTimeout(saveTimers.current[room.id]);
                                delete saveTimers.current[room.id];
                              }
                              saveCount(room.id);
                            }
                          }}
                          placeholder="0"
                          className="h-10 w-16 text-center text-lg font-bold tabular-nums"
                        />
                        {(saving === room.id || pending[room.id]) && (
                          <Loader2 className="absolute -right-1 -top-1 h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10"
                        onClick={() => adjustCount(room.id, 1)}
                        aria-label={`Increase count for ${room.name}`}
                      >
                        <Plus className="h-4 w-4" />
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
      {summary && summary.total_rooms > 0 && (
        <div className="sticky bottom-4 flex items-center justify-end rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-sm font-bold tabular-nums">
            {summary.total_attendance} total
          </div>
        </div>
      )}
    </div>
  );
}
