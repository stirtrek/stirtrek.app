export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  Calendar,
  Clock,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Building2,
  Film,
  Map,
  Users,
  LayoutDashboard,
} from "lucide-react";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/schedule", label: "Schedule", icon: Calendar },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/polls", label: "Polls", icon: BarChart3 },
  { href: "/admin/emergency", label: "Emergency", icon: AlertTriangle },
  { href: "/admin/sponsors", label: "Sponsors", icon: Building2 },
  { href: "/admin/movies", label: "Movies", icon: Film },
  { href: "/admin/venue-map", label: "Venue Map", icon: Map },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/time-simulator", label: "Time Sim", icon: Clock },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r bg-muted/30 md:block">
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/admin" className="font-bold">
            Stir Trek Admin
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {adminNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t p-4">
          <Link
            href="/schedule"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to attendee app
          </Link>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex h-14 items-center border-b px-6">
          <h2 className="font-semibold">Admin Panel</h2>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
