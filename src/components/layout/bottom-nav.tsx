"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  Calendar,
  Users,
  Building2,
  BarChart3,
  Menu,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/speakers", label: "Speakers", icon: Users },
  { href: "/sponsors", label: "Sponsors", icon: Building2 },
  { href: "/polls", label: "Polls", icon: BarChart3 },
  { href: "/more", label: "More", icon: Menu },
];

const scannerItem = { href: "/leads/scan", label: "Scanner", icon: ScanLine };

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const navItems = profile?.is_sponsor
    ? [...baseNavItems.slice(0, 3), scannerItem, baseNavItems[4]]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
                item === scannerItem
                  ? "text-white"
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
