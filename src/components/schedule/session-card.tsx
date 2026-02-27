"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bookmark, BookmarkCheck } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { useBookmarks } from "@/providers/bookmark-provider";
import { useAuth } from "@/providers/auth-provider";
import type { SessionWithDetails } from "@/lib/types";

interface SessionCardProps {
  session: SessionWithDetails;
  highlightBookmark?: boolean;
}

export function SessionCard({ session, highlightBookmark }: SessionCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(session.id);

  const startTime = session.starts_at ? formatTime(session.starts_at) : "";
  const endTime = session.ends_at ? formatTime(session.ends_at) : "";

  const showBookmark = !session.is_service_session && !!user;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent",
        highlightBookmark && bookmarked && "border-[#FFD36E] bg-[#FFD36E]/10"
      )}
      onClick={() => router.push(`/schedule/${session.id}`)}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-sm font-semibold leading-tight">
              {session.title}
            </h3>
            {showBookmark && (
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 -m-1.5 hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(session.id);
                }}
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
            <p className="text-xs text-muted-foreground">
              {session.speakers.map((s) => s.full_name).join(", ")}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {session.room && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {session.room.name}
              </span>
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
        </div>
      </CardContent>
    </Card>
  );
}
