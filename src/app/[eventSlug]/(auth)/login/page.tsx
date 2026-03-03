"use client";

import { AnimatedLogo } from "@/components/layout/animated-logo";
import { AnimatedBaconLogo } from "@/components/layout/animated-bacon-logo";
import { LoginForm } from "@/components/auth/login-form";
import { useEvent } from "@/providers/event-provider";

export default function LoginPage() {
  const { event, accentColor } = useEvent();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#1B1D23] p-6 text-center">
      {/* Speed lines background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(244,246,248,0.1) 20px, rgba(244,246,248,0.1) 22px)",
        }}
      />

      <div className="relative z-20 flex flex-col items-center gap-8">
        {event.slug === "bacon" ? (
          <AnimatedBaconLogo className="w-72" />
        ) : event.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.logo_url}
            alt={event.name}
            className="w-72 object-contain"
          />
        ) : event.slug === "stirtrek" ? (
          <AnimatedLogo className="w-72" color={accentColor} ariaLabel={event.name} />
        ) : (
          <h1
            className="text-4xl font-bold uppercase tracking-wider text-[#F4F6F8]"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {event.name}
          </h1>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
