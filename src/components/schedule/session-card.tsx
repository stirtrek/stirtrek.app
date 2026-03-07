"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bookmark, BookmarkCheck, User } from "lucide-react";
import { cn, formatTime, isFeedbackAvailable } from "@/lib/utils";
import { useBookmarks } from "@/providers/bookmark-provider";
import { useAuth } from "@/providers/auth-provider";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { useEvent } from "@/providers/event-provider";
import { InlineFeedback } from "./inline-feedback";
import type { SessionWithDetails } from "@/lib/types";

interface SessionCardProps {
  session: SessionWithDetails;
  highlightBookmark?: boolean;
  /** "my-schedule" shows feedback auto-expanded; "full-schedule" shows toggle */
  variant?: "full-schedule" | "my-schedule";
}

export function SessionCard({ session, highlightBookmark, variant = "full-schedule" }: SessionCardProps) {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const { getNow } = useSimulatedTime();
  const { event, eventPath } = useEvent();
  const bookmarked = isBookmarked(session.id);

  const startTime = session.starts_at ? formatTime(session.starts_at, event.timezone) : "";
  const endTime = session.ends_at ? formatTime(session.ends_at, event.timezone) : "";

  const showBookmark = !session.is_service_session && !!user;

  // Show inline feedback for non-service sessions that have started on event day
  const showFeedback =
    !!user &&
    !session.is_service_session &&
    isFeedbackAvailable(session.starts_at, getNow());

  return (
    <Card
      className={cn(
        "py-0 gap-0 transition-colors",
        highlightBookmark && bookmarked && "border-[#FFD36E] bg-[#FFD36E]/10"
      )}
    >
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Link
              href={eventPath(`/schedule/${session.id}`)}
              className="flex-1 text-sm font-semibold leading-tight hover:underline"
            >
              {session.title}
            </Link>
            {showBookmark && (
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 -m-1.5 hover:bg-muted transition-colors"
                onClick={() => toggleBookmark(session.id)}
                aria-label={bookmarked ? "Remove from schedule" : "Add to schedule"}
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-5 w-5 text-primary" />
                ) : (
                  <Bookmark className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            )}
          </div>

          {session.speakers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5 shrink-0">
                {session.speakers.map((speaker) =>
                  (speaker.photo_override || speaker.profile_picture) ? (
                    <Image
                      key={speaker.id}
                      src={speaker.photo_override || speaker.profile_picture!}
                      alt={speaker.full_name}
                      width={24}
                      height={24}
                      className="h-6 w-6 rounded-full object-cover ring-2 ring-background"
                    />
                  ) : (
                    <div
                      key={speaker.id}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-background"
                    >
                      <User className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {session.speakers.map((speaker, i) => (
                  <span key={speaker.id}>
                    {i > 0 && ", "}
                    <Link
                      href={eventPath(`/speakers/${speaker.id}`)}
                      className="hover:underline"
                    >
                      {speaker.full_name}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {session.room && (
              <Link
                href={eventPath(`/schedule/room/${session.room.id}`)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <MapPin className="h-3 w-3" />
                {session.room.name}
              </Link>
            )}

            {startTime && (
              <span className="text-xs text-muted-foreground">
                {startTime} - {endTime}
              </span>
            )}

            {session.categories.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {session.categories[0].name}
              </Badge>
            )}
          </div>

          {showFeedback && (
            <InlineFeedback
              sessionId={session.id}
              autoExpand={variant === "my-schedule"}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
