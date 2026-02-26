import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Film,
  Map,
  AlertTriangle,
  CalendarCheck,
} from "lucide-react";

export const metadata = {
  title: "More",
};

const moreItems = [
  {
    href: "/my-schedule",
    title: "My Schedule",
    description: "View your bookmarked sessions",
    icon: CalendarCheck,
  },
  {
    href: "/movie-vote",
    title: "Movie Vote",
    description: "Vote for the movie you want to watch",
    icon: Film,
  },
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
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">More</h1>
      <div className="space-y-3">
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
      </div>
    </div>
  );
}
