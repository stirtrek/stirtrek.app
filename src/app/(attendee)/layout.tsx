import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { DevTimeBanner } from "@/components/layout/dev-time-banner";
import { PresenceTracker } from "@/components/presence-tracker";
import { SimulatedTimeProvider } from "@/providers/simulated-time-provider";
import { BookmarkProvider } from "@/providers/bookmark-provider";

export const dynamic = "force-dynamic";

export default function AttendeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SimulatedTimeProvider>
      <div className="flex min-h-screen flex-col">
        <OfflineIndicator />
        <Header />
        <DevTimeBanner />
        <PresenceTracker />
        <main className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">
          <BookmarkProvider>{children}</BookmarkProvider>
        </main>
        <BottomNav />
      </div>
    </SimulatedTimeProvider>
  );
}
