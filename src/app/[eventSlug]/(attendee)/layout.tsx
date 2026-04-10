import { redirect } from "next/navigation";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { OfflineIndicator } from "@/components/layout/offline-indicator";
import { DevTimeBanner } from "@/components/layout/dev-time-banner";
import { SimulationBanner } from "@/components/layout/simulation-banner";
import { PushPrompt } from "@/components/layout/push-prompt";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";
import { PresenceTracker } from "@/components/presence-tracker";
import { SimulatedTimeProvider } from "@/providers/simulated-time-provider";
import { MembershipProvider } from "@/providers/membership-provider";
import { BookmarkProvider } from "@/providers/bookmark-provider";
import { FeedbackProvider } from "@/providers/feedback-provider";
import { NotificationProvider } from "@/providers/notification-provider";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AttendeeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}) {
  // Defense-in-depth: middleware also redirects unauthenticated users,
  // but enforcing here means a stale middleware state can't slip past.
  const user = await getAuthUser();
  if (!user) {
    const { eventSlug } = await params;
    redirect(`/${eventSlug}/login`);
  }

  return (
    <SimulatedTimeProvider>
      <MembershipProvider>
        <NotificationProvider>
          <PullToRefresh>
            <div className="flex min-h-screen flex-col">
              <SimulationBanner />
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
      </MembershipProvider>
    </SimulatedTimeProvider>
  );
}
