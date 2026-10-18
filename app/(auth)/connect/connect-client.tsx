"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";

type Service = "gmail" | "calendar";

export function ConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingService, setLoadingService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(() => searchParams.get("error"));

  const handleConnect = async (service: Service) => {
    setLoadingService(service);
    setError(null);
    setOauthError(null);
    try {
      const endpoint =
        service === "gmail"
          ? "/api/integrations/gmail/connect"
          : "/api/integrations/calendar/connect";

      const response = await fetch(endpoint, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const errStr = data?.error || "";
        if (
          response.status === 403 ||
          errStr.toLowerCase().includes("denied") ||
          errStr.toLowerCase().includes("tester") ||
          errStr.toLowerCase().includes("testing")
        ) {
          setOauthError("access_denied");
          setLoadingService(null);
          return;
        }
        throw new Error(errStr || `Failed to connect ${service === "gmail" ? "Gmail" : "Google Calendar"}`);
      }

      const { connectUrl } = await response.json();

      if (connectUrl) {
        window.location.href = connectUrl;
      } else {
        throw new Error("No connect URL returned by the server");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to connect ${service === "gmail" ? "Gmail" : "Google Calendar"}`;
      setError(message);
      setLoadingService(null);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.025em",
            margin: "0 0 8px",
          }}
        >
          Connect your workspaces
        </h1>

        <p
          style={{
            fontSize: 13.5,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            margin: "0 0 24px",
          }}
        >
          Link your Google services to sync threads, manage your calendar, and power Nexus with AI.
        </p>

        {oauthError ? (
          <div
            role="status"
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--status-warning-bg)",
              border: "1px solid var(--status-warning-border)",
              borderRadius: 10,
              marginBottom: 16,
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "var(--warning-border)",
                  color: "var(--status-warning-text)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM8 5v4m0 2.5h.01"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 3,
                  }}
                >
                  Google Workspace Access Limited
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-secondary)",
                    lineHeight: 1.45,
                  }}
                >
                  Gmail and Calendar access is limited to approved testers while Nexus is in beta. Request access and we&apos;ll add you.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 38 }}>
              <Link
                href="/#early-access"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  background: "var(--accent-solid)",
                  color: "var(--on-accent)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Request access →
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOauthError(null);
                  setError(null);
                  if (typeof window !== "undefined") {
                    router.replace(window.location.pathname);
                  }
                }}
                style={{
                  padding: "6px 12px",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "var(--status-error-bg)",
              border: "1px solid var(--status-error-border)",
              borderRadius: 8,
              color: "var(--status-error-text)",
              fontSize: 12.5,
              marginBottom: 16,
              textAlign: "left",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Gmail Card */}
          <div
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              textAlign: "left",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: "var(--brand-gmail-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <Image
                  src="/icons/gmail.png"
                  alt="Gmail"
                  width={24}
                  height={24}
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                  Gmail
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Emails & AI thread management
                </div>
              </div>
            </div>

            <button
              onClick={() => handleConnect("gmail")}
              disabled={loadingService !== null}
              style={{
                padding: "8px 14px",
                background: loadingService === "gmail" ? "var(--brand-accent-hover)" : "var(--brand-accent)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: loadingService !== null ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loadingService === "gmail" ? "Connecting…" : "Connect"}
            </button>
          </div>

          {/* Google Calendar Card */}
          <div
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              textAlign: "left",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 9,
                  background: "var(--brand-calendar-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <Image
                  src="/icons/google-calendar.png"
                  alt="Google Calendar"
                  width={24}
                  height={24}
                  style={{ objectFit: "contain" }}
                  priority
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>
                  Google Calendar
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Events, schedule & daily agenda
                </div>
              </div>
            </div>

            <button
              onClick={() => handleConnect("calendar")}
              disabled={loadingService !== null}
              style={{
                padding: "8px 14px",
                background: loadingService === "calendar" ? "var(--brand-accent-hover)" : "var(--brand-accent)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: loadingService !== null ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loadingService === "calendar" ? "Connecting…" : "Connect"}
            </button>
          </div>
        </div>

        <a
          href="/dashboard"
          style={{
            marginTop: 20,
            fontSize: 12.5,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          Skip for now →
        </a>
      </div>
    </AuthLayout>
  );
}

export { ConnectClient as ConnectGmailButton };
