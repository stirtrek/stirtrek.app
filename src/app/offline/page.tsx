"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">{APP_NAME}</h1>
      <p className="mt-2 text-muted-foreground">
        You appear to be offline. Some features may be limited.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Previously viewed content may still be available.
      </p>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
