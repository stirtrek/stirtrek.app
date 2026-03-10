"use client";

import { useRouter } from "next/navigation";
import { useWizard } from "../layout";
import { TIERS, ADD_ONS, getIncludedAddonIds, formatPrice, computeTotalCents } from "@/lib/pricing";
import { Check, Star } from "lucide-react";

export default function CreateEventAddOnsPage() {
  const router = useRouter();
  const { state, setState } = useWizard();

  // Redirect back if basics not filled in
  if (!state.eventName || !state.eventSlug) {
    router.push("/create-event");
    return null;
  }

  const includedAddonIds = getIncludedAddonIds(state.tierId);
  const total = computeTotalCents(state.tierId, state.addonIds);

  const toggleAddon = (addonId: string) => {
    const current = state.addonIds;
    if (current.includes(addonId)) {
      setState({ addonIds: current.filter((id) => id !== addonId) });
    } else {
      setState({ addonIds: [...current, addonId] });
    }
  };

  const selectTier = (tierId: "essential" | "all-in") => {
    // When switching to all-in, clear add-ons that are included
    if (tierId === "all-in") {
      const allInIncluded = getIncludedAddonIds("all-in");
      setState({
        tierId,
        addonIds: state.addonIds.filter((id) => !allInIncluded.includes(id)),
      });
    } else {
      setState({ tierId });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Choose your plan</h1>
        <p className="mt-1 text-slate-500">
          Pick a base plan and add any extras you need.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {TIERS.map((tier) => {
          const isSelected = state.tierId === tier.id;
          return (
            <button
              key={tier.id}
              onClick={() => selectTier(tier.id)}
              className={`relative rounded-2xl border-2 p-6 text-left transition-all ${
                isSelected
                  ? "border-sky-500 bg-sky-50 shadow-md shadow-sky-100/50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-amber-900">
                  <Star className="h-3 w-3" />
                  {tier.badge}
                </span>
              )}
              <div className="mb-3 text-2xl font-extrabold text-slate-900">
                {formatPrice(tier.priceCents)}
              </div>
              <div className="mb-1 text-lg font-bold text-slate-900">
                {tier.name}
              </div>
              <p className="mb-4 text-sm text-slate-500">{tier.description}</p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Up to {tier.maxAttendees.toLocaleString()} attendees
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  {tier.maxAdmins === 1 ? "1 admin account" : `Up to ${tier.maxAdmins} admin accounts`}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Schedule & speakers (Sessionize sync)
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Push notifications
                </li>
                {tier.includedFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="h-4 w-4 shrink-0 text-sky-500" />
                    {ADD_ONS.find((a) => a.featureFlag === f)?.name || f}
                  </li>
                ))}
                {tier.id === "all-in" && (
                  <li className="flex items-center gap-2 text-sm font-medium text-sky-600">
                    <Check className="h-4 w-4 shrink-0" />
                    All add-ons included
                  </li>
                )}
              </ul>
              {isSelected && (
                <div className="absolute right-4 top-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Add-ons (only for Essential tier) */}
      {state.tierId === "essential" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Add-ons</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ADD_ONS.map((addon) => {
              const isIncluded = includedAddonIds.includes(addon.id);
              const isSelected = state.addonIds.includes(addon.id);

              if (isIncluded) return null;

              return (
                <button
                  key={addon.id}
                  onClick={() => toggleAddon(addon.id)}
                  className={`rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {addon.name}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {addon.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-slate-900">
                        +{formatPrice(addon.priceCents)}
                      </div>
                      {isSelected && (
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Running total & nav */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div>
          <div className="text-sm text-slate-500">Total</div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatPrice(total)}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/create-event")}
            className="rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
          >
            Back
          </button>
          <button
            onClick={() => router.push("/create-event/review")}
            className="rounded-lg bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md active:translate-y-0"
          >
            Review Order
          </button>
        </div>
      </div>
    </div>
  );
}
