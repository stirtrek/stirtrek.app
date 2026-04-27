"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/providers/event-provider";
import dynamic from "next/dynamic";

const QrScanner = dynamic(
  () => import("@/components/leads/qr-scanner").then((m) => m.QrScanner),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> },
);
import { parseVCard } from "@/lib/vcard";
import { Button } from "@/components/ui/button";
import { ListChecks, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ScanPage() {
  const router = useRouter();
  const { eventSlug, eventPath } = useEvent();
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const processingRef = useRef(false);

  const handleScan = useCallback(async (decodedText: string) => {
    // Prevent processing the same code multiple times in quick succession
    if (processingRef.current) return;
    processingRef.current = true;

    const haptic = (pattern: number | number[]) => {
      if (navigator.vibrate) navigator.vibrate(pattern);
    };

    const parsed = parseVCard(decodedText);
    if (!parsed) {
      haptic([50, 30, 50, 30, 50]); // error buzz
      toast.error("Not a valid badge QR code");
      setTimeout(() => {
        processingRef.current = false;
      }, 2000);
      return;
    }

    const res = await fetch(`/${eventSlug}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendee_email: parsed.email,
        attendee_first_name: parsed.firstName || null,
        attendee_last_name: parsed.lastName || null,
      }),
    });

    if (res.status === 409) {
      haptic(30); // light tap for duplicate
      toast.info("Already scanned this attendee");
    } else if (!res.ok) {
      haptic([50, 30, 50, 30, 50]); // error buzz
      const data = await res.json();
      toast.error(data.error || "Failed to save lead");
    } else {
      haptic([50, 50, 100]); // success pattern
      const name = [parsed.firstName, parsed.lastName]
        .filter(Boolean)
        .join(" ");
      setLastScanned(name || parsed.email);
      toast.success(`Saved: ${name || parsed.email}`);
    }

    // Allow next scan after a brief delay
    setTimeout(() => {
      processingRef.current = false;
    }, 2000);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Scan Badge</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(eventPath("/leads"))}
        >
          <ListChecks className="mr-1 h-4 w-4" />
          View Leads
        </Button>
      </div>

      <QrScanner onScan={handleScan} autoStart />

      {lastScanned && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Last scanned</p>
            <p className="truncate text-sm text-muted-foreground">
              {lastScanned}
            </p>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Point your camera at an attendee&apos;s QR code on their Sponsors page.
      </p>
    </div>
  );
}
