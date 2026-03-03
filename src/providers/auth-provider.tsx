"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

interface AuthContext {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContext>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);
  const currentUserId = useRef<string | null>(null);

  // Only create the client if env vars exist (avoids build-time errors)
  const supabase = useMemo(() => {
    if (
      typeof window === "undefined" ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ) {
      return null;
    }
    return createClient();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // onAuthStateChange fires INITIAL_SESSION synchronously from local
    // cookie/storage state — no network call required. This resolves the
    // loading state immediately so the UI never hangs waiting for a remote
    // auth check.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;
      const identityChanged = newUserId !== currentUserId.current;

      if (identityChanged) {
        currentUserId.current = newUserId;
        setUser(newUser);

        if (newUser) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", newUser.id)
            .single();
          setProfile(profileData);
        } else {
          setProfile(null);
        }
      }

      // Resolve loading on the very first event (INITIAL_SESSION)
      if (!initialised.current) {
        initialised.current = true;
        setLoading(false);
      }
    });

    // Safety timeout: if auth state hasn't resolved in 5 s, unblock the UI
    const timeout = setTimeout(() => {
      if (!initialised.current) {
        initialised.current = true;
        console.warn("Auth: INITIAL_SESSION did not fire within 5 s — unblocking UI");
        setLoading(false);
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
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
