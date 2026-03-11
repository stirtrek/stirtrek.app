"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "./wizard-context";
import { Calendar, MapPin, Globe, Loader2 } from "lucide-react";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "Europe/London", label: "GMT / London" },
  { value: "Europe/Berlin", label: "CET / Berlin" },
  { value: "Asia/Tokyo", label: "JST / Tokyo" },
  { value: "Australia/Sydney", label: "AEST / Sydney" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default function CreateEventBasicsPage() {
  const router = useRouter();
  const { state, setState } = useWizard();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  const handleNameChange = (name: string) => {
    setState({ eventName: name });
    if (!slugManuallyEdited) {
      setState({ eventSlug: slugify(name) });
    }
  };

  const handleSlugChange = (slug: string) => {
    const cleaned = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setState({ eventSlug: cleaned });
    setSlugManuallyEdited(true);
    setSlugError(null);
  };

  const validateSlug = async () => {
    if (!state.eventSlug) return;
    setCheckingSlug(true);
    try {
      const res = await fetch(
        `/api/public/check-slug?slug=${encodeURIComponent(state.eventSlug)}`,
      );
      if (res.ok) {
        const { available } = await res.json();
        if (!available) {
          setSlugError("This URL is already taken");
        } else {
          setSlugError(null);
        }
      }
    } catch {
      // Non-critical, skip
    } finally {
      setCheckingSlug(false);
    }
  };

  const canContinue =
    state.eventName.trim().length >= 2 &&
    state.eventSlug.length >= 2 &&
    !slugError;

  const handleNext = () => {
    if (canContinue) {
      router.push("/create-event/add-ons");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Create your event
        </h1>
        <p className="mt-1 text-slate-500">
          Tell us about your event. You can update everything later in your admin dashboard.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Event name */}
        <div className="space-y-2">
          <label htmlFor="event-name" className="block text-sm font-semibold text-slate-700">
            Event name *
          </label>
          <input
            id="event-name"
            type="text"
            placeholder="My Awesome Conference"
            value={state.eventName}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* Event URL */}
        <div className="space-y-2">
          <label htmlFor="event-slug" className="block text-sm font-semibold text-slate-700">
            Event URL *
          </label>
          <div className="flex items-center gap-0">
            <span className="rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500">
              conferenceday.app/
            </span>
            <div className="relative flex-1">
              <input
                id="event-slug"
                type="text"
                placeholder="my-awesome-conf"
                value={state.eventSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={validateSlug}
                className={`w-full rounded-r-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                  slugError
                    ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                    : "border-slate-200 focus:border-sky-400 focus:ring-sky-200"
                }`}
              />
              {checkingSlug && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
          </div>
          {slugError && (
            <p className="text-sm text-red-500">{slugError}</p>
          )}
          <p className="text-xs text-slate-400">
            Only lowercase letters, numbers, and hyphens
          </p>
        </div>

        {/* Event date */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="event-date" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              Start date
            </label>
            <input
              id="event-date"
              type="date"
              value={state.eventDate}
              onChange={(e) => setState({ eventDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="event-end-date" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" />
              End date
            </label>
            <input
              id="event-end-date"
              type="date"
              value={state.eventEndDate}
              onChange={(e) => setState({ eventEndDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
        </div>

        {/* Venue */}
        <div className="space-y-2">
          <label htmlFor="venue" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <MapPin className="h-4 w-4 text-slate-400" />
            Venue name
          </label>
          <input
            id="venue"
            type="text"
            placeholder="Convention Center, City"
            value={state.venueName}
            onChange={(e) => setState({ venueName: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <label htmlFor="timezone" className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Globe className="h-4 w-4 text-slate-400" />
            Timezone
          </label>
          <select
            id="timezone"
            value={state.timezone}
            onChange={(e) => setState({ timezone: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
        >
          Choose Your Plan
        </button>
      </div>
    </div>
  );
}
