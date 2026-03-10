import { TIERS, ADD_ONS, formatPrice } from "@/lib/pricing";
import { Check, Star, ArrowRight } from "lucide-react";

export const revalidate = 3600; // 1 hour

export default function PricingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-sky-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cd_logo.png"
              alt=""
              className="h-9 w-9 drop-shadow-md"
              aria-hidden="true"
            />
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Conference Day
            </span>
          </a>
          <div className="flex items-center gap-6">
            <a
              href="/"
              className="hidden text-sm font-medium text-slate-500 transition-colors hover:text-sky-600 sm:block"
            >
              Home
            </a>
            <a
              href="/create-event"
              className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="px-6 py-20 text-center"
        style={{
          background: "linear-gradient(180deg, #e0f2fe 0%, #ffffff 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-sm font-semibold uppercase tracking-widest text-sky-500">
            Pricing
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            One payment per event. No monthly fees, no per-attendee charges.
            Pick a plan and add what you need.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="px-6 pb-12">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl border-2 p-8 ${
                tier.badge
                  ? "border-sky-500 bg-sky-50/50 shadow-lg shadow-sky-100/50"
                  : "border-slate-200 bg-white"
              }`}
            >
              {tier.badge && (
                <span className="absolute -top-3 right-4 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-bold text-amber-900">
                  <Star className="h-3 w-3" />
                  {tier.badge}
                </span>
              )}
              <div className="mb-1 text-lg font-bold text-slate-900">
                {tier.name}
              </div>
              <div className="mb-4 text-4xl font-extrabold text-slate-900">
                {formatPrice(tier.priceCents)}
                <span className="text-base font-normal text-slate-400">
                  {" "}
                  / event
                </span>
              </div>
              <p className="mb-6 text-sm text-slate-500">{tier.description}</p>
              <ul className="mb-8 space-y-2">
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Up to {tier.maxAttendees.toLocaleString()} attendees
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  {tier.maxAdmins === 1
                    ? "1 admin account"
                    : `Up to ${tier.maxAdmins} admins`}
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Schedule & speakers (Sessionize sync)
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Push notifications & announcements
                </li>
                <li className="flex items-center gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 shrink-0 text-sky-500" />
                  Installable PWA
                </li>
                {tier.id === "all-in" && (
                  <li className="flex items-center gap-2 text-sm font-semibold text-sky-600">
                    <Check className="h-4 w-4 shrink-0" />
                    All add-ons included
                  </li>
                )}
              </ul>
              <a
                href="/create-event"
                className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                  tier.badge
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-500/30 hover:bg-sky-600"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-md"
                }`}
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-slate-900">
            Add-ons
          </h2>
          <p className="mb-10 text-center text-slate-500">
            Available with the Essential plan. All included in All-In.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ADD_ONS.map((addon) => (
              <div
                key={addon.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    {addon.name}
                  </span>
                  <span className="text-sm font-bold text-sky-600">
                    +{formatPrice(addon.priceCents)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{addon.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Ready to power your event?
        </h2>
        <p className="mt-2 text-slate-500">
          Set up in minutes. Your attendees will thank you.
        </p>
        <a
          href="/create-event"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-xl"
        >
          Create Your Event
          <ArrowRight className="h-4 w-4" />
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-sky-100 bg-slate-50 px-6 py-8 text-center text-xs text-slate-400">
        <p>
          &copy; {new Date().getFullYear()} Conference Day &mdash; the day-of
          attendee app for conferences and events.
        </p>
      </footer>
    </div>
  );
}
