"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Bell } from "lucide-react";
import Link from "next/link";
import { HeaderLogo } from "./header-logo";
import type { UserRole } from "@/lib/types";

/** Relative paths within the event — resolved via eventPath() at render time */
const PAGE_TITLE_MAP: Record<string, string> = {
  "/schedule": "SCHEDULE",
  "/speakers": "SPEAKERS",
  "/sponsors": "SPONSORS",
  "/polls": "POLLS",
  "/movie-vote": "MOVIE VOTE",
  "/announcements": "ANNOUNCEMENTS",
  "/emergency": "FEEDBACK",
  "/venue-map": "VENUE MAP",
  "/more": "MORE",
  "/profile": "PROFILE",
  "/leads": "LEADS",
};

export function Header() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const { event, eventPath, eventId, hasFeature } = useEvent();
  const pathname = usePathname();
  const [memberRole, setMemberRole] = useState<UserRole>("attendee");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (!user || !eventId) return;
    supabase
      .from("event_memberships")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setMemberRole(data.role);
      });
  }, [user, eventId, supabase]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.is_super_admin) setIsSuperAdmin(true);
      });
  }, [user, supabase]);

  const isAdmin = isSuperAdmin || ["admin", "staff"].includes(memberRole);
  const emergencyHref = isAdmin
    ? eventPath("/admin/emergency")
    : eventPath("/emergency");

  // Build page-title lookup using fully-qualified event paths
  const pageTitle = Object.entries(PAGE_TITLE_MAP).find(([rel]) => {
    const full = eventPath(rel);
    return pathname === full || pathname.startsWith(full + "/");
  })?.[1];

  const showEmergencyLink =
    user && hasFeature("emergency_reporting");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href={eventPath("/schedule")} aria-label={event.name}>
          {event.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.logo_url}
              alt={event.name}
              className="h-10 w-auto object-contain"
            />
          ) : (
            <HeaderLogo className="h-10" />
          )}
        </Link>

        {pageTitle && (
          <span className="text-base font-bold tracking-wide text-foreground">
            {pageTitle}
          </span>
        )}

        <div className="flex items-center gap-0.5">
          {showEmergencyLink && (
            <Link href={emergencyHref}>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
          )}
          {user ? (
            <Link href={eventPath("/profile")}>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>
      </div>
    </header>
  );
}
