import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEvent } from "@/lib/events/resolve";
import { EventProvider } from "@/providers/event-provider";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventSlug: string }>;
}): Promise<Metadata> {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) return {};

  return {
    title: {
      default: event.name,
      template: `%s | ${event.name}`,
    },
    description: event.description ?? `${event.name} - Conference App`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: event.short_name ?? event.name,
    },
    ...(event.logo_url && {
      icons: {
        icon: event.logo_url,
        apple: [
          { url: event.logo_url },
        ],
      },
    }),
  };
}

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  // Skip event resolution for API routes (they handle it themselves)
  if (eventSlug === "api" || eventSlug === "offline") {
    return <>{children}</>;
  }

  const event = await resolveEvent(eventSlug);
  if (!event) {
    notFound();
  }

  return <EventProvider event={event}>{children}</EventProvider>;
}
