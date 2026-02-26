"use client";

import { useState, useEffect } from "react";
import { AnimatedLogo, STAR_COLORS } from "@/components/layout/animated-logo";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const [accentColor, setAccentColor] = useState(STAR_COLORS[0]);

  useEffect(() => {
    setAccentColor(
      STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
    );
  }, []);

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
        <AnimatedLogo className="w-72" color={accentColor} />

        <LoginForm accentColor={accentColor} />
      </div>
    </div>
  );
}
