import Link from "next/link";
import { resolveEvent } from "@/lib/events/resolve";
import { notFound } from "next/navigation";
import { SimulatedTimeProvider } from "@/providers/simulated-time-provider";
import { BookmarkProvider } from "@/providers/bookmark-provider";

export const dynamic = "force-dynamic";

export default async function BrowseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;
  const event = await resolveEvent(eventSlug);
  if (!event) notFound();

  return (
    <SimulatedTimeProvider>
      <BookmarkProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3">
              <Link
                href={`/${eventSlug}`}
                className="flex items-center gap-2 min-w-0"
              >
                {event.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.logo_url}
                    alt={event.name}
                    className="h-8 w-8 shrink-0 object-contain"
                  />
                ) : null}
                <span className="truncate text-sm font-semibold">
                  {event.short_name || event.name}
                </span>
              </Link>
              <Link
                href={`/${eventSlug}/login`}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-accent"
              >
                Sign In
              </Link>
            </div>
          </header>
          <main className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-4">
            {children}
          </main>
        </div>
      </BookmarkProvider>
    </SimulatedTimeProvider>
  );
}
