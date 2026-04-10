"use client";

import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface AuthContext {
  user: User | null;
  profile: Profile | null;
  /**
   * Always `false`. Kept for API compatibility with consumers that used
   * to read this from the previous client-side AuthProvider. Auth state
   * is now hydrated from the server before the client tree mounts, so
   * there is no loading window.
   */
  loading: boolean;
  signOut: () => Promise<void>;
  /**
   * Re-runs the server tree to refetch the user's profile. Use after
   * mutating profile data (e.g. completing the profile form).
   */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContext>({
  user: null,
  profile: null,
  loading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

interface AuthProviderProps {
  children: React.ReactNode;
  /** Auth user resolved server-side. `null` for anonymous visitors. */
  user: User | null;
  /** Profile row for the auth user. `null` if anonymous or not yet created. */
  profile: Profile | null;
}

export function AuthProvider({ children, user, profile }: AuthProviderProps) {
  const router = useRouter();

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // Server signout failed; fall through to hard redirect anyway so
      // the client state doesn't drift from the cookie state.
    }
    // Hard redirect: forces middleware to re-run, clears any in-memory
    // state, and sidesteps any client-side auth caching.
    window.location.assign("/");
  };

  const refreshProfile = async () => {
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading: false, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
