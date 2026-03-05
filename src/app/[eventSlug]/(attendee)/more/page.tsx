"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Map,
  MessageCircle,
  BarChart3,
  Megaphone,
  Globe,
  Twitter,
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

      {/* About the app */}
      <Card className="mt-4 border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://jeffblankenburg.info/img/headshot.png"
            alt="Jeff Blankenburg"
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
          <div>
          <p className="text-sm text-muted-foreground">
            Hi, I&apos;m Jeff Blankenburg. I built this app because I think
            every event deserves a great experience. If it made your day even a
            little better, drop me a line &mdash; it means more than you know.
          </p>
          <div className="flex gap-3 pt-2">
            <a
              href="https://jeffblankenburg.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="Website"
            >
              <Globe className="h-4 w-4" />
            </a>
            <a
              href="https://x.com/jeffblankenburg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="X (Twitter)"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="https://bsky.app/profile/jeffblankenburg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="Bluesky"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.643 3.593 3.519 6.173 3.175-.39.06-3.85.67-3.85 3.322 0 4.456 6.293 4.783 8.163 1.543a5.5 5.5 0 0 0 .89-2.32 5.5 5.5 0 0 0 .89 2.32c1.87 3.24 8.163 2.913 8.163-1.543 0-2.652-3.46-3.261-3.85-3.322 2.58.344 5.388-.532 6.173-3.175C23.622 9.418 24 4.458 24 3.768c0-.69-.139-1.861-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/in/jeffblankenburg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground transition-colors hover:text-primary"
              aria-label="LinkedIn"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
