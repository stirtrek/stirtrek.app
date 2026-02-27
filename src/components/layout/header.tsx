"use client";

import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Shield, User, Calendar } from "lucide-react";
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
};

export function Header() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = profile?.role === "admin" || profile?.role === "staff";

  // Find page title by matching pathname prefix
  const pageTitle = Object.entries(PAGE_TITLES).find(
    ([path]) => pathname === path || pathname.startsWith(path + "/")
  )?.[1];

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="p-2">
                <p className="text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/schedule?tab=my-schedule">
                  <Calendar className="mr-2 h-4 w-4" />
                  My Schedule
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-8 w-8" />
        )}
      </div>
    </header>
  );
}
