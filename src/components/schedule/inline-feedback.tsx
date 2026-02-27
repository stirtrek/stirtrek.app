"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/providers/feedback-provider";
import { FEEDBACK_RATINGS } from "@/lib/constants";
import { CheckCircle, MessageSquare } from "lucide-react";
import type { FeedbackRating } from "@/lib/types";

interface InlineFeedbackProps {
  sessionId: string;
  /** When true, the form is always visible. When false, a toggle button is shown first. */
  autoExpand: boolean;
}

export function InlineFeedback({ sessionId, autoExpand }: InlineFeedbackProps) {
  const { getFeedback, submitFeedback } = useFeedback();
  const existing = getFeedback(sessionId);

  const [expanded, setExpanded] = useState(autoExpand);
  const [rating, setRating] = useState<FeedbackRating | null>(
    existing?.rating ?? null
  );
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saved, setSaved] = useState(false);

  // Sync from provider when existing feedback changes (e.g. after initial load)
  useEffect(() => {
    if (existing) {
      setRating(existing.rating);
      setComment(existing.comment ?? "");
    }
  }, [existing]);

  // Auto-expand if there's existing feedback, even on full schedule
  useEffect(() => {
    if (existing && !autoExpand) {
      setExpanded(true);
    }
  }, [existing, autoExpand]);

  const handleSave = async () => {
    if (!rating) return;
    await submitFeedback(sessionId, rating, comment.trim() || null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(true);
        }}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Provide session feedback
      </button>
    );
  }

  return (
    <div
      className="space-y-2 pt-2 border-t border-border mt-2"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Rating buttons */}
      <div className="flex gap-2">
        {(
          Object.entries(FEEDBACK_RATINGS) as [
            FeedbackRating,
            { label: string; color: string },
          ][]
        ).map(([key, { label, color }]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRating(key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
              rating === key
                ? "border-current font-medium shadow-sm"
                : "border-muted hover:border-muted-foreground/30"
            }`}
            style={{ color: rating === key ? color : undefined }}
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            {label}
          </button>
        ))}
      </div>

      {/* Comment textarea */}
      <Textarea
        placeholder="Comments (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="text-xs resize-none"
      />

      {/* Save button */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!rating}
          className="text-xs h-7 px-3"
        >
          {saved ? (
            <>
              <CheckCircle className="mr-1 h-3 w-3" />
              Saved
            </>
          ) : (
            "Save Feedback"
          )}
        </Button>
        {!autoExpand && !existing && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
