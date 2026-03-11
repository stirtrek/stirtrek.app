"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface WizardState {
  eventName: string;
  eventSlug: string;
  eventDate: string;
  eventEndDate: string;
  venueName: string;
  timezone: string;
  tierId: "essential" | "all-in";
  addonIds: string[];
}

export interface WizardContextValue {
  state: WizardState;
  setState: (patch: Partial<WizardState>) => void;
  user: User | null;
}

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within the create-event layout");
  return ctx;
}

export const DEFAULT_STATE: WizardState = {
  eventName: "",
  eventSlug: "",
  eventDate: "",
  eventEndDate: "",
  venueName: "",
  timezone: "America/New_York",
  tierId: "essential",
  addonIds: [],
};
