"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ============================================================
// Wizard state context
// ============================================================

interface WizardState {
  eventName: string;
  eventSlug: string;
  eventDate: string;
  eventEndDate: string;
  venueName: string;
  timezone: string;
  tierId: "essential" | "all-in";
  addonIds: string[];
}

interface WizardContextValue {
  state: WizardState;
  setState: (patch: Partial<WizardState>) => void;
  user: User | null;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within the create-event layout");
  return ctx;
}

const DEFAULT_STATE: WizardState = {
  eventName: "",
  eventSlug: "",
  eventDate: "",
  eventEndDate: "",
  venueName: "",
  timezone: "America/New_York",
  tierId: "essential",
  addonIds: [],
};

// ============================================================
// Steps for progress indicator
// ============================================================

const STEPS = [
  { path: "/create-event", label: "Event Details" },
  { path: "/create-event/add-ons", label: "Plan & Add-ons" },
  { path: "/create-event/review", label: "Review" },
];

export default function CreateEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [wizardState, setWizardState] = useState<WizardState>(DEFAULT_STATE);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      if (!user && pathname !== "/create-event/login") {
        router.push("/create-event/login");
      } else {
        setUser(user);
      }
      setLoading(false);
    });
  }, [pathname, router]);

  const updateState = (patch: Partial<WizardState>) => {
    setWizardState((prev) => ({ ...prev, ...patch }));
  };

  // Don't show chrome on login or success pages
  const isLoginPage = pathname === "/create-event/login";
  const isSuccessPage = pathname === "/create-event/success";
  const showSteps = !isLoginPage && !isSuccessPage;

  const currentStepIndex = STEPS.findIndex((s) => s.path === pathname);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <WizardContext.Provider value={{ state: wizardState, setState: updateState, user }}>
      <div
        className="min-h-screen bg-gradient-to-b from-sky-50 to-white"
        style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
      >
        {/* Nav */}
        <nav className="sticky top-0 z-50 border-b border-sky-200/60 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
            <a href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/cd_logo.png" alt="" className="h-9 w-9 drop-shadow-md" aria-hidden="true" />
              <span className="text-lg font-bold tracking-tight text-slate-800">
                Conference Day
              </span>
            </a>
          </div>
        </nav>

        {/* Step indicator */}
        {showSteps && (
          <div className="mx-auto max-w-3xl px-6 pt-6">
            <div className="flex items-center gap-2">
              {STEPS.map((step, i) => (
                <div key={step.path} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      i <= currentStepIndex
                        ? "bg-sky-500 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span
                    className={`hidden text-sm font-medium sm:block ${
                      i <= currentStepIndex ? "text-sky-700" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-px w-8 ${
                        i < currentStepIndex ? "bg-sky-400" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      </div>
    </WizardContext.Provider>
  );
}
