"use client";

import { useSimulation } from "@/providers/simulation-provider";
import { useEvent } from "@/providers/event-provider";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function SimulationBanner() {
  const { simulatedUser, isSimulating, stopSimulation } = useSimulation();
  const { eventPath } = useEvent();
  const router = useRouter();

  if (!isSimulating || !simulatedUser) return null;

  const name =
    [simulatedUser.first_name, simulatedUser.last_name]
      .filter(Boolean)
      .join(" ") ||
    simulatedUser.display_name ||
    simulatedUser.email;

  const handleStop = () => {
    stopSimulation();
    router.push(eventPath("/admin"));
  };

  return (
    <div className="sticky top-0 z-[55] flex items-center justify-center gap-2 bg-purple-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
      <span>
        Simulating: {name} ({simulatedUser.role}) &mdash; Read-only
      </span>
      <button
        onClick={handleStop}
        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors hover:bg-white/30"
      >
        <X className="h-3 w-3" />
        Stop
      </button>
    </div>
  );
}
