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
  const profileRef = useRef<Profile | null>(null);

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

    // Shared handler for both onAuthStateChange and the getSession fallback
    const handleAuthUser = async (newUser: User | null) => {
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
          profileRef.current = profileData;
          setProfile(profileData);

          // If profile fetch failed (e.g. token mid-refresh), retry in background
          if (!profileData) {
            (async () => {
              for (const delay of [500, 2000]) {
                await new Promise((r) => setTimeout(r, delay));
                if (profileRef.current || currentUserId.current !== newUser.id) return;
                const { data } = await supabase
                  .from("profiles")
                  .select("*")
                  .eq("id", newUser.id)
                  .single();
                if (data) {
                  profileRef.current = data;
                  setProfile(data);
                  return;
                }
              }
            })();
          }
        } else {
          profileRef.current = null;
          setProfile(null);
        }
      } else if (newUser && !profileRef.current) {
        // Profile fetch failed earlier (e.g. token was mid-refresh) — retry
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newUser.id)
          .single();
        if (profileData) {
          profileRef.current = profileData;
          setProfile(profileData);
        }
      }

      if (!initialised.current) {
        initialised.current = true;
        setLoading(false);
      }
    };

    // Listen for ongoing auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: string, session: { user: User } | null) => {
      await handleAuthUser(session?.user ?? null);
    });

    // Proactive session check — resolves immediately from local storage
    // without waiting for INITIAL_SESSION which may not fire reliably
    // in all @supabase/ssr versions.
    if (!initialised.current) {
      supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: User } | null } }) => {
        if (!initialised.current) {
          handleAuthUser(session?.user ?? null);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    profileRef.current = null;
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) {
      profileRef.current = data;
      setProfile(data);
    }
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
