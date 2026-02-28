"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

interface MessageComposeProps {
  onSend: (message: string) => Promise<void>;
  sending: boolean;
}

export function MessageCompose({ onSend, sending }: MessageComposeProps) {
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    await onSend(trimmed);
    setMessage("");
  };

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="What's on your mind?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={1000}
        rows={3}
        className="resize-none"
        disabled={sending}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {message.length}/1000
        </span>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending}
          size="sm"
        >
          {sending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1.5 h-4 w-4" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
