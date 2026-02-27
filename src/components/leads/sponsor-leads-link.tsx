"use client";

import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScanLine } from "lucide-react";

export function SponsorLeadsLink() {
  const { profile } = useAuth();

  if (!profile?.is_sponsor) return null;

  return (
    <Link href="/leads">
      <Card className="transition-colors hover:bg-accent">
        <CardHeader className="flex flex-row items-center gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ScanLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Sponsor Leads</CardTitle>
            <CardDescription>
              Scan badges and manage your leads
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
