"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">
                      Registered Users
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Bookmark className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {stats.uniqueBookmarkers}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Building Schedules
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">
                      {stats.sponsorAccounts}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sponsor Reps
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <ScanLine className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalLeads}</p>
                    <p className="text-xs text-muted-foreground">
                      Badge Scans
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top sessions by bookmarks */}
          {stats.topSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Most Bookmarked Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.topSessions.map((session, i) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 text-sm font-bold text-muted-foreground w-5 text-right">
                          {i + 1}
                        </span>
                        <p className="truncate text-sm">{session.title}</p>
                      </div>
                      <span className="shrink-0 ml-2 text-sm font-medium">
                        {session.count}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Quick links to admin tools */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {adminTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{tool.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tool.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
