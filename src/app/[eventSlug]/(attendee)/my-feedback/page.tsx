"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { formatTime } from "@/lib/utils";
import { FEEDBACK_RATINGS } from "@/lib/constants";
import { useEvent } from "@/providers/event-provider";

interface FeedbackItem {
  rating: "red" | "yellow" | "green";
  comment: string | null;
  created_at: string;
}

interface SessionFeedbackSummary {
  id: string;
  title: string;
  starts_at: string | null;
  room_name: string | null;
  total: number;
  green: number;
  yellow: number;
  red: number;
  feedback: FeedbackItem[];
}

function scoreLabel(session: SessionFeedbackSummary): string {
  if (session.total === 0) return "—";
  const score =
    ((session.green * 3 + session.yellow * 2 + session.red * 1) /
      (session.total * 3)) *
    100;
  return `${Math.round(score)}%`;
}

export default function SpeakerFeedbackPage() {
  const { event, eventSlug, eventPath } = useEvent();
  const [sessions, setSessions] = useState<SessionFeedbackSummary[]>([]);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/${eventSlug}/api/speaker-feedback`)
      .then((res) => (res.ok ? res.json() : { sessions: [], is_speaker: false }))
      .then((data) => {
        setSessions(data.sessions ?? []);
        setIsSpeaker(data.is_speaker ?? false);
      })
      .finally(() => setLoading(false));
  }, [eventSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSpeaker) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href={eventPath("/profile")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Session Feedback</h1>
        </div>
        <p className="text-center text-sm text-muted-foreground py-8">
          This page is for speakers with a linked account. If you&apos;re a speaker, ask an organizer to link your profile.
        </p>
      </div>
    );
  }

  // Group by time slot
  const timeSlots = new Map<string, SessionFeedbackSummary[]>();
  for (const s of sessions) {
    const key = s.starts_at ?? "unscheduled";
    if (!timeSlots.has(key)) timeSlots.set(key, []);
    timeSlots.get(key)!.push(s);
  }

  const sortedSlots = [...timeSlots.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href={eventPath("/profile")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold">Your Session Feedback</h1>
      </div>

      <p className="text-xs text-muted-foreground">
        Tap a session to see individual feedback. Comments are anonymous. Score
        is based on green (3), yellow (2), red (1) normalized to a percentage.
      </p>

      {sessions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No feedback has been submitted for your sessions yet.
        </p>
      )}

      {sortedSlots.map(([time, group]) => (
        <Card key={time} className="gap-0 py-0">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-xs font-semibold uppercase text-muted-foreground">
              {time === "unscheduled"
                ? "Unscheduled"
                : formatTime(time, event.timezone)}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="divide-y">
              {group.map((session) => {
                const isExpanded = expandedId === session.id;
                return (
                  <div key={session.id} className="py-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 text-left"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : session.id)
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {session.title}
                        </p>
                        {session.room_name && (
                          <p className="text-[10px] text-muted-foreground">
                            {session.room_name}
                          </p>
                        )}
                        {session.total > 0 && (
                          <div className="mt-0.5 flex items-center gap-2">
                            <RatingDots session={session} />
                            <span className="text-[10px] text-muted-foreground">
                              {session.total} response
                              {session.total !== 1 && "s"} · Score:{" "}
                              {scoreLabel(session)}
                            </span>
                          </div>
                        )}
                        {session.total === 0 && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            No feedback yet
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && session.feedback.length > 0 && (
                      <div className="ml-1 mt-2 space-y-2 border-l-2 border-muted pl-2">
                        {session.feedback.map((fb, i) => (
                          <div key={i} className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    FEEDBACK_RATINGS[fb.rating].color,
                                }}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {FEEDBACK_RATINGS[fb.rating].label}
                              </span>
                            </div>
                            {fb.comment && (
                              <p className="pl-[18px] text-[11px] text-muted-foreground">
                                {fb.comment}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && session.feedback.length === 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        No feedback submitted for this session.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RatingDots({ session }: { session: SessionFeedbackSummary }) {
  return (
    <div className="flex items-center gap-1.5">
      {session.green > 0 && (
        <span className="flex items-center gap-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: FEEDBACK_RATINGS.green.color }}
          />
          <span className="text-[10px] tabular-nums font-medium">
            {session.green}
          </span>
        </span>
      )}
      {session.yellow > 0 && (
        <span className="flex items-center gap-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: FEEDBACK_RATINGS.yellow.color }}
          />
          <span className="text-[10px] tabular-nums font-medium">
            {session.yellow}
          </span>
        </span>
      )}
      {session.red > 0 && (
        <span className="flex items-center gap-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: FEEDBACK_RATINGS.red.color }}
          />
          <span className="text-[10px] tabular-nums font-medium">
            {session.red}
          </span>
        </span>
      )}
    </div>
  );
}
