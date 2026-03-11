"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import type { UserRole } from "@/lib/types";

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_sponsor: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { eventSlug, eventPath } = useEvent();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async (q: string) => {
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
  }, []);

  // Debounced search
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchUsers]);

  const handleRoleChange = async (profileId: string, role: string) => {
    setUpdating(profileId);
    try {
      const res = await fetch(`/${eventSlug}/api/admin/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, role }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Update failed");
      }

      toast.success("Role updated");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === profileId ? { ...u, role: role as UserRole } : u
        )
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update role"
      );
    } finally {
      setUpdating(null);
    }
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
        <h1 className="text-xl font-bold">Users</h1>
        {!loading && (
          <span className="text-xs text-muted-foreground">
            {users.length} result{users.length !== 1 && "s"}
          </span>
        )}
      </div>

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
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {name && (
                          <p className="truncate text-sm font-medium">{name}</p>
                        )}
                        {user.is_sponsor && (
                          <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                            Sponsor
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Select
                        value={user.role}
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attendee">Attendee</SelectItem>
                          <SelectItem value="proctor">Proctor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
