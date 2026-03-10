"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { useEvent } from "./event-provider";
import type { UserRole } from "@/lib/types";

interface MembershipContextValue {
  role: UserRole;
  isAdmin: boolean;
  isSponsor: boolean;
  sponsorId: string | null;
  loading: boolean;
  refreshMembership: () => Promise<void>;
}

const MembershipContext = createContext<MembershipContextValue>({
  role: "attendee",
  isAdmin: false,
  isSponsor: false,
  sponsorId: null,
  loading: true,
  refreshMembership: async () => {},
});

export function MembershipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const { eventId } = useEvent();
  const [role, setRole] = useState<UserRole>("attendee");
  const [isSponsor, setIsSponsor] = useState(false);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  const refreshMembership = useCallback(async () => {
    if (!user || !eventId) {
      setRole("attendee");
      setIsSponsor(false);
      setSponsorId(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("event_memberships")
      .select("role, is_sponsor, sponsor_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setRole(data.role);
      setIsSponsor(data.is_sponsor);
      setSponsorId(data.sponsor_id ?? null);
    } else {
      // Token may be mid-refresh (lock contention) — retry after a short delay
      setTimeout(async () => {
        const { data: retry } = await supabase
          .from("event_memberships")
          .select("role, is_sponsor, sponsor_id")
          .eq("event_id", eventId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (retry) {
          setRole(retry.role);
          setIsSponsor(retry.is_sponsor);
          setSponsorId(retry.sponsor_id ?? null);
        }
      }, 1500);
    }
    setLoading(false);
  }, [user, eventId, supabase]);

  // Fetch on mount and whenever user/profile changes
  // (profile is included so refreshProfile() after sponsor activate/deactivate
  // triggers a re-fetch of membership status)
  useEffect(() => {
    refreshMembership();
  }, [refreshMembership, profile]);

  const isAdmin = profile?.is_super_admin || ["admin", "staff"].includes(role);

  return (
    <MembershipContext.Provider
      value={{
        role,
        isAdmin,
        isSponsor,
        sponsorId,
        loading,
        refreshMembership,
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

export function useMembership() {
  return useContext(MembershipContext);
}
