"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Calendar, Globe, Settings, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Event } from "@/lib/types";

export default function SuperAdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const res = await fetch("/api/super-admin/events");
    if (res.ok) {
      setEvents(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link href="/super-admin/events/new">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Event
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-muted-foreground py-12 text-center">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">
          No events yet. Create your first event to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/super-admin/events/${event.id}`}
              className="block"
            >
              <Card className="transition-colors hover:border-white/20">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    <Badge variant={event.is_active ? "default" : "secondary"}>
                      {event.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1">
                      <Settings className="h-3.5 w-3.5" />
                      /{event.slug}
                    </span>
                    {event.event_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(event.event_date + "T00:00:00").toLocaleDateString()}
                      </span>
                    )}
                    {event.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {event.domain}
                      </span>
                    )}
                    {event.venue_name && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {event.venue_name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
