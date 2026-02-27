"use client";

import { useAuth } from "@/providers/auth-provider";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import Link from "next/link";
import { HeaderLogo } from "./header-logo";

const PAGE_TITLES: Record<string, string> = {
  "/schedule": "SCHEDULE",
  "/speakers": "SPEAKERS",
  "/sponsors": "SPONSORS",
  "/polls": "POLLS",
  "/movie-vote": "MOVIE VOTE",
  "/emergency": "EMERGENCY",
  "/venue-map": "VENUE MAP",
  "/more": "MORE",
  "/profile": "PROFILE",
  "/leads": "LEADS",
};

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();

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
    </header>
  );
}
