"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Map,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const moreItems = [
  {
    href: "/venue-map",
    title: "Venue Map",
    description: "Find your way around the venue",
    icon: Map,
  },
  {
    href: "/emergency",
    title: "Emergency Report",
    description: "Report an urgent issue to event staff",
    icon: AlertTriangle,
  },
];

export default function MorePage() {
  const { profile } = useAuth();

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

      {profile?.is_sponsor && (
        <Link href="/polls">
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
