"use client";

import { useCallback } from "react";
import { useSimulation } from "@/providers/simulation-provider";
import { toast } from "sonner";

export function useSimulationGuard() {
  const { isSimulating } = useSimulation();

  /** Returns true if the action should be blocked. */
  const guardWrite = useCallback(
    (actionName?: string) => {
      if (isSimulating) {
        toast.error(
          actionName
            ? `Cannot ${actionName} during simulation`
            : "Cannot modify data during simulation",
        );
        return true;
      }
      return false;
    },
    [isSimulating],
  );

  return { isSimulating, guardWrite };
}
