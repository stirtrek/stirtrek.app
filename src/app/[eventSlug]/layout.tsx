import { notFound } from "next/navigation";
import { resolveEvent } from "@/lib/events/resolve";
import { EventProvider } from "@/providers/event-provider";

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
