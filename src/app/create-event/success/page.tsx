"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, PartyPopper, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

type VerifyResult = {
  status: string;
  event_slug: string | null;
  event_id: string | null;
  event_name: string | null;
};

export default function CreateEventSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confettiFired = useRef(false);

  const fireConfetti = useCallback(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 250);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session ID");
      return;
    }

    let attempts = 0;
    const maxAttempts = 15; // 30s at 2s intervals

    const check = async () => {
      try {
        const res = await fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (attempts >= maxAttempts) {
            setError("Verification timed out. Your event may still be provisioning — check back shortly.");
            return;
          }
          return; // Keep polling
        }

        const data: VerifyResult = await res.json();
        setResult(data);

        if (data.status === "completed") {
          // Stop polling
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          fireConfetti();
        } else if (data.status === "failed") {
          setError("Something went wrong provisioning your event. Please contact support.");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Network error, keep polling
      }
      attempts++;
    };

    // Check immediately, then poll
    check();
    pollRef.current = setInterval(check, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [sessionId, fireConfetti]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900">Hmm, something happened</h1>
          <p className="mt-2 text-slate-500">{error}</p>
          <a
            href="/create-event"
            className="mt-6 inline-flex items-center rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  if (!result || result.status === "pending") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Setting up your event...
          </h1>
          <p className="mt-1 text-slate-500">
            This usually takes just a few seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Your event is ready!
        </h1>
        <p className="mt-2 text-slate-500">
          <strong className="text-slate-700">{result.event_name}</strong> has been
          created. Head to your dashboard to set up your schedule, sponsors, and more.
        </p>
        <a
          href={`/${result.event_slug}/admin`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-xl"
        >
          Go to Your Dashboard
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
