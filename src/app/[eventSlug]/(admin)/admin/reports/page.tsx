"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/providers/event-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function AdminReportsPage() {
  const { eventSlug } = useEvent();
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);

  // Default the recipient to the current admin's own email.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setRecipient(data.user.email);
    });
  }, []);

  async function sendReport() {
    if (!recipient) {
      toast.error("Recipient email is required");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/${eventSlug}/api/admin/reports/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send report");
        return;
      }
      toast.success(
        `Sent ${data.session_count} sessions to ${data.sent_to}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send report",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Reports</h1>

      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Session report (CSV)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            One row per session: room, speakers, primary + simulcast attendance,
            rating breakdown (green / yellow / red), and all written comments
            concatenated. Sent as a CSV attachment.
          </p>

          <div className="space-y-1">
            <label
              htmlFor="recipient"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Send to
            </label>
            <Input
              id="recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={sending}
              placeholder="someone@example.com"
            />
          </div>

          <Button
            className="w-full"
            onClick={sendReport}
            disabled={sending || !recipient}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Email session report
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
