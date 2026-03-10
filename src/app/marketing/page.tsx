import { createAdminClient } from "@/lib/supabase/admin";

// Revalidate every 5 minutes so the event directory stays fresh
export const revalidate = 300;

import {
  Calendar,
  BarChart3,
  Bell,
  MessageCircle,
  ScanLine,
  Smartphone,
  Globe,
} from "lucide-react";

interface PublicEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  event_date: string | null;
  event_end_date: string | null;
  venue_name: string | null;
  accent_color: string | null;
  domain: string | null;
}

const FEATURES = [
  {
    icon: Calendar,
    title: "Schedule & Speakers",
    description:
      "Synced from Sessionize. Attendees browse sessions, build personal schedules, and get session reminders.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Polls",
    description:
      "Run live polls during sessions or throughout the event. Results update instantly for everyone.",
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description:
      "Send announcements that reach attendees instantly, even when the app is closed.",
  },
  {
    icon: MessageCircle,
    title: "Feedback & Concerns",
    description:
      "Attendees can privately report issues to staff with a built-in messaging thread.",
  },
  {
    icon: ScanLine,
    title: "Sponsor Lead Capture",
    description:
      "Sponsors scan attendee badges to capture leads. Export contact lists after the event.",
  },
  {
    icon: Smartphone,
    title: "Installable PWA",
    description:
      "Works offline, installs to the home screen, and feels native on any device. No app store required.",
  },
];

function formatEventDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getEventUrl(event: PublicEvent) {
  if (event.domain) return `https://${event.domain}`;
  return `/${event.slug}`;
}

export default async function MarketingPage() {
  const admin = createAdminClient();
  const { data: events } = await admin
    .from("events")
    .select(
      "id, slug, name, description, logo_url, event_date, event_end_date, venue_name, accent_color, domain",
    )
    .eq("is_active", true)
    .eq("show_on_marketing", true)
    .order("event_date", { ascending: true });

  const activeEvents = (events ?? []) as PublicEvent[];

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Conference Day",
    url: "https://conferenceday.app",
    description:
      "Day-of mobile attendee app for conferences and events. Schedules, live polls, push notifications, and sponsor tools.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires a modern web browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Contact for pricing",
    },
    creator: {
      "@type": "Person",
      name: "Jeff Blankenburg",
      url: "https://jeffblankenburg.info",
    },
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Conference Day",
    url: "https://conferenceday.app",
    logo: "https://conferenceday.app/icon.png",
    sameAs: [
      "https://x.com/jeffblankenburg",
      "https://bsky.app/profile/jeffblankenburg.com",
      "https://linkedin.com/in/jeffblankenburg",
    ],
    founder: {
      "@type": "Person",
      name: "Jeff Blankenburg",
    },
  };

  const eventsJsonLd = activeEvents
    .filter((e) => e.event_date)
    .map((event) => ({
      "@context": "https://schema.org",
      "@type": "Event",
      name: event.name,
      startDate: event.event_date,
      ...(event.event_end_date && { endDate: event.event_end_date }),
      ...(event.venue_name && {
        location: { "@type": "Place", name: event.venue_name },
      }),
      url: event.domain
        ? `https://${event.domain}`
        : `https://conferenceday.app/${event.slug}`,
      organizer: {
        "@type": "Organization",
        name: "Conference Day",
        url: "https://conferenceday.app",
      },
    }));

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}
    >
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      {eventsJsonLd.map((eventLd, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }}
        />
      ))}

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-sky-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/cd_logo.png" alt="" className="h-9 w-9 drop-shadow-md" aria-hidden="true" />
            <span className="text-lg font-bold tracking-tight text-slate-800">
              Conference Day
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#features"
              className="hidden text-sm font-medium text-slate-500 transition-colors hover:text-sky-600 sm:block"
            >
              Features
            </a>
            <a
              href="#events"
              className="hidden text-sm font-medium text-slate-500 transition-colors hover:text-sky-600 sm:block"
            >
              Events
            </a>
            <a
              href="https://jeffblankenburg.info"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-6 pb-20 pt-16 text-center md:pb-28 md:pt-24">
        {/* Sky gradient background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #e0f2fe 0%, #bae6fd 30%, #7dd3fc 60%, #38bdf8 100%)",
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes drift {
                from { transform: translateX(-100%); }
                to   { transform: translateX(calc(100vw + 100%)); }
              }
              @keyframes sun-glow {
                0%, 100% { opacity: 0.8; transform: scale(1); }
                50%      { opacity: 1;   transform: scale(1.06); }
              }
            `,
          }}
        />

        {/* Logo sun — rendered BEFORE clouds so clouds drift in front */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/cd_logo.png"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "140px",
              right: "12%",
              top: "2%",
              filter: "drop-shadow(0 0 30px rgba(251,191,36,0.5))",
              animation: "sun-glow 4s ease-in-out infinite",
            }}
          />
        </div>

        {/* Animated clouds — rendered AFTER sun so they pass in front */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/noun-cloud-6444072.svg"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "320px",
              top: "8%",
              opacity: 0.9,
              animation: "drift 55s linear infinite",
              animationDelay: "-30s",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/noun-cloud-2908391.svg"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "220px",
              top: "25%",
              opacity: 0.8,
              animation: "drift 30s linear infinite",
              animationDelay: "-8s",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/noun-cloud-7861972.svg"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "180px",
              top: "5%",
              opacity: 0.85,
              animation: "drift 24s linear infinite",
              animationDelay: "-18s",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/noun-cloud-677892.svg"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "260px",
              top: "18%",
              opacity: 0.7,
              animation: "drift 65s linear infinite",
              animationDelay: "-15s",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/noun-cloud-4398110.svg"
            alt=""
            aria-hidden="true"
            className="absolute"
            style={{
              width: "200px",
              top: "38%",
              opacity: 0.6,
              animation: "drift 48s linear infinite",
              animationDelay: "-38s",
            }}
          />

          {/* Soft horizon fade to white */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24"
            style={{
              background:
                "linear-gradient(to top, white 0%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-sky-700 shadow-sm backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/cd_logo.png" alt="" className="h-5 w-5" aria-hidden="true" />
            Smooth sailing for your next event
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-6xl">
            The Day-Of App for{" "}
            <span className="text-sky-600">Conferences &amp; Events</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-xl font-medium text-slate-700">
            Your attendees&apos; experience, handled.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Conference Day is the all-in-one day-of attendee app for
            conferences and events. Schedules, live polls, push notifications,
            sponsor tools — everything your attendees need, right in their
            pocket. No app store required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="https://jeffblankenburg.info"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-xl hover:shadow-sky-500/30 active:translate-y-0"
            >
              Get Started for Your Event
            </a>
            <a
              href="#events"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              See It in Action
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-sky-500">
            Features
          </div>
          <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Conference App Features for Organizers &amp; Attendees
          </h2>
          <p className="mx-auto mb-14 max-w-lg text-center text-slate-500">
            One app. Zero stress. Focus on making your event great — we&apos;ll
            handle the attendee experience.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-100/50"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100">
                    <Icon className="h-5 w-5 text-sky-600" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Event Directory ── */}
      {activeEvents.length > 0 && (
        <section
          id="events"
          className="px-6 py-20"
          style={{
            background:
              "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
          }}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-sky-500">
              In the Wild
            </div>
            <h2 className="mb-4 text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Events Powered by Conference Day
            </h2>
            <p className="mx-auto mb-14 max-w-lg text-center text-slate-500">
              These events are using Conference Day to deliver a great attendee
              experience.
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeEvents.map((event) => (
                <a
                  key={event.id}
                  href={getEventUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-white bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-100/50"
                >
                  {event.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.logo_url}
                      alt={event.name}
                      className="mx-auto mb-4 h-16 w-16 rounded-2xl border border-slate-200 object-contain p-1"
                    />
                  ) : (
                    <div
                      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
                      style={{
                        backgroundColor: event.accent_color || "#0ea5e9",
                      }}
                    >
                      {event.name.charAt(0)}
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-sky-600">
                    {event.name}
                  </h3>
                  <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                    {event.event_date && (
                      <p>{formatEventDate(event.event_date)}</p>
                    )}
                    {event.venue_name && (
                      <p className="text-xs text-slate-400">
                        {event.venue_name}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── About ── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://jeffblankenburg.info/img/headshot.png"
            alt="Jeff Blankenburg"
            className="mx-auto mb-6 h-20 w-20 rounded-full object-cover shadow-lg shadow-sky-100/50"
            style={{
              border: "3px solid #e0f2fe",
            }}
          />
          <p className="text-sm leading-relaxed text-slate-600">
            Hi, I&apos;m Jeff Blankenburg. I built this app because I think
            every event deserves a great experience. If it made your day even a
            little better, drop me a line &mdash; it means more than you know.
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <a
              href="https://jeffblankenburg.info"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-sky-500"
              aria-label="Website"
            >
              <Globe className="h-5 w-5" />
            </a>
            <a
              href="https://x.com/jeffblankenburg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-sky-500"
              aria-label="X (Twitter)"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://bsky.app/profile/jeffblankenburg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-sky-500"
              aria-label="Bluesky"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.643 3.593 3.519 6.173 3.175-.39.06-3.85.67-3.85 3.322 0 4.456 6.293 4.783 8.163 1.543a5.5 5.5 0 0 0 .89-2.32 5.5 5.5 0 0 0 .89 2.32c1.87 3.24 8.163 2.913 8.163-1.543 0-2.652-3.46-3.261-3.85-3.322 2.58.344 5.388-.532 6.173-3.175C23.622 9.418 24 4.458 24 3.768c0-.69-.139-1.861-.902-2.203-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/in/jeffblankenburg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 transition-colors hover:text-sky-500"
              aria-label="LinkedIn"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-sky-100 bg-slate-50 px-6 py-8 text-center text-xs text-slate-400">
        <p>
          &copy; {new Date().getFullYear()} Conference Day &mdash; the day-of
          attendee app for conferences and events.
        </p>
        <p className="mt-1">
          Built by{" "}
          <a
            href="https://jeffblankenburg.info"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-sky-500"
          >
            Jeff Blankenburg
          </a>
        </p>
      </footer>
    </div>
  );
}
