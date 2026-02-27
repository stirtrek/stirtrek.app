"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

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
  const [simulatedTime, setSimulatedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchSimulatedTime() {
      try {
        const res = await fetch("/api/admin/simulated-time");
        if (res.ok) {
          const data = await res.json();
          if (mounted) setSimulatedTime(data.simulatedTime ?? null);
        }
      } catch {
        // Silently fail — use real time
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchSimulatedTime();

    const interval = setInterval(fetchSimulatedTime, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const getNow = useCallback((): Date => {
    if (simulatedTime) {
      // Parse as UTC to match Sessionize "fake UTC" timestamps
      return new Date(simulatedTime);
    }
    // Current Eastern time as a Date with UTC numbers (matching Sessionize format)
    const eastern = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    return new Date(eastern);
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
