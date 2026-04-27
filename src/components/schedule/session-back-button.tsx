"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SessionBackButtonProps {
  fallbackHref: string;
}

export function SessionBackButton({ fallbackHref }: SessionBackButtonProps) {
  const router = useRouter();

  // Prefer router.back() so the previous URL (with filter params) is restored.
  // Fall back to the schedule index when this page was opened directly
  // (deep link, fresh tab, or a PWA cold-start).
  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <ArrowLeft className="mr-1 h-4 w-4" />
      Back
    </Button>
  );
}
