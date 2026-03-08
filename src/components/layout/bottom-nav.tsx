"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEvent } from "@/providers/event-provider";
import { useMembership } from "@/providers/membership-provider";
import {
  Calendar,
  Users,
  Building2,
  BarChart3,
  Info,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Relative paths within the event — resolved via eventPath() at render time */
const baseNavItems = [
  { path: "/schedule", label: "Schedule", icon: Calendar },
  { path: "/speakers", label: "Speakers", icon: Users },
  { path: "/sponsors", label: "Sponsors", icon: Building2 },
  { path: "/polls", label: "Polls", icon: BarChart3 },
  { path: "/more", label: "About", icon: Info },
];

const scannerItem = { path: "/leads/scan", label: "Scanner", icon: ScanLine };

export function BottomNav() {
  const pathname = usePathname();
  const { eventPath, hasFeature } = useEvent();
  const { isSponsor } = useMembership();

  // Filter base nav items by feature flags
  const filteredNavItems = baseNavItems.filter((item) => {
    if (item.path === "/polls") return hasFeature("polls");
    return true;
  });

  // Sponsors get the Scanner tab instead of Polls
  let navItems = filteredNavItems;
  if (isSponsor) {
    const withoutPolls = filteredNavItems.filter((item) => item.path !== "/polls");
    const moreItem = withoutPolls[withoutPolls.length - 1]; // "More" is always last
    navItems = [...withoutPolls.slice(0, -1), scannerItem, moreItem];
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        {navItems.map((item) => {
          const href = eventPath(item.path);
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
                item === scannerItem
                  ? "text-green-500"
                  : isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
