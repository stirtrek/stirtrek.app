"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWizard } from "../wizard-context";
import { TIERS, ADD_ONS, formatPrice, computeTotalCents } from "@/lib/pricing";
import { Loader2, Calendar, MapPin, Globe } from "lucide-react";

export default function CreateEventReviewPage() {
  const router = useRouter();
  const { state } = useWizard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect back if basics not filled in
  if (!state.eventName || !state.eventSlug) {
    router.push("/create-event");
    return null;
  }

  const tier = TIERS.find((t) => t.id === state.tierId);
  const selectedAddons = ADD_ONS.filter((a) => state.addonIds.includes(a.id));
  const total = computeTotalCents(state.tierId, state.addonIds);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_id: state.tierId,
          addon_ids: state.addonIds,
          event_name: state.eventName,
          event_slug: state.eventSlug,
          event_date: state.eventDate || undefined,
          event_end_date: state.eventEndDate || undefined,
          venue_name: state.venueName || undefined,
          timezone: state.timezone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch {
      setError("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review your order</h1>
        <p className="mt-1 text-slate-500">
          Double-check everything before proceeding to payment.
        </p>
      </div>

      {/* Event details */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Event Details
        </h2>
        <div className="space-y-3">
          <div>
            <div className="text-lg font-bold text-slate-900">{state.eventName}</div>
            <div className="text-sm text-slate-500">
              conferenceday.app/{state.eventSlug}
            </div>
          </div>
          {state.eventDate && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400" />
              {new Date(state.eventDate + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {state.eventEndDate && state.eventEndDate !== state.eventDate && (
                <>
                  {" – "}
                  {new Date(state.eventEndDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </>
              )}
            </div>
          )}
          {state.venueName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              {state.venueName}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Globe className="h-4 w-4 text-slate-400" />
            {state.timezone}
          </div>
        </div>
      </div>

      {/* Order summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Order Summary
        </h2>
        <div className="divide-y">
          {/* Tier */}
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="font-semibold text-slate-900">
                {tier?.name} Plan
              </div>
              <div className="text-xs text-slate-500">{tier?.description}</div>
            </div>
            <div className="font-bold text-slate-900">
              {tier ? formatPrice(tier.priceCents) : "—"}
            </div>
          </div>

          {/* Add-ons */}
          {selectedAddons.map((addon) => (
            <div key={addon.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-semibold text-slate-900">{addon.name}</div>
                <div className="text-xs text-slate-500">{addon.description}</div>
              </div>
              <div className="font-bold text-slate-900">
                {formatPrice(addon.priceCents)}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between pt-4">
            <div className="text-lg font-bold text-slate-900">Total</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {formatPrice(total)}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <button
          onClick={() => router.push("/create-event/add-ons")}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Proceed to Payment"
          )}
        </button>
      </div>
    </div>
  );
}
