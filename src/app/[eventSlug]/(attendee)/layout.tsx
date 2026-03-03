import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { DevTimeBanner } from "@/components/layout/dev-time-banner";
import { PushPrompt } from "@/components/layout/push-prompt";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { PresenceTracker } from "@/components/presence-tracker";
import { SimulatedTimeProvider } from "@/providers/simulated-time-provider";
import { BookmarkProvider } from "@/providers/bookmark-provider";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { NotificationProvider } from "@/providers/notification-provider";

export const dynamic = "force-dynamic";

export default function AttendeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SimulatedTimeProvider>
      <NotificationProvider>
        <PullToRefresh>
          <div className="flex min-h-screen flex-col">
            <OfflineIndicator />
            <Header />
            <DevTimeBanner />
            <PresenceTracker />
            <PushPrompt />
            <main className="mx-auto w-full max-w-md flex-1 px-4 pb-20 pt-4">
              <BookmarkProvider>
                <FeedbackProvider>{children}</FeedbackProvider>
              </BookmarkProvider>
            </main>
            <BottomNav />
          </div>
        </PullToRefresh>
      </NotificationProvider>
    </SimulatedTimeProvider>
  );
}
