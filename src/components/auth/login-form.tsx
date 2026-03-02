"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2, KeyRound } from "lucide-react";

interface LoginFormProps {
  accentColor: string;
}

export function LoginForm({ accentColor }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setStep("code");
    setLoading(false);
    // Focus first code input after render
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handleVerifyCode = async (fullCode?: string) => {
    const token = fullCode || code.join("");
    if (token.length !== 6) return;

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setError(error.message);
      setCode(["", "", "", "", "", ""]);
      setLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return;
    }

    // Check if profile is complete (has first/last name)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (profile?.first_name && profile?.last_name) {
        router.push("/schedule");
      } else {
        router.push("/profile/complete");
      }
    } else {
      router.push("/schedule");
    }
    router.refresh();
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setCode(newCode);

    if (pasted.length === 6) {
      handleVerifyCode(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  if (step === "code") {
    return (
      <div
        className="w-full max-w-sm"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        <div className="rounded-md border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <KeyRound className="h-5 w-5 text-[#F4F6F8]" />
          </div>
          <h2 className="text-center text-lg font-bold text-[#F4F6F8]">
            Enter your code
          </h2>
          <p className="mt-1 text-center text-sm text-[#B8BDC7]">
            We sent a 6-digit code to<br />
            <strong className="text-[#F4F6F8]">{email}</strong>
          </p>
          <p className="mt-1 text-center text-xs text-[#B8BDC7]/60">
            Don&apos;t see it? Check your spam or junk folder.
          </p>

          <div className="mt-6 flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                disabled={loading}
                className="h-12 w-10 rounded-md border border-white/10 bg-white/5 text-center text-lg font-bold text-[#F4F6F8] focus:border-white/30 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <p className="mt-3 text-center text-sm text-red-400">{error}</p>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[#B8BDC7]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </div>
          )}

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={handleSendCode}
              disabled={loading}
              className="text-sm text-[#B8BDC7] transition-colors hover:text-white disabled:opacity-50"
            >
              Resend code
            </button>
            <button
              onClick={() => {
                setStep("email");
                setCode(["", "", "", "", "", ""]);
                setError(null);
              }}
              className="text-sm text-[#B8BDC7] transition-colors hover:text-white"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-sm"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div className="rounded-md border border-white/10 bg-white/5 p-6 backdrop-blur">
        <h2 className="text-center text-lg font-bold text-[#F4F6F8]">
          Sign in with email
        </h2>
        <p className="mt-1 text-center text-sm text-[#B8BDC7]">
          We&apos;ll send you a 6-digit code
        </p>

        <form onSubmit={handleSendCode} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#B8BDC7]"
            >
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8BDC7]" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full rounded-md border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-[#F4F6F8] placeholder:text-[#B8BDC7]/40 focus:border-white/30 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            </div>
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
                Sending code...
              </>
            ) : (
              "Send code"
            )}
          </button>
        </form>
      </div>

      <Link
        href="/schedule"
        className="mt-4 block text-center text-sm text-[#B8BDC7] transition-colors hover:text-white"
      >
        Browse schedule without signing in
      </Link>
    </div>
  );
}
