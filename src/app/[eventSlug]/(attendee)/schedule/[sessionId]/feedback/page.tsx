"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { isFeedbackAvailable } from "@/lib/utils";
import { FEEDBACK_RATINGS } from "@/lib/constants";
import { useSimulation } from "@/providers/simulation-provider";
import { toast } from "sonner";
import type { FeedbackRating } from "@/lib/types";

export default function FeedbackPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { event, eventPath } = useEvent();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const { isSimulating } = useSimulation();
  const { getNow } = useSimulatedTime();
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStartsAt, setSessionStartsAt] = useState<string | null>(null);
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch session title and start time
      const { data: session } = await supabase
        .from("sessions")
        .select("title, starts_at")
        .eq("id", sessionId)
        .single();
      if (session) {
        setSessionTitle(session.title);
        setSessionStartsAt(session.starts_at);
      }

      // Check for existing feedback
      if (user) {
        const { data: existing } = await supabase
          .from("session_feedback")
          .select("*")
          .eq("user_id", user.id)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (existing) {
          setRating(existing.rating as FeedbackRating);
          setComment(existing.comment || "");
        }
      }
      setLoading(false);
    }
    load();
  }, [sessionId, user, supabase]);

  const handleSubmit = async () => {
    if (!user || !rating) return;
    if (isSimulating) {
      toast.error("Cannot submit feedback during simulation");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("session_feedback").upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        rating,
        comment: comment.trim() || null,
      },
      { onConflict: "user_id,session_id" }
    );

    if (!error) {
      setSubmitted(true);
      setTimeout(() => router.push(eventPath(`/schedule/${sessionId}`)), 1500);
    }
    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">
          Please sign in to leave feedback.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Block feedback before event day / session start
  if (!loading && !isFeedbackAvailable(sessionStartsAt, getNow())) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">
          Feedback will be available once this session begins.
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={eventPath(`/schedule/${sessionId}`)}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Feedback</CardTitle>
          {sessionTitle && (
            <p className="text-sm text-muted-foreground">{sessionTitle}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">How was this session?</label>
            <div className="flex gap-3">
              {(Object.entries(FEEDBACK_RATINGS) as [FeedbackRating, { label: string; color: string }][]).map(
                ([key, { label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRating(key)}
                    className={`flex-1 rounded-lg border-2 p-4 text-center transition-all ${
                      rating === key
                        ? "scale-105 border-current shadow-md"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                    style={{ color: rating === key ? color : undefined }}
                  >
                    <div
                      className="mx-auto mb-2 h-8 w-8 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Comments{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Textarea
              placeholder="Share your thoughts about this session..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Feedback"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
