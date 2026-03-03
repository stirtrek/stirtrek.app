"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/providers/event-provider";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { eventPath, accentColor } = useEvent();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate with existing profile data (e.g. returning user on new device)
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();
      if (profile?.first_name) setFirstName(profile.first_name);
      if (profile?.last_name) setLastName(profile.last_name);
    }
    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      router.replace(eventPath("/schedule"));
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#1B1D23] p-6 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(244,246,248,0.1) 20px, rgba(244,246,248,0.1) 22px)",
        }}
      />

      <div className="relative z-20 w-full max-w-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        <div className="rounded-md border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <UserCheck className="h-5 w-5 text-[#F4F6F8]" />
          </div>
          <h2 className="text-center text-lg font-bold text-[#F4F6F8]">
            Complete your profile
          </h2>
          <p className="mt-1 text-center text-sm text-[#B8BDC7]">
            Tell us your name so sponsors can connect with you.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="firstName"
                className="block text-xs font-semibold uppercase tracking-wider text-[#B8BDC7]"
              >
                First name
              </label>
              <input
                id="firstName"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={loading}
                autoFocus
                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#F4F6F8] placeholder:text-[#B8BDC7]/40 focus:border-white/30 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="lastName"
                className="block text-xs font-semibold uppercase tracking-wider text-[#B8BDC7]"
              >
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#F4F6F8] placeholder:text-[#B8BDC7]/40 focus:border-white/30 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-md px-7 py-3.5 text-sm font-semibold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              style={{
                backgroundColor: accentColor,
                border: "2px solid #F4F6F8",
                boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
