"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ScanLine,
  Bookmark,
  Building2,
  Calendar,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Film,
  Map,
  Clock,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  completedProfiles: number;
  sponsorAccounts: number;
  totalLeads: number;
  totalBookmarks: number;
  uniqueBookmarkers: number;
  topSessions: { id: string; title: string; count: number }[];
}

const adminTools = [
  {
    href: "/admin/schedule",
    label: "Schedule",
    description: "Sync sessions from Sessionize",
    icon: Calendar,
  },
  {
    href: "/admin/sponsors",
    label: "Sponsors",
    description: "Manage sponsor accounts & leads",
    icon: Building2,
  },
  {
    href: "/admin/feedback",
    label: "Feedback",
    description: "View session feedback",
    icon: MessageSquare,
  },
  {
    href: "/admin/polls",
    label: "Polls",
    description: "Create and manage polls",
    icon: BarChart3,
  },
  {
    href: "/admin/emergency",
    label: "Emergency",
    description: "Monitor emergency reports",
    icon: AlertTriangle,
  },
  {
    href: "/admin/movies",
    label: "Movies",
    description: "Manage movie voting",
    icon: Film,
  },
  {
    href: "/admin/venue-map",
    label: "Venue Map",
    description: "Upload venue maps",
    icon: Map,
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Manage user accounts",
    icon: Users,
  },
  {
    href: "/admin/time-simulator",
    label: "Time Simulator",
    description: "Override event time for testing",
    icon: Clock,
  },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/dashboard");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  }, []);

  // Debounced re-fetch when realtime events arrive
  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchStats();
    }, 1000);
  }, [fetchStats]);

  useEffect(() => {
    fetchStats().finally(() => setLoading(false));

    const supabase = createClient();

    // --- Presence: active user count ---
    const presenceChannel = supabase.channel("app:presence");
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setActiveUsers(Object.keys(state).length);
      })
      .subscribe();

    // --- Realtime: table changes for live stats ---
    const changesChannel = supabase
      .channel("admin:dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        debouncedRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "personal_schedule" },
        debouncedRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        debouncedRefresh
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(changesChannel);
    };
  }, [fetchStats, debouncedRefresh]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Active users - hero stat */}
          <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {activeUsers}
              </span>
              <span className="text-sm text-muted-foreground">active now</span>
            </div>
          </div>

          {/* Compact stat rows */}
          {stats && (
            <div className="divide-y rounded-lg border">
              <StatRow
                icon={<Users className="h-4 w-4" />}
                label="Registered Users"
                value={stats.totalUsers}
              />
              <StatRow
                icon={<Bookmark className="h-4 w-4" />}
                label="Building Schedules"
                value={stats.uniqueBookmarkers}
              />
              <StatRow
                icon={<ScanLine className="h-4 w-4" />}
                label="Badge Scans"
                value={stats.totalLeads}
              />
              <StatRow
                icon={<Building2 className="h-4 w-4" />}
                label="Sponsor Reps"
                value={stats.sponsorAccounts}
              />
            </div>
          )}

          {/* Top sessions by bookmarks */}
          {stats && stats.topSessions.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="px-4 py-3">
                <Link href="/admin/bookmarks" className="flex items-center justify-between">
                  <CardTitle className="text-sm">Most Bookmarked Sessions</CardTitle>
                  <span className="text-xs text-muted-foreground">View all &rarr;</span>
                </Link>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="space-y-1.5">
                  {stats.topSessions.map((session, i) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-2 py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-xs font-bold text-muted-foreground w-4 text-right">
                          {i + 1}
                        </span>
                        <p className="truncate text-xs">{session.title}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {session.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Quick links to admin tools */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Admin Tools</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            {adminTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex flex-col items-center gap-1.5 rounded-md border p-3 text-center transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium leading-tight">
                    {tool.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}
