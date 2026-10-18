"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { CommandInboxIcon, AlertIcon, GoogleIcon } from "./icons";
import { Field } from "./field";
import { PasswordField } from "./password-field";

export function LoginForm({
  signupMode = "open",
}: {
  signupMode?: "open" | "invite";
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!email.trim()) {
      e.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = "Enter a valid email address.";
    }
    if (!password) {
      e.password = "Password is required.";
    }
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (googleLoading) return;
    setTouched({ email: true, password: true });
    setFormError(null);

    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setFormError(error.message || "Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  async function handleGoogle() {
    if (loading || googleLoading) return;
    setFormError(null);
    setGoogleLoading(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
      });
      if (error) {
        setFormError(error.message || "Failed to continue with Google.");
        setGoogleLoading(false);
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to continue with Google."
      );
      setGoogleLoading(false);
    }
  }

  function err(f: string) {
    return touched[f] ? errors[f] : undefined;
  }

  return (
    <div className="w-full max-w-[360px]">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <CommandInboxIcon size={26} />
        <span className="text-[16px] font-semibold tracking-[-0.3px] text-[var(--text-primary)]">
          Nexus
        </span>
      </div>

      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-[21px] font-semibold tracking-[-0.4px] text-[var(--text-primary)] mb-1.5">
          Welcome back
        </h1>
        <p className="text-[13.5px] text-[var(--text-secondary)] leading-snug">
          Enter your credentials to access your workspace.
        </p>
      </div>

      {/* Form error banner */}
      {formError && (
        <div
          role="alert"
          className="mb-4 p-2.5 rounded-[7px] bg-[var(--status-error-bg)] border border-[var(--status-error-border)] flex items-center gap-2 text-[12px] font-medium text-[var(--status-error-text)]"
        >
          <AlertIcon />
          <span>{formError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
        <Field
          id="email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={err("email")}
          required
        />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={err("password")}
          required
        />

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className={[
            "w-full h-9 mt-0.5 rounded-[7px] text-[13.5px] font-semibold transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2",
            loading || googleLoading
              ? "cursor-not-allowed text-[var(--text-inverse)]"
              : "active:scale-[0.99] text-[var(--text-inverse)] cursor-pointer",
          ].join(" ")}
          style={{ background: loading ? "var(--brand-accent-hover)" : "var(--brand-accent)" }}
          onMouseEnter={(e) => {
            if (!loading && !googleLoading) e.currentTarget.style.background = "var(--brand-accent-hover)";
          }}
          onMouseLeave={(e) => {
            if (!loading && !googleLoading) e.currentTarget.style.background = "var(--brand-accent)";
          }}
          aria-label={loading ? "Logging in…" : "Log in"}
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
              Logging in…
            </span>
          ) : (
            "Log in"
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-0.5">
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">
            or
          </span>
          <div className="flex-1 h-px bg-[var(--border-subtle)]" />
        </div>

        {/* Google SSO */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading || googleLoading}
          className={[
            "w-full h-9 flex items-center justify-center gap-2 rounded-[7px] text-[13.5px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2",
            loading || googleLoading
              ? "opacity-60 cursor-not-allowed bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
              : "text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:border-[var(--text-muted)] active:scale-[0.99] cursor-pointer",
          ].join(" ")}
          aria-label={googleLoading ? "Connecting to Google…" : "Continue with Google"}
        >
          {googleLoading ? (
            <span className="flex items-center justify-center gap-2 text-[var(--text-secondary)]">
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
                  strokeOpacity="0.25"
                />
                <path
                  d="M7 1.5a5.5 5.5 0 015.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Connecting to Google…
            </span>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
      </form>

      {/* Register link */}
      <p className="text-center mt-6 text-[13px] text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--brand-accent)] hover:text-[var(--brand-accent-hover)] transition-colors focus-ring rounded-sm"
        >
          Sign up
        </Link>
      </p>

      {/* Beta / Access Note */}
      {signupMode === "open" ? (
        <p className="text-center mt-5 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          Nexus is in beta. You may run into bugs, and your feedback helps.
        </p>
      ) : (
        <p className="text-center mt-5 text-[11.5px] text-[var(--text-muted)] leading-relaxed">
          Nexus is in private beta.{" "}
          <Link
            href="/#early-access"
            className="text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)] transition-colors focus-ring rounded-sm"
          >
            Request access on the home page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
