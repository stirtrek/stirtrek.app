"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { useEvent } from "./event-provider";
import { useSimulation, useSimulationFetch } from "./simulation-provider";
import { toast } from "sonner";

interface BookmarkContextValue {
  bookmarkedIds: Set<string>;
  isBookmarked: (sessionId: string) => boolean;
  toggleBookmark: (sessionId: string) => Promise<void>;
  loading: boolean;
}

const BookmarkContext = createContext<BookmarkContextValue>({
  bookmarkedIds: new Set(),
  isBookmarked: () => false,
  toggleBookmark: async () => {},
  loading: true,
});

export function BookmarkProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { eventId, eventSlug } = useEvent();
  const { isSimulating } = useSimulation();
  const simulationFetch = useSimulationFetch();
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setBookmarkedIds(new Set());
      setLoading(false);
      return;
    }

    async function fetchBookmarks() {
      try {
        if (isSimulating) {
          // During simulation, fetch via API (bypasses RLS)
          const res = await simulationFetch(`/${eventSlug}/api/bookmarks`);
          if (res.ok) {
            const json = await res.json();
            setBookmarkedIds(new Set(json.session_ids ?? []));
          }
        } else {
          const { data, error } = await supabase
            .from("personal_schedule")
            .select("session_id")
            .eq("user_id", user!.id)
            .eq("event_id", eventId);

          if (error) {
            console.error("Failed to load bookmarks:", error.message);
            toast.error("Could not load your saved schedule");
          } else if (data) {
            setBookmarkedIds(new Set(data.map((d: { session_id: string }) => d.session_id)));
          }
        }
      } catch (err) {
        console.error("Bookmark fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchBookmarks();
  }, [user, authLoading, supabase, eventId, eventSlug, isSimulating, simulationFetch]);

  const isBookmarked = useCallback(
    (sessionId: string) => bookmarkedIds.has(sessionId),
    [bookmarkedIds],
  );

  // Prevent rapid double-taps from firing concurrent requests for the same session
  const inflight = useRef(new Set<string>());

  const toggleBookmark = useCallback(
    async (sessionId: string) => {
      if (!user) return;
      if (isSimulating) {
        toast.error("Cannot toggle bookmarks during simulation");
        return;
      }
      if (inflight.current.has(sessionId)) return;
      inflight.current.add(sessionId);

      let wasBookmarked = false;
      setBookmarkedIds((prev) => {
        wasBookmarked = prev.has(sessionId);
        const next = new Set(prev);
        if (wasBookmarked) {
          next.delete(sessionId);
        } else {
          next.add(sessionId);
        }
        return next;
      });

      try {
        if (wasBookmarked) {
          const { error } = await supabase
            .from("personal_schedule")
            .delete()
            .eq("user_id", user.id)
            .eq("session_id", sessionId)
            .eq("event_id", eventId);

          if (error) {
            setBookmarkedIds((prev) => new Set(prev).add(sessionId));
            toast.error("Failed to remove bookmark");
          }
        } else {
          const { error } = await supabase
            .from("personal_schedule")
            .upsert(
              { user_id: user.id, session_id: sessionId, event_id: eventId },
              { onConflict: "user_id,session_id" },
            );

          if (error) {
            setBookmarkedIds((prev) => {
              const next = new Set(prev);
              next.delete(sessionId);
              return next;
            });
            toast.error("Failed to save bookmark");
          }
        }
      } finally {
        inflight.current.delete(sessionId);
      }
    },
    [user, supabase, eventId, isSimulating],
  );

  return (
    <BookmarkContext.Provider
      value={{ bookmarkedIds, isBookmarked, toggleBookmark, loading }}
    >
      {children}
    </BookmarkContext.Provider>
  );
}

export function useBookmarks() {
  return useContext(BookmarkContext);
}
