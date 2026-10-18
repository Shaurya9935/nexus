"use client";

import { useState } from "react";

type FormStatus = "idle" | "loading" | "success" | "error" | "rate-limited";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), website }),
      });

      if (res.status === 429) {
        setStatus("rate-limited");
        setMessage("Too many submissions. Please try again later.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setMessage(data?.error || "Something went wrong, try again");
        return;
      }

      setStatus("success");
      setMessage("You're on the list. We'll email you when your invite is ready.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong, try again");
    }
  };

  return (
    <section
      id="early-access"
      className="relative overflow-hidden px-5 py-28 text-center md:py-40"
    >
      <div className="cta-glow" />
      <div className="relative mx-auto max-w-3xl">
        <p className="mono-kicker">EARLY ACCESS</p>
        <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
          Ready to run your day
          <br />
          from one place?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
          Join the early access list. We’ll send a single note when Nexus is
          ready for you.
        </p>

        {status === "success" ? (
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-[var(--landing-line)] bg-[var(--landing-surface-card)] p-6 text-center shadow-lg">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--landing-accent-tint)] text-[var(--landing-accent)]">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-[var(--landing-ink)]">
              {message}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
              className="mt-4 text-xs font-medium text-[var(--landing-accent)] hover:underline"
            >
              Register another email
            </button>
          </div>
        ) : (
          <form
            className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row"
            onSubmit={handleSubmit}
          >
            {/* Honeypot field for bot detection */}
            <div
              style={{
                position: "absolute",
                left: "-9999px",
                opacity: 0,
                height: 0,
                width: 0,
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <label htmlFor="email" className="sr-only">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={status === "loading"}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error" || status === "rate-limited") {
                  setStatus("idle");
                  setMessage("");
                }
              }}
              placeholder="Work email"
              className="h-12 flex-1 rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition-shadow placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="button button-primary h-12 justify-center text-white disabled:opacity-70"
            >
              {status === "loading" ? "Submitting…" : "Get early access"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="mt-3 text-xs font-medium text-[var(--destructive-text)]" role="alert">
            {message || "Something went wrong, try again"}
          </p>
        )}
        {status === "rate-limited" && (
          <p className="mt-3 text-xs font-medium text-[var(--warning-text)]" role="alert">
            {message || "Too many submissions. Please try again later."}
          </p>
        )}

        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.15em] text-muted">
          We&apos;ll only use your email to send your invite.{" "}
          <a
            href="#security"
            className="underline underline-offset-2 hover:text-ink transition-colors"
          >
            Privacy note
          </a>
        </p>
      </div>
    </section>
  );
}
