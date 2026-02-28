"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import type { EmergencyMessageStatus, EmergencyMessageWithReplies } from "@/lib/types";

interface MessageCardProps {
  message: EmergencyMessageWithReplies;
  isAdmin: boolean;
  onReply?: (messageId: string, reply: string) => Promise<void>;
  onStatusChange?: (messageId: string, status: EmergencyMessageStatus) => Promise<void>;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSenderName(message: EmergencyMessageWithReplies) {
  if (!message.sender) return "Unknown";
  const { first_name, last_name, display_name, email } = message.sender;
  if (first_name && last_name) return `${first_name} ${last_name}`;
  if (display_name) return display_name;
  return email;
}

function getReplySenderLabel(reply: EmergencyMessageWithReplies["replies"][0]) {
  const s = reply.reply_sender;
  if (!s) return "Staff";
  const isStaff = s.role === "admin" || s.role === "staff";
  if (s.first_name && s.last_name) {
    return isStaff ? `${s.first_name} ${s.last_name} (Staff)` : "You";
  }
  if (s.display_name) {
    return isStaff ? `${s.display_name} (Staff)` : "You";
  }
  return isStaff ? "Staff" : "You";
}

// ─── Admin view ────────────────────────────────────────────────
function AdminMessageCard({
  message,
  onReply,
  onStatusChange,
}: Omit<MessageCardProps, "isAdmin">) {
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !onReply) return;
    setSending(true);
    try {
      await onReply(message.id, trimmed);
      setReplyText("");
    } finally {
      setSending(false);
    }
  };

  const statusBadge = {
    unresponded: { variant: "destructive" as const, label: "New" },
    acknowledged: { variant: "default" as const, label: "Acknowledged" },
    closed: { variant: "secondary" as const, label: "Closed" },
  }[message.status];

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Header row: name, time, badge, status buttons */}
      <div className="flex items-center gap-2 px-2.5 pt-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{getSenderName(message)}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(message.created_at)}</span>
        </div>
        <Badge variant={statusBadge.variant} className="text-[10px] px-1.5 py-0">
          {statusBadge.label}
        </Badge>
        {onStatusChange && (
          <>
            {message.status === "unresponded" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => onStatusChange(message.id, "acknowledged")}>
                Ack
              </Button>
            )}
            {message.status !== "closed" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => onStatusChange(message.id, "closed")}>
                Close
              </Button>
            )}
            {message.status === "closed" && (
              <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px]" onClick={() => onStatusChange(message.id, "unresponded")}>
                Reopen
              </Button>
            )}
          </>
        )}
      </div>

      {/* Message body */}
      <p className="text-sm whitespace-pre-wrap px-2.5 pb-1.5">{message.message}</p>

      {/* Replies */}
      {message.replies.length > 0 && (
        <div className="space-y-1 border-t px-2.5 py-1.5">
          {message.replies.map((reply) => (
            <div key={reply.id} className="rounded bg-muted/50 px-2 py-1">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium leading-none">{getReplySenderLabel(reply)}</p>
                <p className="text-[11px] text-muted-foreground leading-none">{formatTime(reply.created_at)}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap mt-0.5">{reply.reply}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {onReply && (
        <div className="border-t px-2.5 py-1.5">
          <div className="flex gap-1.5 items-end">
            <Textarea
              placeholder="Reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              maxLength={1000}
              rows={1}
              className="resize-none text-sm min-h-0"
              disabled={sending}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Attendee view (compact, expandable) ───────────────────────
function AttendeeMessageCard({
  message,
  onReply,
}: Omit<MessageCardProps, "isAdmin" | "onStatusChange">) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const hasReplies = message.replies.length > 0;
  const unreadReplies = message.replies.filter((r) => !r.is_read).length;

  const handleReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !onReply) return;
    setSending(true);
    try {
      await onReply(message.id, trimmed);
      setReplyText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Top section — always visible, toggles expand */}
      <button
        type="button"
        className="w-full text-left px-2.5 pt-1.5 pb-1.5"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Row 1: meta + caret */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
            <span>{formatTime(message.created_at)}</span>
            {hasReplies && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                {message.replies.length}
              </span>
            )}
            {unreadReplies > 0 && (
              <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-white leading-none">
                {unreadReplies}
              </span>
            )}
            {message.status === "acknowledged" && (
              <span className="text-[10px] font-medium text-blue-400">Acknowledged</span>
            )}
            {message.status === "closed" && (
              <span className="text-[10px] font-medium text-muted-foreground/60">Closed</span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Row 2: message text */}
        <p className="text-sm whitespace-pre-wrap mt-0.5">{message.message}</p>
      </button>

      {/* Expanded section — slides open below */}
      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5">
          {/* Replies */}
          {hasReplies && (
            <div className="space-y-1">
              {message.replies.map((reply) => (
                <div
                  key={reply.id}
                  className="rounded bg-muted/50 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium leading-none">
                      {getReplySenderLabel(reply)}
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-none">
                      {formatTime(reply.created_at)}
                    </p>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">{reply.reply}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply input */}
          {onReply && (
            <div className="flex gap-1.5 items-end">
              <Textarea
                placeholder={hasReplies ? "Reply..." : "Add more details..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                maxLength={1000}
                rows={1}
                className="resize-none text-sm min-h-0"
                disabled={sending}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleReply}
                disabled={!replyText.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Exported wrapper ──────────────────────────────────────────
export function MessageCard(props: MessageCardProps) {
  if (props.isAdmin) {
    return (
      <AdminMessageCard
        message={props.message}
        onReply={props.onReply}
        onStatusChange={props.onStatusChange}
      />
    );
  }
  return (
    <AttendeeMessageCard
      message={props.message}
      onReply={props.onReply}
    />
  );
}
