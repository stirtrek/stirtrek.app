"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Trash2 } from "lucide-react";
import { formatTime, parseSessionizeTime } from "@/lib/utils";

export default function TimeSimulatorPage() {
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [sessionTimes, setSessionTimes] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState("2026-05-01");
  const [customTime, setCustomTime] = useState("10:00");
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/admin/simulated-time");
    if (res.ok) {
      const data = await res.json();
      setSimulatedTime(data.simulatedTime ?? null);
    }
  }, []);

  const fetchSessionTimes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("sessions")
      .select("starts_at, is_service_session")
      .eq("is_service_session", false)
      .not("starts_at", "is", null)
      .order("starts_at", { ascending: true });

    if (data) {
      const unique = [...new Set(data.map((s) => s.starts_at as string))];
      setSessionTimes(unique);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSessionTimes();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSessionTimes]);

  async function setTime(time: string | null) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/simulated-time", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulatedTime(data.simulatedTime);
      }
    } finally {
      setLoading(false);
    }
  }

  function offsetTime(baseIso: string, minutesDelta: number): string {
    const d = parseSessionizeTime(baseIso);
    d.setUTCMinutes(d.getUTCMinutes() + minutesDelta);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }

  const firstSession = sessionTimes[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Time Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Override the current time for testing the schedule auto-select and
          time-dependent features.
        </p>
      </div>

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {simulatedTime ? (
            <div className="space-y-2">
              <p className="text-sm">
                Simulated time:{" "}
                <span className="font-semibold text-amber-600">
                  {parseSessionizeTime(simulatedTime).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                </span>
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setTime(null)}
                disabled={loading}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                Clear Simulation
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Using real time (no simulation active)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick-Set Buttons */}
      {sessionTimes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Set</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {firstSession && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Relative to first session
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTime(offsetTime(firstSession, -60))}
                    disabled={loading}
                  >
                    1 hr before
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTime(offsetTime(firstSession, -5))}
                    disabled={loading}
                  >
                    5 min before
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTime(offsetTime(firstSession, 5))}
                    disabled={loading}
                  >
                    5 min after
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">
                Jump to time slot
              </p>
              <div className="flex flex-wrap gap-2">
                {sessionTimes.map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    onClick={() => setTime(t)}
                    disabled={loading}
                  >
                    {formatTime(t)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-auto"
            />
            <Input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              className="w-auto"
            />
          </div>
          <Button
            onClick={() => setTime(`${customDate}T${customTime}:00`)}
            disabled={loading}
            size="sm"
          >
            Set Custom Time
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
