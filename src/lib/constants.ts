/** Default app name used in root layout metadata and the offline page. */
export const DEFAULT_APP_NAME = "Conference App";
export const APP_DESCRIPTION = "Day-of attendee app for conferences and events";

export const FEEDBACK_RATINGS = {
  green: { label: "Great", color: "#22c55e" },
  yellow: { label: "Okay", color: "#eab308" },
  red: { label: "Poor", color: "#ef4444" },
} as const;

export const EMERGENCY_CATEGORIES = {
  person_safety: { label: "Person Safety", icon: "ShieldAlert" },
  av_problem: { label: "A/V Problem", icon: "Monitor" },
  facility_issue: { label: "Facility Issue", icon: "Building" },
  medical: { label: "Medical", icon: "Heart" },
  other: { label: "Other", icon: "AlertCircle" },
} as const;

export const SPONSOR_TIER_ORDER = [
  "platinum",
  "gold",
  "silver",
  "bronze",
  "community",
] as const;

export const BOOTH_SPONSOR_TIERS = ["platinum", "gold", "silver"] as const;
