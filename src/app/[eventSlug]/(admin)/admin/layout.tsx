export const dynamic = "force-dynamic";

import Link from "next/link";
import { Home } from "lucide-react";
import { NotificationProvider } from "@/providers/notification-provider";
import { PresenceTracker } from "@/components/presence-tracker";
import { SimulationBanner } from "@/components/layout/simulation-banner";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  return (
    <NotificationProvider>
      <div className="mx-auto min-h-screen max-w-[400px]">
        <SimulationBanner />
        <header className="flex h-14 items-center justify-between border-b px-4">
          <Link href={`/${eventSlug}/admin`} className="font-semibold">
            Admin
          </Link>
          <Link
            href={`/${eventSlug}/schedule`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Home className="h-5 w-5" />
          </Link>
        </header>
        <PresenceTracker />
        <main className="p-4">{children}</main>
      </div>
    </NotificationProvider>
  );
}
