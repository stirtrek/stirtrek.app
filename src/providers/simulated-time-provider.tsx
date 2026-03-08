"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useEvent } from "./event-provider";

interface SimulatedTimeContextValue {
  getNow: () => Date;
  simulatedTime: string | null;
  loading: boolean;
}

const SimulatedTimeContext = createContext<SimulatedTimeContextValue>({
  getNow: () => new Date(),
  simulatedTime: null,
  loading: true,
});

const POLL_INTERVAL = 30_000;

export function SimulatedTimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { eventSlug } = useEvent();
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchSimulatedTime() {
      try {
        const res = await fetch(`/${eventSlug}/api/admin/simulated-time`);
        if (res.ok) {
          const data = await res.json();
          const time = data.simulatedTime ?? null;
          if (mounted) {
            setSimulatedTime(time);
            // Only poll while simulated time is active
            if (time && !interval) {
              interval = setInterval(fetchSimulatedTime, POLL_INTERVAL);
            } else if (!time && interval) {
              clearInterval(interval);
              interval = null;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch simulated time:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchSimulatedTime();

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [eventSlug]);

  const getNow = useCallback((): Date => {
    if (simulatedTime) {
      return new Date(simulatedTime);
    }
    return new Date();
  }, [simulatedTime]);

  return (
    <SimulatedTimeContext.Provider value={{ getNow, simulatedTime, loading }}>
      {children}
    </SimulatedTimeContext.Provider>
  );
}

export function useSimulatedTime() {
  return useContext(SimulatedTimeContext);
}
