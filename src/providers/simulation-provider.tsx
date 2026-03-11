"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
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
  getSimulationHeaders: () => Record<string, string>;
}

const SimulationContext = createContext<SimulationContextValue>({
  simulatedUser: null,
  isSimulating: false,
  startSimulation: () => {},
  stopSimulation: () => {},
  getSimulationHeaders: () => ({}),
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
    () => {
      if (typeof window === "undefined") return null;
      try {
        const stored = sessionStorage.getItem(storageKey(eventId));
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
  );

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

  const simHeaders = useMemo(
    (): Record<string, string> =>
      simulatedUser ? { "X-Simulated-User-Id": simulatedUser.id } : {},
    [simulatedUser]
  );

  const getSimulationHeaders = useCallback(
    () => simHeaders,
    [simHeaders]
  );

  const value = useMemo(
    () => ({
      simulatedUser,
      isSimulating: simulatedUser !== null,
      startSimulation,
      stopSimulation,
      getSimulationHeaders,
    }),
    [simulatedUser, startSimulation, stopSimulation, getSimulationHeaders]
  );

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  return useContext(SimulationContext);
}

/**
 * Returns a fetch wrapper that auto-injects the simulation header.
 */
export function useSimulationFetch() {
  const { getSimulationHeaders } = useSimulation();

  return useCallback(
    (url: string, init?: RequestInit) => {
      const simHeaders = getSimulationHeaders();
      return fetch(url, {
        ...init,
        headers: {
          ...init?.headers,
          ...simHeaders,
        },
      });
    },
    [getSimulationHeaders],
  );
}
