"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useEvent } from "@/providers/event-provider";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "install-prompt-dismissed";

type Platform = "android" | "ios" | "ios-other-browser" | "desktop" | "unknown";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ reports as Mac but is touch-capable
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);

  if (isIOS) {
    // On iOS, only Safari can add to the Home Screen. CriOS = Chrome,
    // FxiOS = Firefox, EdgiOS = Edge, GSA = Google app — none can install.
    const isSafari = !/crios|fxios|edgios|gsa/i.test(ua);
    return isSafari ? "ios" : "ios-other-browser";
  }
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const { accentColor } = useEvent();

  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setDismissed(!!localStorage.getItem(DISMISSED_KEY));
    setReady(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }, []);

  const handleAction = useCallback(async () => {
    // Android/desktop Chromium: fire the native install prompt directly.
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    // Everything else (notably iOS Safari): show manual instructions.
    setDrawerOpen(true);
  }, [installPrompt]);

  // Don't render until we've checked, if already installed, dismissed,
  // or on a desktop browser with no install prompt available.
  if (!ready || installed || dismissed) return null;
  if (platform === "desktop" && !installPrompt) return null;

  const canOneTap = !!installPrompt;

  return (
    <>
      <div className="mx-auto mb-3 flex w-full max-w-md items-center gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
        <Download className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm">Want to install this like an app?</p>
        <button
          onClick={handleAction}
          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          style={{ backgroundColor: accentColor }}
        >
          {canOneTap ? "Install" : "How"}
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Install this app</SheetTitle>
            <SheetDescription>
              Add it to your Home Screen for quick, full-screen access on event
              day.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-8">
            {platform === "ios-other-browser" ? (
              <OpenInSafariNotice />
            ) : (
              <IosInstructions accentColor={accentColor} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function OpenInSafariNotice() {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm">
      <p className="font-semibold">Open this page in Safari first</p>
      <p className="mt-1 text-muted-foreground">
        On iPhone and iPad, only Safari can add apps to the Home Screen. Tap the
        menu in your current browser, choose <strong>Open in Safari</strong>,
        then follow the steps there.
      </p>
    </div>
  );
}

function IosInstructions({ accentColor }: { accentColor: string }) {
  const steps = [
    {
      icon: <Share className="h-6 w-6" style={{ color: accentColor }} />,
      title: "Tap the Share button",
      body: "It's in the toolbar at the bottom of Safari (or top on iPad).",
    },
    {
      icon: <SquarePlus className="h-6 w-6" style={{ color: accentColor }} />,
      title: "Choose “Add to Home Screen”",
      body: "Scroll down the share sheet to find it. If it isn't there, tap “More” at the bottom — it's often listed under there.",
    },
    {
      icon: (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-sm font-bold text-white"
          style={{ backgroundColor: accentColor }}
        >
          ✓
        </span>
      ),
      title: "Tap “Add”",
      body: "The app icon appears on your Home Screen, ready to launch.",
    },
  ];

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-lg border bg-card p-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {step.icon}
              <span className="font-semibold">{step.title}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
