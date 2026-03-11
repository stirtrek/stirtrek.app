export const dynamic = "force-dynamic";

import Link from "next/link";
import { Home } from "lucide-react";

export default async function ProctorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventSlug: string }>;
}) {
  const { eventSlug } = await params;

  return (
    <div className="mx-auto min-h-screen max-w-[400px]">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href={`/${eventSlug}/proctor`} className="font-semibold">
          Proctor
        </Link>
        <Link
          href={`/${eventSlug}/schedule`}
          className="text-muted-foreground hover:text-foreground"
        >
          <Home className="h-5 w-5" />
        </Link>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
