"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";

/**
 * Invisible component that tracks user presence via Supabase Realtime.
 * Drop into any layout where authenticated users should be counted as "active."
 */
export function PresenceTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const supabase = createClient();
    const channel = supabase.channel("app:presence", {
      config: { presence: { key: user.id } },
    });

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
