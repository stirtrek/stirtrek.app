"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/providers/notification-provider";
import { useAuth } from "@/providers/auth-provider";

const DISMISSED_KEY = "push-prompt-dismissed";

export function PushPrompt() {
  const { pushSupported, pushSubscribed, subscribeToPush } = useNotifications();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true); // Start hidden
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    setDismissed(!!localStorage.getItem(DISMISSED_KEY));
  }, []);

  // Don't show if: no user, already subscribed, not supported, or dismissed
  if (!user || pushSubscribed || !pushSupported || dismissed) return null;

  const handleEnable = async () => {
    setSubscribing(true);
    try {
      await subscribeToPush();
    } catch {
      // Permission denied or failed
    }
    setSubscribing(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="bg-primary/10 border-primary/20 mx-auto mb-3 flex w-full max-w-md items-center gap-3 rounded-lg border px-4 py-3">
      <Bell className="text-primary h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm">
        Enable notifications to get announcements and alerts.
      </p>
      <Button
        size="sm"
        variant="default"
        onClick={handleEnable}
        disabled={subscribing}
      >
        {subscribing ? "Enabling..." : "Enable"}
      </Button>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
