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
import { toast } from "sonner";

const CACHE_KEY = "stirtrek:bookmarks";

function readCache(userId: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.userId !== userId) return null;
    return new Set<string>(parsed.ids);
  } catch {
    return null;
  }
}

function writeCache(userId: string, ids: Set<string>) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ userId, ids: [...ids] }),
    );
  } catch {
    // Storage full or unavailable — ignore
  }
}

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
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const didHydrate = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setBookmarkedIds(new Set());
      setLoading(false);
      return;
    }

    // Hydrate from localStorage cache immediately
    if (!didHydrate.current) {
      const cached = readCache(user.id);
      if (cached) {
        setBookmarkedIds(cached);
        setLoading(false);
      }
      didHydrate.current = true;
    }

    // Refresh from Supabase in the background
    async function fetchBookmarks() {
      const { data } = await supabase
        .from("personal_schedule")
        .select("session_id")
        .eq("user_id", user!.id);

      if (data) {
        const fresh = new Set(data.map((d) => d.session_id));
        setBookmarkedIds(fresh);
        writeCache(user!.id, fresh);
      }
      setLoading(false);
    }

    fetchBookmarks();
  }, [user, authLoading, supabase]);

  const isBookmarked = useCallback(
    (sessionId: string) => bookmarkedIds.has(sessionId),
    [bookmarkedIds],
  );

  const toggleBookmark = useCallback(
    async (sessionId: string) => {
      if (!user) return;

      // Read the current state via the updater to avoid stale closures
      let wasBookmarked = false;
      setBookmarkedIds((prev) => {
        wasBookmarked = prev.has(sessionId);
        const next = new Set(prev);
        if (wasBookmarked) {
          next.delete(sessionId);
        } else {
          next.add(sessionId);
        }
        writeCache(user.id, next);
        return next;
      });

      // Persist to Supabase
      if (wasBookmarked) {
        const { error } = await supabase
          .from("personal_schedule")
          .delete()
          .eq("user_id", user.id)
          .eq("session_id", sessionId);

        if (error) {
          // Roll back
          setBookmarkedIds((prev) => {
            const next = new Set(prev).add(sessionId);
            writeCache(user.id, next);
            return next;
          });
          toast.error("Failed to remove bookmark");
        }
      } else {
        const { error } = await supabase
          .from("personal_schedule")
          .upsert(
            { user_id: user.id, session_id: sessionId },
            { onConflict: "user_id,session_id" },
          );

        if (error) {
          // Roll back
          setBookmarkedIds((prev) => {
            const next = new Set(prev);
            next.delete(sessionId);
            writeCache(user.id, next);
            return next;
          });
          toast.error("Failed to save bookmark");
        }
      }
    },
    [user, supabase],
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
