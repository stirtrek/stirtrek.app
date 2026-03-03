"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { SponsorActivation } from "@/components/profile/sponsor-activation";
import { SponsorCompanySelector } from "@/components/profile/sponsor-company-selector";
import type { UserRole } from "@/lib/types";

export default function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { eventPath, eventId } = useEvent();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [memberRole, setMemberRole] = useState<UserRole>("attendee");
  const [memberIsSponsor, setMemberIsSponsor] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
    }
  }, [profile]);

  // Fetch event membership for role / is_sponsor
  // profile is included so refreshProfile() (called after sponsor
  // activate/deactivate) triggers a re-fetch of membership status.
  useEffect(() => {
    if (!user || !eventId) return;
    async function fetchMembership() {
      const { data, error } = await supabase
        .from("event_memberships")
        .select("role, is_sponsor")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .single();
      if (error) {
        console.error("Membership fetch error:", error);
        return;
      }
      if (data) {
        setMemberRole(data.role);
        setMemberIsSponsor(data.is_sponsor);
      }
    }
    fetchMembership();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, eventId, supabase, profile]);

  // Check super admin status
  useEffect(() => {
    if (!user) return;
    async function checkSuperAdmin() {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", user!.id)
        .single();
      if (error) {
        console.error("Super admin check error:", error);
        return;
      }
      if (data?.is_super_admin) setIsSuperAdmin(true);
    }
    checkSuperAdmin();
  }, [user, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !profile) {
    router.push(eventPath("/login"));
    return null;
  }

  const isAdmin = isSuperAdmin || memberRole === "admin" || memberRole === "staff";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to save profile");
      setSaving(false);
      return;
    }

    await refreshProfile();
    toast.success("Profile updated");
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    // Hard navigation to fully clear cookies and server-side session
    window.location.href = eventPath("/login");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        {isAdmin && (
          <Link
            href={eventPath("/admin")}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {memberIsSponsor && (
        <SponsorCompanySelector />
      )}

      {!memberIsSponsor && <SponsorActivation />}

      <Button
        variant="outline"
        className="w-full"
        onClick={handleSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
