"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Play,
  Square,
  BarChart3,
  Pencil,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import type { PollStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PollListItem {
  id: string;
  question: string;
  status: PollStatus;
  option_count: number;
  response_count: number;
  created_at: string;
}

interface PollDetail {
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

interface FormOption {
  key: string;
  text: string;
}

type View =
  | { mode: "list" }
  | { mode: "form"; pollId: string | null }
  | { mode: "results"; pollId: string; question: string; status: PollStatus };

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const statusBadge: Record<
  PollStatus,
  { label: string; variant: "secondary" | "default" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  closed: { label: "Closed", variant: "outline" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPollsPage() {
  const [view, setView] = useState<View>({ mode: "list" });

  return (
    <div className="space-y-4">
      {view.mode === "list" && (
        <PollList
          onNew={() => setView({ mode: "form", pollId: null })}
          onEdit={(id) => setView({ mode: "form", pollId: id })}
          onResults={(id, question, status) =>
            setView({ mode: "results", pollId: id, question, status })
          }
        />
      )}

      {view.mode === "form" && (
        <PollForm
          pollId={view.pollId}
          onBack={() => setView({ mode: "list" })}
        />
      )}

      {view.mode === "results" && (
        <PollResults
          pollId={view.pollId}
          question={view.question}
          status={view.status}
          onBack={() => setView({ mode: "list" })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List View
// ---------------------------------------------------------------------------

function PollList({
  onNew,
  onEdit,
  onResults,
}: {
  onNew: () => void;
  onEdit: (id: string) => void;
  onResults: (id: string, question: string, status: PollStatus) => void;
}) {
  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPolls = useCallback(async () => {
    const res = await fetch("/api/admin/polls");
    if (res.ok) {
      const data = await res.json();
      setPolls(data.polls ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const res = await fetch(`/api/admin/polls/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      toast.success(
        newStatus === "active" ? "Poll activated" : "Poll closed",
      );
      fetchPolls();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to update status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this draft poll?")) return;

    const res = await fetch(`/api/admin/polls/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Poll deleted");
      fetchPolls();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to delete poll");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">Polls</h1>
        </div>
        <Button size="sm" onClick={onNew}>
          <Plus className="mr-1 h-4 w-4" />
          New
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : polls.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No polls yet. Create one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {polls.map((poll) => {
            const badge = statusBadge[poll.status];
            return (
              <Card key={poll.id} className="gap-0 py-0">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {poll.question}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {poll.option_count} option
                        {poll.option_count !== 1 ? "s" : ""}
                        {poll.response_count > 0 && (
                          <> &middot; {poll.response_count} vote{poll.response_count !== 1 ? "s" : ""}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end gap-1">
                    {poll.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(poll.id)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleStatusChange(poll.id, "active")
                          }
                        >
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Activate
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDelete(poll.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {poll.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onResults(poll.id, poll.question, poll.status)
                          }
                        >
                          <BarChart3 className="mr-1 h-3.5 w-3.5" />
                          Results
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleStatusChange(poll.id, "closed")
                          }
                        >
                          <Square className="mr-1 h-3.5 w-3.5" />
                          Close
                        </Button>
                      </>
                    )}
                    {poll.status === "closed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onResults(poll.id, poll.question, poll.status)
                        }
                      >
                        <BarChart3 className="mr-1 h-3.5 w-3.5" />
                        Results
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Form View (Create / Edit)
// ---------------------------------------------------------------------------

function PollForm({
  pollId,
  onBack,
}: {
  pollId: string | null;
  onBack: () => void;
}) {
  const isEdit = pollId !== null;
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [options, setOptions] = useState<FormOption[]>([
    { key: crypto.randomUUID(), text: "" },
    { key: crypto.randomUUID(), text: "" },
  ]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    async function loadPoll() {
      const res = await fetch(`/api/admin/polls/${pollId}`);
      if (!res.ok) {
        toast.error("Failed to load poll");
        onBack();
        return;
      }
      const { poll } = await res.json();
      setQuestion(poll.question);
      setDescription(poll.description || "");
      setAllowMultiple(poll.allow_multiple);
      setOptions(
        poll.options.map((o: { text: string }) => ({
          key: crypto.randomUUID(),
          text: o.text,
        })),
      );
      setLoading(false);
    }

    loadPoll();
  }, [isEdit, pollId, onBack]);

  const addOption = () => {
    setOptions((prev) => [...prev, { key: crypto.randomUUID(), text: "" }]);
  };

  const removeOption = (key: string) => {
    setOptions((prev) => prev.filter((o) => o.key !== key));
  };

  const updateOption = (key: string, text: string) => {
    setOptions((prev) =>
      prev.map((o) => (o.key === key ? { ...o, text } : o)),
    );
  };

  const canSave =
    question.trim() &&
    options.length >= 2 &&
    options.every((o) => o.text.trim());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);

    const body = {
      question,
      description,
      allow_multiple: allowMultiple,
      options: options.map((o) => o.text),
    };

    const res = isEdit
      ? await fetch(`/api/admin/polls/${pollId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/admin/polls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (res.ok) {
      toast.success(isEdit ? "Poll updated" : "Poll created");
      onBack();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save poll");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">
          {isEdit ? "Edit Poll" : "New Poll"}
        </h1>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poll Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What do you want to ask?"
                required
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional context..."
                rows={2}
                disabled={saving}
              />
            </div>

            <button
              type="button"
              onClick={() => setAllowMultiple((prev) => !prev)}
              disabled={saving}
              className="flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <CheckSquare
                className={`h-4 w-4 ${allowMultiple ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={allowMultiple ? 2.5 : 1.5}
              />
              <span
                className={
                  allowMultiple ? "text-foreground" : "text-muted-foreground"
                }
              >
                Allow multiple selections
              </span>
            </button>
          </CardContent>
        </Card>

        <Card className="mt-3">
          <CardHeader>
            <CardTitle className="text-base">Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {options.map((option, i) => (
              <div key={option.key} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <Input
                  value={option.text}
                  onChange={(e) => updateOption(option.key, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  disabled={saving}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeOption(option.key)}
                  disabled={saving || options.length <= 2}
                  className="shrink-0 text-muted-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addOption}
              disabled={saving}
              className="w-full"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add option
            </Button>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={saving || !canSave}
          className="mt-3 w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEdit ? (
            "Save Changes"
          ) : (
            "Create Poll"
          )}
        </Button>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Results View
// ---------------------------------------------------------------------------

function PollResults({
  pollId,
  question,
  status,
  onBack,
}: {
  pollId: string;
  question: string;
  status: PollStatus;
  onBack: () => void;
}) {
  const [results, setResults] = useState<PollResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchResults = useCallback(async () => {
    const res = await fetch(`/api/admin/polls/${pollId}/results`);
    if (res.ok) {
      const data = await res.json();
      setResults(data.results ?? []);
      setTotalVotes(data.total_votes ?? 0);
    }
    setLoading(false);
  }, [pollId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleClose = async () => {
    setClosing(true);
    const res = await fetch(`/api/admin/polls/${pollId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });

    if (res.ok) {
      toast.success("Poll closed");
      onBack();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to close poll");
      setClosing(false);
    }
  };

  const maxVotes = Math.max(...results.map((r) => r.vote_count), 1);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">Results</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{question}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No options to display.
                </p>
              ) : (
                results.map((r) => {
                  const pct =
                    totalVotes > 0
                      ? Math.round((r.vote_count / totalVotes) * 100)
                      : 0;
                  const barWidth =
                    maxVotes > 0 ? (r.vote_count / maxVotes) * 100 : 0;

                  return (
                    <div key={r.option_id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm">{r.option_text}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                          {r.vote_count} ({pct}%)
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {status === "active" && (
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={handleClose}
              disabled={closing}
            >
              {closing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Closing...
                </>
              ) : (
                <>
                  <Square className="mr-1 h-4 w-4" />
                  Close Poll
                </>
              )}
            </Button>
          )}
        </>
      )}
    </>
  );
}
