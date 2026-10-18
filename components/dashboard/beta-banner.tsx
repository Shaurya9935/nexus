"use client";

import React, { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "nexus_beta_banner_dismissed";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function BetaBanner() {
  const [localDismissed, setLocalDismissed] = useState(false);
  const isSessionDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismissed = localDismissed || isSessionDismissed;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
      document.documentElement.classList.add("hide-beta-banner");
    } catch {}
    setLocalDismissed(true);
  };

  if (dismissed) {
    return null;
  }

  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL?.trim();
  const feedbackEmail = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim();
  const feedbackHref = feedbackUrl
    ? feedbackUrl
    : feedbackEmail
    ? `mailto:${feedbackEmail}?subject=Nexus%20Beta%20Feedback`
    : null;

  return (
    <>
      {/* Inline early-script to ensure zero-flash on client navigation */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem('${STORAGE_KEY}')==='true'){document.documentElement.classList.add('hide-beta-banner');}}catch(e){}`,
        }}
      />
      <aside
        id="beta-banner"
        role="status"
        aria-label="Beta notification"
        className="w-full flex-shrink-0 flex items-center justify-between px-4 sm:px-6 text-[12.5px] border-b select-none z-30 transition-all duration-150"
        style={{
          height: 36,
          minHeight: 36,
          maxHeight: 36,
          background: "var(--banner-bg)",
          color: "var(--banner-text)",
          borderColor: "var(--banner-border)",
          fontFamily: "var(--font-ui, 'DM Sans', system-ui, sans-serif)",
        }}
      >
        {/* Left: Beta badge & Message */}
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          <span
            className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase px-1.5 py-0.5 rounded leading-none shrink-0"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent-text)",
            }}
          >
            BETA
          </span>

          {/* Desktop full message */}
          <span className="hidden sm:inline truncate">
            Nexus is still in beta. Things may change or break, so your feedback helps.
          </span>

          {/* Mobile shortened message (<640px) */}
          <span className="inline sm:hidden truncate">
            Beta: things may change.
          </span>
        </div>

        {/* Right: Feedback link & Dismiss button */}
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {feedbackHref && (
            <a
              href={feedbackHref}
              target={feedbackUrl ? "_blank" : undefined}
              rel={feedbackUrl ? "noopener noreferrer" : undefined}
              className="text-[12px] font-medium transition-opacity hover:opacity-80 underline underline-offset-2 shrink-0 focus-ring rounded-sm"
              style={{ color: "var(--accent-text)" }}
            >
              Send feedback
            </a>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss beta banner for this session"
            className="p-1 rounded transition-colors hover:bg-[var(--hover)] text-[var(--banner-text)] opacity-70 hover:opacity-100 flex items-center justify-center shrink-0 focus-ring"
            style={{ border: "none", background: "transparent", cursor: "pointer" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="3" x2="13" y2="13" />
              <line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
