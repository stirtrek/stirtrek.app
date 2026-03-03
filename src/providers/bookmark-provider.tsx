"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";
import { useEvent } from "./event-provider";
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
  const { eventId } = useEvent();
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
      const { data, error } = await supabase
        .from("personal_schedule")
        .select("session_id")
        .eq("user_id", user!.id)
        .eq("event_id", eventId);

      if (error) {
        console.error("Failed to load bookmarks:", error.message);
        toast.error("Could not load your saved schedule");
      } else if (data) {
        setBookmarkedIds(new Set(data.map((d) => d.session_id)));
      }
      setLoading(false);
    }

    fetchBookmarks();
  }, [user, authLoading, supabase, eventId]);

  const isBookmarked = useCallback(
    (sessionId: string) => bookmarkedIds.has(sessionId),
    [bookmarkedIds],
  );

  const toggleBookmark = useCallback(
    async (sessionId: string) => {
      if (!user) return;

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

      if (wasBookmarked) {
        const { error } = await supabase
          .from("personal_schedule")
          .delete()
          .eq("user_id", user.id)
          .eq("session_id", sessionId);

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
    },
    [user, supabase, eventId],
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
