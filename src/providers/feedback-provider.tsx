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
import { toast } from "sonner";
import type { FeedbackRating } from "@/lib/types";

interface FeedbackEntry {
  rating: FeedbackRating;
  comment: string | null;
}

interface FeedbackContextValue {
  getFeedback: (sessionId: string) => FeedbackEntry | null;
  submitFeedback: (
    sessionId: string,
    rating: FeedbackRating,
    comment: string | null
  ) => Promise<void>;
  loading: boolean;
}

const FeedbackContext = createContext<FeedbackContextValue>({
  getFeedback: () => null,
  submitFeedback: async () => {},
  loading: true,
});

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { eventId } = useEvent();
  const [feedbackMap, setFeedbackMap] = useState<Map<string, FeedbackEntry>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  useEffect(() => {
    if (!user) {
      setFeedbackMap(new Map());
      setLoading(false);
      return;
    }

    async function fetchFeedback() {
      const { data } = await supabase
        .from("session_feedback")
        .select("session_id, rating, comment")
        .eq("user_id", user!.id)
        .eq("event_id", eventId);

      if (data) {
        const map = new Map<string, FeedbackEntry>();
        for (const row of data) {
          map.set(row.session_id, {
            rating: row.rating as FeedbackRating,
            comment: row.comment,
          });
        }
        setFeedbackMap(map);
      }
      setLoading(false);
    }

    fetchFeedback();
  }, [user, supabase, eventId]);

  const getFeedback = useCallback(
    (sessionId: string) => feedbackMap.get(sessionId) ?? null,
    [feedbackMap]
  );

  // Prevent rapid double-submissions for the same session
  const inflight = useRef(new Set<string>());

  const submitFeedback = useCallback(
    async (
      sessionId: string,
      rating: FeedbackRating,
      comment: string | null
    ) => {
      if (!user) return;
      if (inflight.current.has(sessionId)) return;
      inflight.current.add(sessionId);

      // Optimistic update
      const previous = feedbackMap.get(sessionId) ?? null;
      setFeedbackMap((prev) => {
        const next = new Map(prev);
        next.set(sessionId, { rating, comment });
        return next;
      });

      try {
        const { error } = await supabase.from("session_feedback").upsert(
          {
            user_id: user.id,
            session_id: sessionId,
            event_id: eventId,
            rating,
            comment: comment?.trim() || null,
          },
          { onConflict: "user_id,session_id" }
        );

        if (error) {
          // Roll back to previous value
          setFeedbackMap((prev) => {
            const next = new Map(prev);
            if (previous) {
              next.set(sessionId, previous);
            } else {
              next.delete(sessionId);
            }
            return next;
          });
          toast.error("Failed to save feedback");
        }
      } finally {
        inflight.current.delete(sessionId);
      }
    },
    [user, supabase, eventId, feedbackMap]
  );

  return (
    <FeedbackContext.Provider value={{ getFeedback, submitFeedback, loading }}>
      {children}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
