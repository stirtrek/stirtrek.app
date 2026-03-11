"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { useMembership } from "@/providers/membership-provider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogOut, Shield, ClipboardCheck, MessageSquare, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { SponsorActivation } from "@/components/profile/sponsor-activation";
import { SponsorCompanySelector } from "@/components/profile/sponsor-company-selector";

export default function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const { eventPath, eventId, eventSlug } = useEvent();
  const { isAdmin, isProctor, isSponsor: memberIsSponsor, sponsorId: memberSponsorId } = useMembership();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
    }
  }, [profile]);

  // Fallback: if auth provider didn't load the profile, fetch it directly
  useEffect(() => {
    if (profile || loading || !user) return;
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single()
      .then(({ data }: { data: { first_name: string | null; last_name: string | null } | null }) => {
        if (data) {
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
        }
      });
  }, [profile, loading, user, supabase]);

  // Check if user is a linked speaker
  useEffect(() => {
    if (!user) return;
    fetch(`/${eventSlug}/api/speaker-feedback`)
      .then((res) => (res.ok ? res.json() : { is_speaker: false }))
      .then((data) => setIsSpeaker(data.is_speaker ?? false))
      .catch(() => {});
  }, [user, eventSlug]);

  // Redirect to login once auth has resolved (or timed out) with no user
  useEffect(() => {
    if (!loading && !user) {
      router.push(eventPath("/login"));
    }
  }, [loading, user, router, eventPath]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
    try {
      await signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
    // Full page navigation ensures middleware sees the cleared session
    window.location.href = eventPath("/login");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        <div className="flex items-center gap-3">
          {isProctor && (
            <Link
              href={eventPath("/proctor")}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ClipboardCheck className="h-4 w-4" />
              Proctor
            </Link>
          )}
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

      {isSpeaker && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Session Feedback</p>
                <p className="text-xs text-muted-foreground">
                  View feedback for your sessions
                </p>
              </div>
            </div>
            <Link href={eventPath("/my-feedback")}>
              <Button variant="outline" size="sm">
                View
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {memberIsSponsor && (
        <SponsorCompanySelector initialSponsorId={memberSponsorId} />
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
