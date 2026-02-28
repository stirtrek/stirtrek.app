"use client";

import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/providers/notification-provider";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Bell } from "lucide-react";
import Link from "next/link";
import { HeaderLogo } from "./header-logo";

const PAGE_TITLES: Record<string, string> = {
  "/schedule": "SCHEDULE",
  "/speakers": "SPEAKERS",
  "/sponsors": "SPONSORS",
  "/polls": "POLLS",
  "/movie-vote": "MOVIE VOTE",
  "/emergency": "FEEDBACK",
  "/venue-map": "VENUE MAP",
  "/more": "MORE",
  "/profile": "PROFILE",
  "/leads": "LEADS",
};

export function Header() {
  const { user, profile } = useAuth();
  const { unreadCount } = useNotifications();
  const pathname = usePathname();

  const isAdmin =
    profile && ["admin", "staff"].includes(profile.role);
  const emergencyHref = isAdmin ? "/admin/emergency" : "/emergency";

  // Find page title by matching pathname prefix
  const pageTitle = Object.entries(PAGE_TITLES).find(
    ([path]) => pathname === path || pathname.startsWith(path + "/")
  )?.[1];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <Link href="/schedule">
          <HeaderLogo className="h-10" />
        </Link>

        {pageTitle && (
          <span className="text-base font-bold tracking-wide text-foreground">
            {pageTitle}
          </span>
        )}

        <div className="flex items-center gap-0.5">
          {user && (
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
            <Link href="/profile">
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
