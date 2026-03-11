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

interface TheaterEntry {
  theater: {
    id: string;
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
  total_theaters: number;
  mapped_theaters: number;
  counted_theaters: number;
  total_attendance: number;
}

export default function ProctorPage() {
  const { event, eventSlug } = useEvent();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [theaters, setTheaters] = useState<TheaterEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

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

  // Fetch theater data when slot changes
  const fetchTheaters = useCallback(async () => {
    if (!selectedSlot) return;
    const res = await fetch(
      `/${eventSlug}/api/proctor/attendance?time_slot=${encodeURIComponent(selectedSlot)}`
    );
    if (res.ok) {
      const d = await res.json();
      setTheaters(d.theaters);
      setSummary(d.summary);

      // Pre-populate existing counts
      const existingCounts: Record<string, string> = {};
      for (const entry of d.theaters) {
        if (entry.attendance) {
          existingCounts[entry.theater.id] = String(entry.attendance.count);
        }
      }
      setCounts(existingCounts);
    }
  }, [eventSlug, selectedSlot]);

  useEffect(() => {
    if (selectedSlot) {
      fetchTheaters();
    }
  }, [selectedSlot, fetchTheaters]);

  async function saveCount(theaterId: string, sessionId: string) {
    const countStr = counts[theaterId];
    if (countStr === undefined || countStr === "") return;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 0) {
      toast.error("Count must be a non-negative number");
      return;
    }

    setSaving(theaterId);
    const res = await fetch(`/${eventSlug}/api/proctor/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theater_id: theaterId, session_id: sessionId, count }),
    });

    if (res.ok) {
      toast.success("Count saved");
      // Refresh to get updated data
      await fetchTheaters();
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
              No sessions have been mapped to theaters yet. An admin needs to set up
              theater-session mappings first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter to only theaters that have a mapped session for this slot
  const mappedTheaters = theaters.filter((e) => e.session !== null);

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

      {/* Theater cards */}
      {mappedTheaters.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No theaters mapped for this time slot.
        </p>
      ) : (
        <div className="space-y-2">
          {mappedTheaters.map((entry) => {
            const { theater, session, attendance } = entry;
            const hasCount = attendance !== null;
            const inputValue = counts[theater.id] ?? "";

            return (
              <Card
                key={theater.id}
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
                        <p className="font-semibold text-sm">{theater.name}</p>
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
                            [theater.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && session) {
                            saveCount(theater.id, session.id);
                          }
                        }}
                        placeholder="0"
                        className="h-10 w-20 text-center text-lg font-bold tabular-nums"
                      />
                      <Button
                        size="sm"
                        className="h-10"
                        disabled={
                          saving === theater.id ||
                          !session ||
                          inputValue === "" ||
                          inputValue === String(attendance?.count)
                        }
                        onClick={() => {
                          if (session) saveCount(theater.id, session.id);
                        }}
                      >
                        {saving === theater.id ? (
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
      {summary && summary.mapped_theaters > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="text-sm">
            <span className="font-semibold tabular-nums">
              {summary.counted_theaters}
            </span>
            <span className="text-muted-foreground">
              {" "}
              of {summary.mapped_theaters} counted
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
