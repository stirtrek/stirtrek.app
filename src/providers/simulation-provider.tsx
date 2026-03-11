"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./auth-provider";
import { useEvent } from "./event-provider";
import type { UserRole } from "@/lib/types";

export interface SimulatedUser {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_sponsor: boolean;
  sponsor_id: string | null;
}

interface SimulationContextValue {
  simulatedUser: SimulatedUser | null;
  isSimulating: boolean;
  startSimulation: (user: SimulatedUser) => void;
  stopSimulation: () => void;
}

const SimulationContext = createContext<SimulationContextValue>({
  simulatedUser: null,
  isSimulating: false,
  startSimulation: () => {},
  stopSimulation: () => {},
});

function storageKey(eventId: string) {
  return `sim:${eventId}`;
}

export function SimulationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  const { eventId } = useEvent();
  const [simulatedUser, setSimulatedUser] = useState<SimulatedUser | null>(
    null
  );

  // Restore from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey(eventId));
      if (stored) {
        setSimulatedUser(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, [eventId]);

  const startSimulation = useCallback(
    (user: SimulatedUser) => {
      if (!profile?.is_super_admin) return;
      setSimulatedUser(user);
      try {
        sessionStorage.setItem(storageKey(eventId), JSON.stringify(user));
      } catch {
        // sessionStorage full or unavailable
      }
    },
    [profile, eventId]
  );

  const stopSimulation = useCallback(() => {
    setSimulatedUser(null);
    try {
      sessionStorage.removeItem(storageKey(eventId));
    } catch {
      // Ignore
    }
  }, [eventId]);

  return (
    <SimulationContext.Provider
      value={{
        simulatedUser,
        isSimulating: simulatedUser !== null,
        startSimulation,
        stopSimulation,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}
