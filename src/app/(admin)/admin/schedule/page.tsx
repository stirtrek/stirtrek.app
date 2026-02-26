"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import type { SessionizeSyncLog } from "@/lib/types";

export default function AdminSchedulePage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SessionizeSyncLog[]>([]);
  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sessionize_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (data) setSyncLogs(data);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/sessionize/sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(
          `Synced ${data.sessions} sessions, ${data.speakers} speakers, ${data.rooms} rooms, ${data.categories} categories`
        );
      }
    } catch {
      setSyncResult("Network error during sync");
    } finally {
      setSyncing(false);
      fetchLogs();
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule Sync</h1>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Now
            </>
          )}
        </Button>
      </div>

      {syncResult && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{syncResult}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No syncs yet. Click &quot;Sync Now&quot; to pull data from
              Sessionize.
            </p>
          ) : (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="mt-0.5">{statusIcon(log.status)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.status === "completed"
                            ? "default"
                            : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {log.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>
                    {log.status === "completed" && (
                      <p className="text-xs text-muted-foreground">
                        {log.sessions_synced} sessions, {log.speakers_synced}{" "}
                        speakers, {log.rooms_synced} rooms
                      </p>
                    )}
                    {log.error_message && (
                      <p className="text-xs text-destructive">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
