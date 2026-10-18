"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { CommandInboxIcon, AlertIcon } from "./icons";

function maskEmailAddress(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const firstChar = local.charAt(0);
  return `${firstChar}***@${domain}`;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem("nexus_verify_email") || "";
    }
    return "";
  });
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [statusMessage, setStatusMessage] = useState<string | null>(() =>
    searchParams?.get("reason") === "unverified"
      ? "Please verify your email address to access your workspace."
      : null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Autofocus first input on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  async function handleVerify(codeToVerify?: string) {
    const code = codeToVerify || digits.join("");
    if (code.length !== 6 || loading || isSuccess) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await authClient.emailOtp.verifyEmail({
        email,
        otp: code,
      });

      if (res.error) {
        const errCode = res.error.code;
        if (errCode === "TOO_MANY_ATTEMPTS") {
          setErrorMessage("Too many attempts, request a new code.");
        } else if (errCode === "INVALID_OTP" || errCode === "OTP_EXPIRED") {
          setErrorMessage("Invalid or expired code.");
        } else {
          setErrorMessage(res.error.message || "Invalid or expired code.");
        }
        setLoading(false);
        // Clear digits for clean re-entry on failure
        setDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      } else {
        setIsSuccess(true);
        setLoading(false);
        // Clean up storage and forward to dashboard
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("nexus_verify_email");
        }
        setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      }
    } catch {
      setLoading(false);
      setErrorMessage("Verification failed. Please request a new code.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }

  function handleInputChange(index: number, value: string) {
    if (loading || isSuccess) return;

    // Filter to digits only
    const cleanDigit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = cleanDigit;
    setDigits(newDigits);
    setErrorMessage(null);

    if (cleanDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are provided
    if (cleanDigit && index === 5 && newDigits.every((d) => d.length === 1)) {
      handleVerify(newDigits.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (loading || isSuccess) return;

    const pastedData = e.clipboardData.getData("text");
    const digitsOnly = pastedData.replace(/\D/g, "").slice(0, 6);
    if (!digitsOnly) return;

    const newDigits = [...digits];
    for (let i = 0; i < digitsOnly.length; i++) {
      newDigits[i] = digitsOnly[i];
    }
    setDigits(newDigits);
    setErrorMessage(null);

    const nextIndex = Math.min(5, digitsOnly.length);
    inputRefs.current[nextIndex]?.focus();

    if (digitsOnly.length === 6) {
      handleVerify(digitsOnly);
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending || loading || !email) return;

    setResending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });

      // Non-enumerating response
      setStatusMessage("If this email can be used, we've sent a code.");
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch {
      setStatusMessage("If this email can be used, we've sent a code.");
      setCountdown(60);
    } finally {
      setResending(false);
    }
  }

  function handleUseDifferentEmail() {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("nexus_verify_email");
    }
    router.push("/register");
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-[360px] flex flex-col items-center justify-center text-center px-2">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-5"
          style={{ background: "var(--brand-accent-subtle)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10l4.5 4.5 7.5-8"
              stroke="var(--brand-accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-[19px] font-semibold tracking-[-0.3px] text-[var(--text-primary)] mb-2">
          Email verified!
        </h2>
        <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed max-w-[260px]">
          Opening your Nexus workspace…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[360px]">
      {/* Brand Icon & Heading */}
      <div className="flex items-center gap-2 mb-8">
        <CommandInboxIcon size={26} />
        <span className="text-[16px] font-semibold tracking-[-0.3px] text-[var(--text-primary)]">
          Nexus
        </span>
      </div>

      <div className="mb-6">
        <h1 className="text-[21px] font-semibold tracking-[-0.4px] text-[var(--text-primary)] mb-1.5">
          Check your email
        </h1>
        <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed">
          {email ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-[var(--text-primary)]">
                {maskEmailAddress(email)}
              </span>
            </>
          ) : (
            "We sent a 6-digit verification code to your email address."
          )}
        </p>
      </div>

      {/* Info status notice */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 p-2.5 rounded-[7px] flex items-center gap-2 text-[12px] font-medium leading-normal"
          style={{
            background: "var(--brand-accent-subtle)",
            color: "var(--brand-accent)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 p-2.5 rounded-[7px] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] flex items-center gap-2 text-[12px] font-medium text-[var(--status-error-text)]"
        >
          <AlertIcon />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 6-box input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify();
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="flex items-center justify-between gap-2">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={idx === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              aria-label={`Digit ${idx + 1} of 6`}
              className={[
                "w-11 h-12 text-center text-[20px] font-mono font-semibold rounded-[8px] transition-all duration-150",
                "bg-[var(--bg-main)] text-[var(--text-primary)]",
                "border focus:outline-none",
                errorMessage
                  ? "border-[var(--status-error-border)] focus:border-[var(--status-error-border)]"
                  : "border-[var(--border-subtle)] focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent-subtle)]",
                loading ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          type="submit"
          disabled={loading || digits.join("").length !== 6}
          className={[
            "w-full h-9 rounded-[7px] text-[13.5px] font-semibold transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2",
            loading || digits.join("").length !== 6
              ? "opacity-60 cursor-not-allowed text-[var(--text-inverse)]"
              : "active:scale-[0.99] text-[var(--text-inverse)] cursor-pointer",
          ].join(" ")}
          style={{
            background: loading ? "var(--brand-accent-hover)" : "var(--brand-accent)",
          }}
          onMouseEnter={(e) => {
            if (!loading && digits.join("").length === 6)
              e.currentTarget.style.background = "var(--brand-accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!loading && digits.join("").length === 6)
              e.currentTarget.style.background = "var(--brand-accent)";
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="7"
                  cy="7"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeOpacity="0.3"
                />
                <path
                  d="M7 1.5a5.5 5.5 0 015.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Verifying code…
            </span>
          ) : (
            "Verify email"
          )}
        </button>
      </form>

      {/* Resend & Actions */}
      <div className="mt-6 flex flex-col items-center gap-3 text-[13px]">
        {countdown > 0 ? (
          <span className="text-[var(--text-muted)] font-normal text-[12.5px]">
            Resend code in {countdown}s
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading}
            className="font-medium text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors focus-visible:outline-none focus-visible:underline cursor-pointer text-[12.5px]"
          >
            {resending ? "Sending fresh code…" : "Resend code"}
          </button>
        )}

        <button
          type="button"
          onClick={handleUseDifferentEmail}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[12px] underline underline-offset-2 cursor-pointer"
        >
          Use a different email
        </button>

        <p className="mt-2 text-center text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          Can&apos;t find the email? Check your spam folder.
        </p>
      </div>
    </div>
  );
}
