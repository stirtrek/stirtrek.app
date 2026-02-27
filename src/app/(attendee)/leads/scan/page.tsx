"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { QrScanner } from "@/components/leads/qr-scanner";
import { parseVCard } from "@/lib/vcard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ScanPage() {
  const router = useRouter();
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const processingRef = useRef(false);

  const handleScan = useCallback(async (decodedText: string) => {
    // Prevent processing the same code multiple times in quick succession
    if (processingRef.current) return;
    processingRef.current = true;

    const parsed = parseVCard(decodedText);
    if (!parsed) {
      toast.error("Not a valid badge QR code");
      setTimeout(() => {
        processingRef.current = false;
      }, 2000);
      return;
    }

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendee_email: parsed.email,
        attendee_first_name: parsed.firstName || null,
        attendee_last_name: parsed.lastName || null,
      }),
    });

    if (res.status === 409) {
      toast.info("Already scanned this attendee");
    } else if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Failed to save lead");
    } else {
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
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/leads")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-lg font-bold">Scan Badge</h1>
      </div>

      <QrScanner onScan={handleScan} />

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
