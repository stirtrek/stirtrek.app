"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AnimatedLogo, STAR_COLORS } from "@/components/layout/animated-logo";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function HomePage() {
  // Default to first color for SSR, randomize on client to avoid hydration mismatch
  const [accentColor, setAccentColor] = useState(STAR_COLORS[0]);

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(true); // default true to avoid flash

  useEffect(() => {
    setAccentColor(
      STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    );

    // Check if already running as installed PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsInstalled(false);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Listen for successful install
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  }, [installPrompt]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#1B1D23] p-6 text-center">
      {/* Speed lines background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(244,246,248,0.1) 20px, rgba(244,246,248,0.1) 22px)",
        }}
      />

      <div className="relative z-20 flex flex-col items-center gap-8">
        <AnimatedLogo className="w-72" color={accentColor} />

        <div
          className="flex flex-col items-center gap-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <p className="text-lg font-bold text-[#F4F6F8]">May 1, 2026</p>
          <a
            href="https://maps.google.com/?daddr=275+Easton+Town+Ctr,+Columbus,+OH+43219"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#B8BDC7] transition-colors hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            AMC Easton Town Center 30
          </a>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98]"
            style={{
              backgroundColor: accentColor,
              border: "2px solid #F4F6F8",
              boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Sign In
          </Link>

          <Link
            href="/schedule"
            className="inline-flex items-center justify-center rounded-md px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-[#F4F6F8] transition-all hover:-translate-y-0.5 hover:scale-[1.02] hover:text-white active:translate-y-0 active:scale-[0.98]"
            style={{
              backgroundColor: "#1B1D23",
              border: "2px solid rgba(255,255,255,0.2)",
              boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Browse Schedule
          </Link>
        </div>
      </div>

      {/* PWA install prompt - only shown when not installed */}
      {!isInstalled && (
        <div
          className="absolute bottom-6 z-20 w-full max-w-xs px-6"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur">
            <p className="text-xs text-[#B8BDC7]">
              Install this app on your phone<br />
              for quick access on event day.
            </p>
            {installPrompt ? (
              <button
                onClick={handleInstall}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  backgroundColor: accentColor,
                  border: "1px solid rgba(255,255,255,0.2)",
                  boxShadow: "3px 3px 0 rgba(0,0,0,0.35)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/StirTrek-stackedY.png"
                  alt=""
                  className="h-4 w-4 object-contain"
                />
                Install App
              </button>
            ) : (
              <p className="mt-1.5 text-[10px] text-[#B8BDC7]/60">
                Use your browser&apos;s &quot;Add to Home Screen&quot; option.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
