export const dynamic = "force-dynamic";

import Link from "next/link";
import { Home } from "lucide-react";
import { NotificationProvider } from "@/providers/notification-provider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <div className="mx-auto min-h-screen max-w-[400px]">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/admin" className="font-semibold">
            Admin
          </Link>
          <Link
            href="/schedule"
            className="text-muted-foreground hover:text-foreground"
          >
            <Home className="h-5 w-5" />
          </Link>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </NotificationProvider>
  );
}
