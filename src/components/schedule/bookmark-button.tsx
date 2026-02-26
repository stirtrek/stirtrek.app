"use client";

import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useBookmarks } from "@/providers/bookmark-provider";
import { useAuth } from "@/providers/auth-provider";

interface BookmarkButtonProps {
  sessionId: string;
}

export function BookmarkButton({ sessionId }: BookmarkButtonProps) {
  const { user } = useAuth();
  const { isBookmarked, toggleBookmark, loading } = useBookmarks();
  const bookmarked = isBookmarked(sessionId);

  if (!user) return null;

  return (
    <Button
      variant={bookmarked ? "default" : "outline"}
      size="sm"
      onClick={() => toggleBookmark(sessionId)}
      disabled={loading}
    >
      {bookmarked ? (
        <BookmarkCheck className="mr-2 h-4 w-4" />
      ) : (
        <Bookmark className="mr-2 h-4 w-4" />
      )}
      {bookmarked ? "Saved" : "Save"}
    </Button>
  );
}
