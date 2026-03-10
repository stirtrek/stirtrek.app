"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2, KeyRound } from "lucide-react";

export default function CreateEventLoginPage() {
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
        emailRedirectTo: `${window.location.origin}/create-event/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setStep("code");
    setLoading(false);
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

    router.push("/create-event");
    router.refresh();
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
              <KeyRound className="h-5 w-5 text-sky-600" />
            </div>
            <h2 className="text-center text-lg font-bold text-slate-900">
              Enter your code
            </h2>
            <p className="mt-1 text-center text-sm text-slate-500">
              We sent a 6-digit code to<br />
              <strong className="text-slate-800">{email}</strong>
            </p>

            <div className="mt-6 flex justify-center gap-2">
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
                  onPaste={handlePaste}
                  disabled={loading}
                  className="h-12 w-10 rounded-md border border-slate-200 bg-slate-50 text-center text-lg font-bold text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
                />
              ))}
            </div>

            {error && (
              <p className="mt-3 text-center text-sm text-red-500">{error}</p>
            )}

            {loading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="text-sm text-slate-500 transition-colors hover:text-sky-600 disabled:opacity-50"
              >
                Resend code
              </button>
              <button
                onClick={() => {
                  setStep("email");
                  setCode(["", "", "", "", "", ""]);
                  setError(null);
                }}
                className="text-sm text-slate-500 transition-colors hover:text-sky-600"
              >
                Use a different email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
            <Mail className="h-5 w-5 text-sky-600" />
          </div>
          <h2 className="text-center text-lg font-bold text-slate-900">
            Sign in to get started
          </h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            We&apos;ll send you a 6-digit code
          </p>

          <form onSubmit={handleSendCode} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-500 px-7 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
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
      </div>
    </div>
  );
}
