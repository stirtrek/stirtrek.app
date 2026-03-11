"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import { useSimulation } from "@/providers/simulation-provider";
import type { SimulatedUser } from "@/providers/simulation-provider";
import type { UserRole } from "@/lib/types";

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_super_admin: boolean;
  role: UserRole;
  is_sponsor: boolean;
  sponsor_id: string | null;
  is_speaker: boolean;
  created_at: string;
}

export default function SimulateUserPage() {
  const { eventSlug, eventPath } = useEvent();
  const { startSimulation, isSimulating } = useSimulation();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(
    async (q: string) => {
      try {
        const params = q ? `?q=${encodeURIComponent(q)}` : "";
        const res = await fetch(`/${eventSlug}/api/admin/users${params}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [eventSlug]
  );

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleSelect = (user: UserRow) => {
    const simUser: SimulatedUser = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_sponsor: user.is_sponsor,
      sponsor_id: user.sponsor_id,
    };
    startSimulation(simUser);
    toast.success(`Simulating ${displayName(user) || user.email}`);
    router.push(eventPath("/schedule"));
  };

  const displayName = (u: UserRow) => {
    if (u.first_name || u.last_name) {
      return `${u.first_name || ""} ${u.last_name || ""}`.trim();
    }
    if (u.display_name) return u.display_name;
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Simulate User</h1>
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {users.length} result{users.length !== 1 && "s"}
          </span>
        )}
      </div>

      {isSimulating && (
        <div className="rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm text-purple-300">
          Simulation is already active. Selecting a new user will replace the
          current simulation.
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Select a user to see the app from their perspective. Your admin session
        remains active.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No users found.
        </p>
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <div className="divide-y">
              {users.map((user) => {
                const name = displayName(user);
                return (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {name && (
                          <p className="truncate text-sm font-medium">
                            {name}
                          </p>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(user.is_super_admin || ["admin", "staff"].includes(user.role)) && (
                        <Badge
                          variant="outline"
                          className="bg-red-500/10 text-red-400 border-red-500/20 px-1.5 py-0 text-[10px]"
                        >
                          Admin
                        </Badge>
                      )}
                      {user.is_speaker && (
                        <Badge
                          variant="outline"
                          className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-1.5 py-0 text-[10px]"
                        >
                          Speaker
                        </Badge>
                      )}
                      {user.role === "proctor" && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-1.5 py-0 text-[10px]"
                        >
                          Proctor
                        </Badge>
                      )}
                      {user.is_sponsor && (
                        <Badge
                          variant="outline"
                          className="bg-green-500/10 text-green-400 border-green-500/20 px-1.5 py-0 text-[10px]"
                        >
                          Sponsor
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
