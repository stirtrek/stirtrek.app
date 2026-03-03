export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin) {
    redirect("/");
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/super-admin" className="font-semibold">
          Super Admin
        </Link>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to App
        </Link>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
