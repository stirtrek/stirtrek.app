"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { PollStatus } from "@/lib/types";

interface PollWithOptions {
  id: string;
  question: string;
  description: string | null;
  status: PollStatus;
  allow_multiple: boolean;
  options: { id: string; text: string; sort_order: number }[];
}

interface PollResult {
  option_id: string;
  option_text: string;
  vote_count: number;
}

export default function PollsPage() {
  const { user, loading: authLoading } = useAuth();
  const { eventId } = useEvent();
  const [polls, setPolls] = useState<PollWithOptions[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, PollResult[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [changingVote, setChangingVote] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(eventId), [eventId]);

  const fetchPolls = useCallback(async () => {
    if (!user) return;

    // Single query: polls + nested options + current user's responses
    const { data: pollData, error: pollError } = await supabase
      .from("polls")
      .select(
        "id, question, description, status, allow_multiple, poll_options(id, text, sort_order), poll_responses(poll_id, option_id)",
      )
      .eq("event_id", eventId)
      .eq("status", "active")
      .eq("poll_responses.user_id", user.id)
      .order("opened_at", { ascending: false });

    if (pollError) {
      console.error("Failed to load polls:", pollError.message);
      setLoading(false);
      return;
    }

    if (!pollData || pollData.length === 0) {
      setPolls([]);
      setLoading(false);
      return;
    }

    const votes: Record<string, string> = {};
    const enrichedPolls: PollWithOptions[] = pollData.map((p) => {
      const response = p.poll_responses?.[0];
      if (response) votes[p.id] = response.option_id;
      return {
        id: p.id,
        question: p.question,
        description: p.description,
        status: p.status,
        allow_multiple: p.allow_multiple,
        options: (p.poll_options ?? []).sort(
          (a, b) => a.sort_order - b.sort_order,
        ),
      };
    });

    setPolls(enrichedPolls);
    setMyVotes(votes);

    // Single batch RPC for results of all voted polls
    const votedPollIds = Object.keys(votes);
    if (votedPollIds.length > 0) {
      const { data } = await supabase.rpc("get_poll_results_batch", {
        p_poll_ids: votedPollIds,
      });
      if (data) {
        const resultMap: Record<string, PollResult[]> = {};
        for (const row of data) {
          if (!resultMap[row.poll_id]) resultMap[row.poll_id] = [];
          resultMap[row.poll_id].push({
            option_id: row.option_id,
            option_text: row.option_text,
            vote_count: row.vote_count,
          });
        }
        setResults(resultMap);
      }
    }

    setLoading(false);
  }, [user, eventId, supabase]);

  useEffect(() => {
    if (authLoading) return;
    fetchPolls();
  }, [authLoading, fetchPolls]);

  const handleVote = async (pollId: string) => {
    const optionId = selected[pollId];
    if (!optionId || !user) return;

    setSubmitting(pollId);

    try {
      const existingVote = myVotes[pollId];

      if (existingVote) {
        // Change vote: delete old, insert new
        const { error: deleteError } = await supabase
          .from("poll_responses")
          .delete()
          .eq("poll_id", pollId)
          .eq("user_id", user.id);

        if (deleteError) {
          toast.error("Failed to change vote");
          console.error("Vote delete error:", deleteError.message);
          return;
        }
      }

      const { error } = await supabase.from("poll_responses").insert({
        event_id: eventId,
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You've already voted on this poll");
        } else {
          toast.error("Failed to submit vote");
          console.error("Vote error:", error.message);
        }
        return;
      }

      setMyVotes((prev) => ({ ...prev, [pollId]: optionId }));
      setChangingVote((prev) => {
        const next = new Set(prev);
        next.delete(pollId);
        return next;
      });

      // Fetch results for this poll
      const { data } = await supabase.rpc("get_poll_results_batch", {
        p_poll_ids: [pollId],
      });
      if (data) {
        setResults((prev) => ({
          ...prev,
          [pollId]: data.map((r: { option_id: string; option_text: string; vote_count: number }) => ({
            option_id: r.option_id,
            option_text: r.option_text,
            vote_count: r.vote_count,
          })),
        }));
      }

      toast.success(existingVote ? "Vote changed!" : "Vote submitted!");
    } catch (err) {
      console.error("Vote failed:", err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Polls</h1>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Polls</h1>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No active polls right now. Check back later!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Polls</h1>

      {polls.map((poll) => {
        const voted = myVotes[poll.id];
        const pollResults = results[poll.id];

        if (voted && pollResults && !changingVote.has(poll.id)) {
          return (
            <PollResultsCard
              key={poll.id}
              poll={poll}
              results={pollResults}
              myVote={voted}
              onChangeVote={() => {
                setChangingVote((prev) => new Set(prev).add(poll.id));
                setSelected((prev) => ({ ...prev, [poll.id]: voted }));
              }}
            />
          );
        }

        return (
          <Card key={poll.id}>
            <CardHeader>
              <CardTitle className="text-base">{poll.question}</CardTitle>
              {poll.description && (
                <p className="text-sm text-muted-foreground">
                  {poll.description}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {poll.options.map((option) => {
                const isSelected = selected[poll.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setSelected((prev) => ({
                        ...prev,
                        [poll.id]: option.id,
                      }))
                    }
                    disabled={submitting === poll.id}
                    className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border hover:bg-accent"
                    } disabled:opacity-50`}
                  >
                    {option.text}
                  </button>
                );
              })}

              <Button
                className="mt-2 w-full"
                onClick={() => handleVote(poll.id)}
                disabled={!selected[poll.id] || submitting === poll.id}
              >
                {submitting === poll.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Vote"
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PollResultsCard({
  poll,
  results,
  myVote,
  onChangeVote,
}: {
  poll: PollWithOptions;
  results: PollResult[];
  myVote: string;
  onChangeVote: () => void;
}) {
  const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);
  const maxVotes = Math.max(...results.map((r) => r.vote_count), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          <div>
            <CardTitle className="text-base">{poll.question}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((r) => {
          const pct =
            totalVotes > 0 ? Math.round((r.vote_count / totalVotes) * 100) : 0;
          const barWidth =
            maxVotes > 0 ? (r.vote_count / maxVotes) * 100 : 0;
          const isMyVote = r.option_id === myVote;

          return (
            <div key={r.option_id}>
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm ${isMyVote ? "font-semibold" : ""}`}
                >
                  {r.option_text}
                  {isMyVote && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (your vote)
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {r.vote_count} ({pct}%)
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    isMyVote ? "bg-primary" : "bg-primary/50"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onChangeVote}
          className="mt-1 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Change your vote
        </button>
      </CardContent>
    </Card>
  );
}
