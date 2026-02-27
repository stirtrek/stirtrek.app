"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useSimulatedTime } from "@/providers/simulated-time-provider";
import { isFeedbackAvailable } from "@/lib/utils";

interface FeedbackButtonProps {
  sessionId: string;
  startsAt: string | null;
}

/** Only renders the "Leave Feedback" button if the session has started on event day. */
export function FeedbackButton({ sessionId, startsAt }: FeedbackButtonProps) {
  const { getNow } = useSimulatedTime();

  if (!isFeedbackAvailable(startsAt, getNow())) return null;

  return (
    <Link href={`/schedule/${sessionId}/feedback`}>
      <Button variant="outline" className="w-full">
        <MessageSquare className="mr-2 h-4 w-4" />
        Leave Feedback
      </Button>
    </Link>
  );
}
