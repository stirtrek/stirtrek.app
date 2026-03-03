"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Map,
  MessageCircle,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";

export default function MorePage() {
  const { user } = useAuth();
  const { event, eventPath, eventId, hasFeature } = useEvent();
  const [isSponsor, setIsSponsor] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (!user || !eventId) return;
    supabase
      .from("event_memberships")
      .select("is_sponsor")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setIsSponsor(data.is_sponsor);
      });
  }, [user, eventId, supabase]);

  const moreItems = [
    hasFeature("announcements") && {
      href: eventPath("/announcements"),
      title: "Announcements",
      description: `Messages from the ${event.name} team`,
      icon: Megaphone,
    },
    // TODO: re-enable when venue map is ready
    // hasFeature("venue_map") && {
    //   href: eventPath("/venue-map"),
    //   title: "Venue Map",
    //   description: "Find your way around the venue",
    //   icon: Map,
    // },
hasFeature("emergency_reporting") && {
      href: eventPath("/emergency"),
      title: "Feedback & Concerns",
      description: "Let the staff know there's a problem",
      icon: MessageCircle,
    },
  ].filter(Boolean) as { href: string; title: string; description: string; icon: typeof Map }[];

  return (
    <div className="flex flex-col gap-4">
      {moreItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        );
      })}

      {isSponsor && hasFeature("polls") && (
        <Link href={eventPath("/polls")}>
          <Card className="transition-colors hover:bg-accent">
            <CardHeader className="flex flex-row items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Polls</CardTitle>
                <CardDescription>Vote in active polls</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      )}
    </div>
  );
}
